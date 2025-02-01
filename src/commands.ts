import * as vscode from 'vscode';
import { extensions, CancellationTokenSource, commands } from 'vscode';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Jupyter } from '@vscode/jupyter-extension';
import * as path from 'path';
import * as os from 'os';
import { TextDecoder } from 'util';
import { toUnixPath } from './utilities/pathUtils';
import {
    checkAndInstallProfiler,
    getPythonPath,
    selectProfileFile,
    readTextFile,
    promptUserToOpenFolder,
} from './utilities/fsUtils';
import { FlamegraphPanel } from './flamegraphPanel';
import { extensionState } from './state';
import { Flamegraph } from './flamegraph';
import { NotebookCellMap } from './types';

async function executeCodeOnIPythonKernel(code: string): Promise<string | undefined> {
    let decodedOutput: string | undefined;
    const jupyterExt = extensions.getExtension<Jupyter>('ms-toolsai.jupyter');
    if (!jupyterExt) {
        throw new Error('Jupyter Extension not installed');
    }
    if (!jupyterExt.isActive) {
        await jupyterExt.activate();
    }
    let kernel = await jupyterExt.exports.kernels.getKernel(vscode.window.activeNotebookEditor!.notebook.uri);
    if (!kernel) {
        try {
            await commands.executeCommand('jupyter.restartkernel');
            kernel = await jupyterExt.exports.kernels.getKernel(vscode.window.activeNotebookEditor!.notebook.uri);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to restart Jupyter kernel');
            return undefined;
        }
    }
    if (!kernel) {
        vscode.window.showErrorMessage(
            'No IPython kernel found. Please start a kernel by running a cell in the Jupyter notebook.'
        );
        return undefined;
    }
    const tokenSource = new CancellationTokenSource();
    const ErrorMimeType = vscode.NotebookCellOutputItem.error(new Error('')).mime;
    const textDecoder = new TextDecoder();
    try {
        for await (const output of kernel.executeCode(code, tokenSource.token)) {
            for (const outputItem of output.items) {
                if (outputItem.mime === ErrorMimeType) {
                    const error = JSON.parse(textDecoder.decode(outputItem.data)) as Error;
                    vscode.window.showErrorMessage(
                        `Error attaching the profiler to the running process: ${error.name}: ${error.message},/n ${error.stack}`
                    );
                } else {
                    decodedOutput = textDecoder.decode(outputItem.data);
                    break;
                }
            }
            if (decodedOutput) break;
        }
    } catch (ex) {
        decodedOutput = undefined;
    } finally {
        tokenSource.dispose();
    }
    return decodedOutput;
}

/**
 * Handles the profile update event. This is called when a new profile is written to the file system.
 *
 * @param context - The extension context.
 * @param profileUri - The URI of the profile file.
 */
const handleProfileUpdate = async (
    context: vscode.ExtensionContext,
    profileUri: vscode.Uri,
    cellFilenameMap?: NotebookCellMap
) => {
    try {
        extensionState.currentFlamegraph = new Flamegraph(await readTextFile(profileUri), cellFilenameMap);
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
 * @returns The command registration.
 */
async function runTask(
    context: vscode.ExtensionContext,
    workspaceFolder: vscode.WorkspaceFolder,
    command: string,
    flags: string,
    cellFilenameMap?: NotebookCellMap
): Promise<void> {
    const profilePath = path.join(workspaceFolder.uri.fsPath, 'profile.pyspy');
    const profileUri = vscode.Uri.file(profilePath);

    const pySpyInstalled = await checkAndInstallProfiler();
    if (!pySpyInstalled) return;

    // Setup file watcher
    if (!extensionState.activeProfileWatcher) {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, 'profile.pyspy')
        );
        extensionState.activeProfileWatcher = watcher;
    }

    extensionState.activeProfileWatcher.onDidCreate(async () =>
        handleProfileUpdate(context, profileUri, cellFilenameMap)
    );
    extensionState.activeProfileWatcher.onDidChange(async () =>
        handleProfileUpdate(context, profileUri, cellFilenameMap)
    );

    const sudo = os.platform() === 'darwin' ? 'sudo ' : '';

    // Create task definition
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
        command: `${sudo}py-spy record --output profile.pyspy --format raw --full-filenames ${flags} ${command}`,
    };

    // Create the task
    const task = new vscode.Task(
        taskDefinition,
        workspaceFolder,
        'Py-spy profile',
        'py-spy',
        new vscode.ShellExecution(taskDefinition.command),
        []
    );

    // Execute the task
    await vscode.tasks.executeTask(task);
}

/**
 * Runs the profiler on the active file.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function runProfilerCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.runProfiler', async (fileUri?: vscode.Uri) => {
        // If called with a file URI, use that file. Otherwise, use the uri from the active editor
        let targetUri: vscode.Uri;
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

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
        if (!workspaceFolder) {
            promptUserToOpenFolder(targetUri);
            return;
        }

        const pythonPath = await getPythonPath();
        if (!pythonPath) {
            vscode.window.showErrorMessage('No Python interpreter selected. Please select a Python interpreter.');
            return;
        }

        const filePath = targetUri.fsPath;
        const command = `"${pythonPath}" "${filePath}"`;
        const flags = '--subprocesses';
        runTask(context, workspaceFolder, command, flags);
    });
}

/**
 * Attaches py-spy to the running process.
 *
 * @param context - The extension context.
 * @param flags - The flags to pass to py-spy, such as --subprocesses or --native.
 * @returns The command registration.
 */
export async function attach(
    context: vscode.ExtensionContext,
    flags: string,
    pid?: string,
    cellFilenameMap?: NotebookCellMap
) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        promptUserToOpenFolder();
        return;
    }

    if (!pid) {
        // Prompt user for PID
        pid = await vscode.window.showInputBox({
            prompt: 'Enter the Process ID (PID) to attach py-spy to:',
            placeHolder: '1234',
            validateInput: (value) => {
                // Validate that input is a number
                return /^\d+$/.test(value) ? null : 'Please enter a valid process ID (numbers only)';
            },
        });
        if (!pid) return;
    }
    runTask(context, workspaceFolder, `--pid ${pid}`, flags, cellFilenameMap);
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

async function getPidAndCellFilenameMap(
    notebook: vscode.NotebookDocument
): Promise<{ pid: string; cellFilenameMap: NotebookCellMap } | undefined> {
    const numCells = notebook.cellCount;

    let getFileNameCode = ``;
    for (let i = 0; i < numCells; i += 1) {
        const c = notebook.cellAt(i);
        const code = c.document.getText();
        getFileNameCode += `get_file_name(${JSON.stringify(code)}),`;
    }

    const code = `import os; from ipykernel.compiler import get_file_name; print(os.getpid(),${getFileNameCode})`;
    const output = await executeCodeOnIPythonKernel(code);
    if (!output) {
        return undefined;
    }

    const outputArray = output.split(' ').map((s) => s.trim());
    if (outputArray.length !== numCells + 1) {
        return undefined;
    }

    const cellFilenameMap: NotebookCellMap = new Map();

    const pid = outputArray[0];
    for (let i = 0; i < numCells; i += 1) {
        cellFilenameMap.set(toUnixPath(outputArray[i + 1]), {
            cellIndex: i,
            cellUri: `${toUnixPath(notebook.cellAt(i).document.uri.toString())}`,
            source: `${notebook.cellAt(i).document.getText()}`,
        });
    }
    return { pid, cellFilenameMap };
}

export function profileCellCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.profileCell', async (cell?: vscode.NotebookCell) => {
        if (!cell) {
            vscode.window.showErrorMessage('No cell selected for profiling');
            return;
        }
        const result = await getPidAndCellFilenameMap(cell.notebook);
        if (!result) {
            vscode.window.showErrorMessage('Failed to get PID and cell filename map');
            return;
        }
        const { pid, cellFilenameMap } = result;

        await attach(context, '--subprocesses', pid, cellFilenameMap);

        await commands.executeCommand(
            'notebook.cell.execute',
            { start: cell.index, end: cell.index + 1 },
            cell.notebook.uri
        );

        // send ctrl-c to terminal to stop py-spy
        const terminal = vscode.window.terminals.find((t) => t.name === 'Py-spy profile');
        if (terminal) {
            terminal.sendText('\u0003');
        }
    });
}

export function profileNotebookCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand(
        'flamegraph.profileNotebook',
        async (args?: { notebookEditor: vscode.NotebookEditor }) => {
            if (!args?.notebookEditor) {
                vscode.window.showErrorMessage('No notebook selected for profiling');
                return;
            }
            const notebookEditor = vscode.window.activeNotebookEditor;
            if (!notebookEditor) {
                vscode.window.showErrorMessage('No notebook selected for profiling');
                return;
            }
            const result = await getPidAndCellFilenameMap(notebookEditor.notebook);
            if (!result) {
                vscode.window.showErrorMessage('Failed to get PID and cell filename map');
                return;
            }
            const { pid, cellFilenameMap } = result;

            await attach(context, '--subprocesses', pid, cellFilenameMap);

            await commands.executeCommand('notebook.execute', notebookEditor.notebook.uri);

            // send ctrl-c to terminal to stop py-spy
            const terminal = vscode.window.terminals.find((t) => t.name === 'Py-spy profile');
            if (terminal) {
                terminal.sendText('\u0003');
            }
        }
    );
}
