import * as vscode from 'vscode';
import { commands } from 'vscode';
import * as os from 'os';
import { selectProfileFile, readTextFile, getPidAndCellFilenameMap, verify } from './utilities/fsUtils';
import { FlamegraphPanel } from './flamegraphPanel';
import { extensionState } from './state';
import { Flamegraph } from './flamegraph';
import { createMemrayProfileTask, createProfileTask } from './taskProvider';

const TASK_TERMINAL_NAME = 'Py-spy profile'; // Name of the terminal launched for the profiling task
const LINUX_BASED = os.platform() === 'darwin' || os.platform() === 'linux';

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
        const result = await verify({
            requireUri: true,
            requirePython: true,
            recommendSudo: true,
            requireSudo: false,
            requirePid: false,
            fileUri: fileUri || vscode.window.activeTextEditor?.document.uri,
        });
        if (!result) return;

        const { uri, pythonPath, pySpyPath, workspaceFolder } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            file: uri!.fsPath,
            pythonPath,
            profilerPath: pySpyPath,
        });
        await vscode.tasks.executeTask(task);
    });
}

/**
 * Runs the profiler on the active file.
 *
 * @returns The command registration.
 */
export function runMemrayProfilerCommand() {
    return vscode.commands.registerCommand('flamegraph.runMemrayProfiler', async (fileUri?: vscode.Uri) => {
        const result = await verify({
            requireUri: true,
            requirePython: true,
            recommendSudo: true,
            requireSudo: false,
            requirePid: false,
            fileUri: fileUri || vscode.window.activeTextEditor?.document.uri,
        });
        if (!result) return;

        const { uri, pythonPath, workspaceFolder } = result;

        const task = createMemrayProfileTask(workspaceFolder, {
            type: 'flamegraph',
            file: uri!.fsPath,
            pythonPath,
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
            recommendSudo: true,
            requireSudo: false,
            requirePid: false,
            fileUri: fileUri || vscode.window.activeTextEditor?.document.uri,
        });
        if (!result) return;

        const { uri, pythonPath, pySpyPath, workspaceFolder } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            pythonPath,
            profilerPath: pySpyPath,
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
            recommendSudo: true,
            requireSudo: false,
            requirePid: false,
        });
        if (!result) return;

        const { pythonPath, pySpyPath, workspaceFolder } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            pythonPath,
            profilerPath: pySpyPath,
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
        recommendSudo: LINUX_BASED,
        requireSudo: requireSudoAccess,
        requirePid: true,
        pid,
    });
    if (!result) return false;

    const { pid: verifiedPid, pySpyPath, workspaceFolder } = result;

    const task = createProfileTask(
        workspaceFolder,
        {
            type: 'flamegraph',
            profilerPath: pySpyPath,
            pid: verifiedPid,
            sudo: LINUX_BASED,
        },
        TASK_TERMINAL_NAME,
        silent
    );
    await vscode.tasks.executeTask(task);
    return true;
}

/**
 * Attaches py-spy to the running process with the --subprocesses flag.
 *
 * @returns The command registration.
 */
export function attachProfilerCommand() {
    return vscode.commands.registerCommand('flamegraph.attachProfiler', async () => {
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
            recommendSudo: LINUX_BASED,
            requireSudo: false,
            requirePid: true,
        });
        if (!result) return false;

        const { pid: verifiedPid, pySpyPath, workspaceFolder } = result;

        const task = createProfileTask(workspaceFolder, {
            type: 'flamegraph',
            profilerPath: pySpyPath,
            pid: verifiedPid,
            mode: 'top',
            sudo: LINUX_BASED,
        });
        await vscode.tasks.executeTask(task);
        return true;
    });
}
