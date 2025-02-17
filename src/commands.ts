import * as vscode from 'vscode';
import { commands } from 'vscode';
import * as path from 'path';
import * as os from 'os';
import {
    getPythonPath,
    selectProfileFile,
    readTextFile,
    promptUserToOpenFolder,
    getPidAndCellFilenameMap,
    verifyPyspy,
    selectPid,
} from './utilities/fsUtils';
import { FlamegraphPanel } from './flamegraphPanel';
import { extensionState } from './state';
import { Flamegraph } from './flamegraph';
import { NotebookCellMap } from './types';

const TASK_TERMINAL_NAME = 'Py-spy profile'; // Name of the terminal launched for the profiling task

/**
 * Handles the profile update event. This is called when a new profile is written to the file system.
 *
 * @param context - The extension context.
 * @param profileUri - The URI of the profile file.
 */
const handleProfileUpdate = async (
    context: vscode.ExtensionContext,
    profileUri: vscode.Uri,
    filenameToJupyterCellMap?: NotebookCellMap
) => {
    try {
        extensionState.currentFlamegraph = new Flamegraph(await readTextFile(profileUri), filenameToJupyterCellMap);
        extensionState.profileUri = profileUri;
        extensionState.focusNode = [0];
        extensionState.profileVisible = true;
        extensionState.updateUI();
        FlamegraphPanel.render(context.extensionUri);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open profile: ${error}`);
    }
    // Cleanup watcher after profile is loaded
    extensionState.activeProfileWatcher = undefined;
};

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

        extensionState.currentFlamegraph = new Flamegraph(await readTextFile(fileUri));
        extensionState.profileUri = fileUri;
        extensionState.focusNode = [0];
        extensionState.profileVisible = true;
        extensionState.updateUI();
        FlamegraphPanel.render(context.extensionUri);
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
 * Create a new vscode task to run py-spy and monitor the profile file.
 *
 * @param context - The extension context.
 * @param workspaceFolder - The workspace folder.
 * @param command - The command to run.
 * @param flags - The flags to pass to py-spy.
 * @param withSudo - Whether to run the command with sudo.
 * @param filenameToJupyterCellMap - A map of filenames to Jupyter cell indices.
 * @returns The command registration.
 */
async function runTask(
    context: vscode.ExtensionContext,
    workspaceFolder: vscode.WorkspaceFolder,
    command: string,
    flags: string,
    useSudo: boolean,
    filenameToJupyterCellMap?: NotebookCellMap
): Promise<void> {
    const profilePath = path.join(workspaceFolder.uri.fsPath, 'profile.pyspy');
    const profileUri = vscode.Uri.file(profilePath);

    // Setup file watcher
    if (!extensionState.activeProfileWatcher) {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, 'profile.pyspy')
        );
        extensionState.activeProfileWatcher = watcher;
    }

    extensionState.activeProfileWatcher.onDidCreate(async () =>
        handleProfileUpdate(context, profileUri, filenameToJupyterCellMap)
    );
    extensionState.activeProfileWatcher.onDidChange(async () =>
        handleProfileUpdate(context, profileUri, filenameToJupyterCellMap)
    );

    const sudo = useSudo ? 'sudo ' : '';

    // Create task definition
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
        command: `${sudo}py-spy record --output profile.pyspy --format raw --full-filenames ${flags} ${command}`,
    };

    // Create the task
    const task = new vscode.Task(
        taskDefinition,
        workspaceFolder,
        TASK_TERMINAL_NAME,
        'py-spy',
        new vscode.ShellExecution(taskDefinition.command),
        []
    );

    // Execute the task
    await vscode.tasks.executeTask(task);
}

async function runCommand(
    context: vscode.ExtensionContext,
    fileUri?: vscode.Uri,
    requireUri: boolean = true,
    option: string = ''
) {
    // If called with a file URI, use that file. Otherwise, use the uri from the active editor
    let targetUri: vscode.Uri | undefined;
    if (requireUri || fileUri) {
        if (fileUri) {
            targetUri = fileUri;
        } else {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage(
                    'No file is currently selected. Please open a Python file in an editor tab and try again.'
                );
                return;
            }
            targetUri = editor.document.uri;
        }

        if (!targetUri.fsPath.endsWith('.py')) {
            vscode.window.showErrorMessage(
                'Only Python files are supported. Please open a Python file in an editor tab and try again.'
            );
            return;
        }
    }

    const workspaceFolder = targetUri
        ? vscode.workspace.getWorkspaceFolder(targetUri)
        : vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        promptUserToOpenFolder(targetUri);
        return;
    }

    const pythonPath = await getPythonPath();
    if (!pythonPath) {
        vscode.window.showErrorMessage('No Python interpreter selected. Please select a Python interpreter.');
        return;
    }

    const needsSudoAccess = os.platform() === 'darwin';
    const success = await verifyPyspy(needsSudoAccess, false);
    if (!success) return;

    const filePath = targetUri?.fsPath ?? '';
    const command = `-- "${pythonPath}" ${option} "${filePath}"`;
    const flags = '--subprocesses';
    runTask(context, workspaceFolder, command, flags, needsSudoAccess);
}

/**
 * Runs the profiler on the active file.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function runProfilerCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.runProfiler', async (fileUri?: vscode.Uri) => {
        await runCommand(context, fileUri);
    });
}

export function runPytestFileCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.runPytestFile', async (fileUri?: vscode.Uri) => {
        await runCommand(context, fileUri, true, '-m pytest');
    });
}

export function runAllPytestsCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.runAllPytests', async () => {
        await runCommand(context, undefined, false, '-m pytest');
    });
}

/**
 * Attaches py-spy to the running process.
 *
 * @param context - The extension context.
 * @param flags - The flags to pass to py-spy, such as --subprocesses or --native.
 * @param pid - The process ID (PID) to attach py-spy to.
 * @param filenameToJupyterCellMap - A map of filenames to Jupyter cell indices.
 * @returns The command registration.
 */
export async function attach(
    context: vscode.ExtensionContext,
    flags: string,
    pid?: string,
    filenameToJupyterCellMap?: NotebookCellMap
) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        promptUserToOpenFolder();
        return;
    }
    const needsSudoAccess = os.platform() === 'darwin' || os.platform() === 'linux';
    const success = await verifyPyspy(needsSudoAccess, needsSudoAccess);
    if (!success) return;

    if (!pid) {
        pid = await selectPid();
    }
    runTask(context, workspaceFolder, `--pid ${pid}`, flags, needsSudoAccess, filenameToJupyterCellMap);
}

/**
 * Attaches py-spy to the running process with the --subprocesses flag.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function attachProfilerCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.attachProfiler', async () => {
        await attach(context, '--subprocesses');
    });
}

/**
 * Attaches py-spy to the running process with the --native flag.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function attachNativeProfilerCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.attachNativeProfiler', async () => {
        await attach(context, '--native');
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
        FlamegraphPanel.render(context.extensionUri);
    });
}

/**
 * Helper function to handle notebook profiling logic.
 *
 * @param context - The extension context.
 * @param notebook - The notebook document.
 * @param executeCommand - The command to execute after profiling.
 */
async function handleNotebookProfiling(
    context: vscode.ExtensionContext,
    notebook: vscode.NotebookDocument,
    executeCommand: () => Promise<void>
) {
    const result = await getPidAndCellFilenameMap(notebook);
    if (!result) return;

    const { pid, filenameToJupyterCellMap } = result;

    await attach(context, '--subprocesses', pid, filenameToJupyterCellMap);

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
 * @param context - The extension context.
 * @returns The command registration.
 */
export function profileCellCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.profileCell', async (cell?: vscode.NotebookCell) => {
        if (!cell) {
            return;
        }

        await handleNotebookProfiling(context, cell.notebook, async () =>
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
 * @param context - The extension context.
 * @returns The command registration.
 */
export function profileNotebookCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.profileNotebook', async () => {
        const notebookEditor = vscode.window.activeNotebookEditor;
        if (!notebookEditor) {
            vscode.window.showErrorMessage('No notebook selected for profiling. Please open a notebook and try again.');
            return;
        }

        await handleNotebookProfiling(context, notebookEditor.notebook, async () =>
            commands.executeCommand('notebook.execute', notebookEditor.notebook.uri)
        );
    });
}

export function topCommand() {
    return vscode.commands.registerCommand('flamegraph.top', async () => {
        const pid = await selectPid();
        if (!pid) return;

        const sudo = os.platform() === 'darwin' || os.platform() === 'linux' ? 'sudo ' : '';

        // Create task definition
        const taskDefinition: vscode.TaskDefinition = {
            type: 'shell',
            command: `${sudo}py-spy top --pid ${pid}`,
        };
        // Create the task
        const task = new vscode.Task(
            taskDefinition,
            vscode.workspace.workspaceFolders![0],
            TASK_TERMINAL_NAME,
            'py-spy',
            new vscode.ShellExecution(taskDefinition.command),
            []
        );

        // Execute the task
        await vscode.tasks.executeTask(task);
    });
}
