import * as vscode from 'vscode';
import { commands } from 'vscode';
import * as os from 'os';
import { selectProfileFile, readTextFile, getPidAndCellFilenameMap, verify, getFilenameMap } from './utilities/fsUtils';
import { FlamegraphPanel } from './flamegraphPanel';
import { extensionState } from './state';
import { Flamegraph } from './flamegraph';
import { createMemrayProfileTask, createProfileTask } from './taskProvider';

const TASK_TERMINAL_NAME = 'py-spy profile'; // Name of the terminal launched for the profiling task
const MEMORY_TASK_TERMINAL_NAME = 'memray profile';
const LINUX_BASED = os.platform() === 'darwin' || os.platform() === 'linux';
const IS_LINUX = os.platform() === 'linux';
const IS_MACOS = os.platform() === 'darwin';

/**
 * Loads a profile from a file specified by the user.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function loadProfileCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.loadProfile', async (fileUri?: vscode.Uri) => {
        if (!fileUri) {
            fileUri = await selectProfileFile();
        }
        if (!fileUri) {
            vscode.window.showErrorMessage('No profile file selected.');
            return;
        }
        extensionState.handleProfileUpdate(context, fileUri);
    });
}

/**
 * Toggles the inline profile visibility.
 *
 * @returns The command registration.
 */
export function toggleProfileCommand() {
    return vscode.commands.registerCommand('flamegraph.toggleProfile', async () => {
        const { profileVisible, profileUri } = extensionState;

        if (profileVisible) {
            extensionState.profileVisible = false;
        } else {
            if (!profileUri) {
                vscode.window.showErrorMessage('No profile loaded. Please load a profile first.');
                return;
            }
            if (!extensionState.currentFlamegraph) {
                extensionState.currentFlamegraph = new Flamegraph(await readTextFile(profileUri));
            }
            extensionState.profileVisible = true;
        }
        extensionState.updateUI();
    });
}

/**
 * Runs the profiler on the active file.
 *
 * @returns The command registration.
 */
export function runProfilerCommand() {
    return vscode.commands.registerCommand('flamegraph.runProfiler', async (fileUri?: vscode.Uri) => {
        // Check if we're in a notebook
        const notebookEditor = vscode.window.activeNotebookEditor;
        if (notebookEditor) {
            // If we're in a notebook, use the notebook profiling command
            await vscode.commands.executeCommand('flamegraph.profileNotebook');
            return;
        }

        const result = await verify({
            requireUri: true,
            requirePython: true,
            useSudo: IS_MACOS,
            ensurePasswordlessSudo: false,
            requirePid: false,
            fileUri: fileUri || vscode.window.activeTextEditor?.document.uri,
            profilerType: 'py-spy',
        });
        if (!result) return;

        const { uri, pythonPath, profilerPath, workspaceFolder, useSudo } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            file: uri!.fsPath,
            pythonPath,
            profilerPath,
            sudo: useSudo,
        });
        await vscode.tasks.executeTask(task);
    });
}

/**
 * Profiles all pytests in the active file.
 *
 * @returns The command registration.
 */
export function runPytestFileCommand() {
    return vscode.commands.registerCommand('flamegraph.runPytestFile', async (fileUri?: vscode.Uri) => {
        const result = await verify({
            requireUri: true,
            requirePython: true,
            useSudo: IS_MACOS,
            ensurePasswordlessSudo: false,
            requirePid: false,
            fileUri: fileUri || vscode.window.activeTextEditor?.document.uri,
            profilerType: 'py-spy',
        });
        if (!result) return;

        const { uri, pythonPath, profilerPath, workspaceFolder, useSudo } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            pythonPath,
            profilerPath,
            sudo: useSudo,
            args: ['-m', 'pytest', uri!.fsPath],
        });
        await vscode.tasks.executeTask(task);
    });
}

/**
 * Runs all pytests in the workspace.
 *
 * @returns The command registration.
 */
export function runAllPytestsCommand() {
    return vscode.commands.registerCommand('flamegraph.runAllPytests', async () => {
        const result = await verify({
            requireUri: false,
            requirePython: true,
            useSudo: IS_MACOS,
            ensurePasswordlessSudo: false,
            requirePid: false,
            profilerType: 'py-spy',
        });
        if (!result) return;

        const { pythonPath, profilerPath, workspaceFolder, useSudo } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            pythonPath,
            profilerPath,
            sudo: useSudo,
            args: ['-m', 'pytest'],
        });
        await vscode.tasks.executeTask(task);
    });
}

/**
 * Attaches py-spy to the running process.
 *
 * @param pid - The process ID (PID) to attach py-spy to.
 * @param subprocesses - Whether to attach py-spy to subprocesses.
 * @param native - Whether to attach py-spy to the native process.
 * @param requireSudoAccess - Whether to require sudo access.
 * @returns The command registration.
 */
export async function attach(
    pid?: string,
    requireSudoAccess: boolean = false,
    silent: boolean = false
): Promise<boolean> {
    const result = await verify({
        requireUri: false,
        requirePython: false,
        useSudo: LINUX_BASED,
        ensurePasswordlessSudo: requireSudoAccess,
        requirePid: true,
        pid,
        profilerType: 'py-spy',
    });
    if (!result) return false;

    const { pid: verifiedPid, profilerPath, workspaceFolder, useSudo } = result;

    const task = createProfileTask(
        workspaceFolder,
        {
            type: 'flamegraph',
            profilerPath,
            pid: verifiedPid,
            sudo: useSudo,
        },
        TASK_TERMINAL_NAME,
        silent
    );
    await vscode.tasks.executeTask(task);
    return true;
}

/**
 * Attaches py-spy to the running process
 *
 * @returns The command registration.
 */
export function attachProfilerCommand() {
    return vscode.commands.registerCommand('flamegraph.attachProfiler', async () => {
        const filenameMap = await getFilenameMap();
        if (filenameMap) {
            extensionState.filenameToJupyterCellMap = filenameMap;
        }
        await attach();
    });
}

/**
 * Shows the flamegraph visualization panel.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function showFlamegraphCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.showFlamegraph', async () => {
        const { profileUri } = extensionState;
        if (!profileUri) {
            vscode.window.showErrorMessage('No profile loaded. Please record or load a profile first.');
            return;
        }
        if (!extensionState.currentFlamegraph) {
            extensionState.currentFlamegraph = new Flamegraph(await readTextFile(profileUri));
        }
        extensionState.profileVisible = true;
        extensionState.updateUI();
        FlamegraphPanel.render(context.extensionUri, true);
        extensionState.loadSourceCode();
    });
}

/**
 * Helper function to handle notebook profiling logic.
 *
 * @param notebook - The notebook document.
 * @param executeCommand - The command to execute after profiling.
 */
async function handleNotebookProfiling(notebook: vscode.NotebookDocument, executeCommand: () => Promise<void>) {
    const result = await getPidAndCellFilenameMap(notebook);
    if (!result) return;

    const { pid, filenameToJupyterCell, uriToCode } = result;
    extensionState.filenameToJupyterCell = filenameToJupyterCell;
    extensionState.uriToCode = uriToCode;
    const success = await attach(pid, LINUX_BASED, true);
    if (!success) return;

    // small delay to ensure py-spy is running
    await new Promise((resolve) => {
        setTimeout(resolve, 500);
    });

    await executeCommand();

    // send ctrl-c to terminal to stop py-spy
    const terminal = vscode.window.terminals.find((t) => t.name === TASK_TERMINAL_NAME);
    if (terminal) {
        terminal.sendText('\u0003');
    }
}

/**
 * Profiles the currently selected cell in the active notebook.
 *
 * @returns The command registration.
 */
export function profileCellCommand() {
    return vscode.commands.registerCommand('flamegraph.profileCell', async (cell?: vscode.NotebookCell) => {
        if (!cell) {
            // If no cell is provided, use the active notebook editor and select the first cell
            const notebookEditor = vscode.window.activeNotebookEditor;
            if (!notebookEditor) {
                return;
            }
            const { selection } = notebookEditor;
            if (!selection || selection.isEmpty) {
                return;
            }
            cell = notebookEditor.notebook.cellAt(selection.start);
        }
        extensionState.profileDocumentUri = cell.document.uri;

        await handleNotebookProfiling(cell.notebook, async () =>
            commands.executeCommand(
                'notebook.cell.execute',
                { start: cell.index, end: cell.index + 1 },
                cell.notebook.uri
            )
        );
    });
}

/**
 * Profiles the currently active notebook.
 *
 * @returns The command registration.
 */
export function profileNotebookCommand() {
    return vscode.commands.registerCommand('flamegraph.profileNotebook', async () => {
        const notebookEditor = vscode.window.activeNotebookEditor;
        if (!notebookEditor) {
            vscode.window.showErrorMessage('No notebook selected for profiling. Please open a notebook and try again.');
            return;
        }

        extensionState.profileDocumentUri = vscode.window.activeTextEditor?.document.uri;

        await handleNotebookProfiling(notebookEditor.notebook, async () =>
            commands.executeCommand('notebook.execute', notebookEditor.notebook.uri)
        );
    });
}

/**
 * Attaches py-spy to a pid and show a top-like view in the task terminal.
 *
 * @returns The command registration.
 */
export function topCommand() {
    return vscode.commands.registerCommand('flamegraph.top', async () => {
        const result = await verify({
            requireUri: false,
            requirePython: false,
            useSudo: LINUX_BASED,
            ensurePasswordlessSudo: false,
            requirePid: true,
            profilerType: 'py-spy',
        });
        if (!result) return false;

        const { pid: verifiedPid, profilerPath, workspaceFolder, useSudo } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            profilerPath,
            pid: verifiedPid,
            mode: 'top',
            sudo: useSudo,
        });
        await vscode.tasks.executeTask(task);
        return true;
    });
}
/**
 * Runs the profiler on the active file.
 *
 * @returns The command registration.
 */
export function runMemrayProfilerCommand() {
    return vscode.commands.registerCommand('flamegraph.runMemrayProfiler', async (fileUri?: vscode.Uri) => {
        // Check if we're in a notebook
        const notebookEditor = vscode.window.activeNotebookEditor;
        if (notebookEditor) {
            // If we're in a notebook, use the notebook profiling command
            await vscode.commands.executeCommand('flamegraph.memoryProfileNotebook');
            return;
        }

        const result = await verify({
            requireUri: true,
            requirePython: true,
            useSudo: false,
            ensurePasswordlessSudo: false,
            requirePid: false,
            fileUri: fileUri || vscode.window.activeTextEditor?.document.uri,
            profilerType: 'memray',
        });
        if (!result) return;

        const { uri, pythonPath, workspaceFolder, profilerPath, useSudo } = result;
        if (!pythonPath) return;
        const task = createMemrayProfileTask(
            workspaceFolder,
            {
                type: 'flamegraph',
                mode: 'run',
                file: uri!.fsPath,
                pythonPath,
                profilerPath,
                sudo: useSudo,
            },
            MEMORY_TASK_TERMINAL_NAME
        );

        await vscode.tasks.executeTask(task);

        // Wait for the first task to complete before running the transform task
        const taskExecution = await vscode.tasks.executeTask(task);

        // Create a promise that resolves when the task completes
        await new Promise<void>((resolve) => {
            const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
                if (e.execution === taskExecution) {
                    disposable.dispose();
                    resolve();
                }
            });
        });

        // Now run the transform task after the first task has completed
        const transformTask = createMemrayProfileTask(
            workspaceFolder,
            {
                type: 'flamegraph',
                mode: 'transform',
                pythonPath,
                profilerPath,
            },
            MEMORY_TASK_TERMINAL_NAME,
            true
        );
        await vscode.tasks.executeTask(transformTask);
    });
}

async function attachMemoryProfiler(
    pid?: string,
    mode: 'attach' | 'detach' = 'attach',
    silent: boolean = false,
    waitForKeyPress: boolean = false
): Promise<boolean> {
    const result = await verify({
        requireUri: false,
        requirePython: false,
        useSudo: IS_LINUX,
        ensurePasswordlessSudo: IS_LINUX && silent,
        requirePid: true,
        pid,
        profilerType: 'memray',
    });
    if (!result) return false;

    const { pid: verifiedPid, workspaceFolder, pythonPath, profilerPath, useSudo } = result;
    if (!pythonPath) return false;

    const task = createMemrayProfileTask(
        workspaceFolder,
        {
            type: 'flamegraph',
            mode,
            pid: verifiedPid,
            waitForKeyPress,
            pythonPath,
            profilerPath,
            sudo: useSudo,
        },
        MEMORY_TASK_TERMINAL_NAME,
        silent
    );

    const taskExecution = await vscode.tasks.executeTask(task);
    if (mode === 'detach') {
        const dispStatusBarMessage = vscode.window.setStatusBarMessage('Processing profiling results...', 10000);

        await new Promise<void>((resolve) => {
            const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
                if (e.execution === taskExecution) {
                    disposable.dispose();
                    dispStatusBarMessage.dispose();
                    resolve();
                }
            });
        });
    }
    return true;
}

async function handleNotebookMemoryProfiling(notebook: vscode.NotebookDocument, executeCommand: () => Promise<void>) {
    const result = await getPidAndCellFilenameMap(notebook);
    if (!result) return;

    const { pid, filenameToJupyterCell, uriToCode } = result;
    extensionState.filenameToJupyterCell = filenameToJupyterCell;
    extensionState.uriToCode = uriToCode;
    const success = await attachMemoryProfiler(pid, 'attach', true);
    if (!success) return;

    // small delay to ensure memrayis running
    await new Promise((resolve) => {
        setTimeout(resolve, 500);
    });

    await executeCommand();

    await attachMemoryProfiler(pid, 'detach', true);
}

/**
 * Profiles the currently selected cell in the active notebook.
 *
 * @returns The command registration.
 */
export function memoryProfileCellCommand() {
    return vscode.commands.registerCommand('flamegraph.memoryProfileCell', async (cell?: vscode.NotebookCell) => {
        if (!cell) {
            // If no cell is provided, use the active notebook editor and select the first cell
            const notebookEditor = vscode.window.activeNotebookEditor;
            if (!notebookEditor) {
                return;
            }
            const { selection } = notebookEditor;
            if (!selection || selection.isEmpty) {
                return;
            }
            cell = notebookEditor.notebook.cellAt(selection.start);
        }
        extensionState.profileDocumentUri = cell.document.uri;

        await handleNotebookMemoryProfiling(cell.notebook, async () =>
            commands.executeCommand(
                'notebook.cell.execute',
                { start: cell.index, end: cell.index + 1 },
                cell.notebook.uri
            )
        );
    });
}
export function attachMemoryProfilerCommand() {
    return vscode.commands.registerCommand('flamegraph.attachMemoryProfiler', async () => {
        await attachMemoryProfiler(undefined, 'attach', false, true);
    });
}

export function memoryProfileNotebookCommand() {
    return vscode.commands.registerCommand('flamegraph.memoryProfileNotebook', async () => {
        const notebookEditor = vscode.window.activeNotebookEditor;
        if (!notebookEditor) {
            vscode.window.showErrorMessage('No notebook selected for profiling. Please open a notebook and try again.');
            return;
        }

        extensionState.profileDocumentUri = vscode.window.activeTextEditor?.document.uri;

        await handleNotebookMemoryProfiling(notebookEditor.notebook, async () =>
            commands.executeCommand('notebook.execute', notebookEditor.notebook.uri)
        );
    });
}

/**
 * Attaches memray to a pid and show a live view in the task terminal.
 *
 * @returns The command registration.
 */
export function memoryLiveViewCommand() {
    return vscode.commands.registerCommand('flamegraph.memoryLive', async () => {
        const result = await verify({
            requireUri: false,
            requirePython: false,
            useSudo: IS_LINUX,
            ensurePasswordlessSudo: false,
            requirePid: true,
            profilerType: 'memray',
        });
        if (!result) return false;

        const { pid: verifiedPid, workspaceFolder, pythonPath, profilerPath, useSudo } = result;
        if (!pythonPath) return false;

        const task = createMemrayProfileTask(
            workspaceFolder,
            {
                type: 'flamegraph',
                mode: 'attach',
                pid: verifiedPid,
                pythonPath,
                profilerPath,
                live: true,
                sudo: useSudo,
            },
            MEMORY_TASK_TERMINAL_NAME,
            false
        );
        await vscode.tasks.executeTask(task);
        return true;
    });
}
