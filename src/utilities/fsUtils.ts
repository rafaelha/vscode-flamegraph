/* eslint-disable import/no-extraneous-dependencies */
import * as vscode from 'vscode';
import * as path from 'path';
import { Uri, Webview } from 'vscode';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { PythonExtension } from '@vscode/python-extension';
import { Jupyter } from '@vscode/jupyter-extension';

export const execAsync = promisify(exec);
/**
 *
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
    return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

/**
 * Reads a text file from the given URI.
 *
 * @param fileUri - The URI of the file to read.
 * @returns The contents of the file as a string.
 */
export async function readTextFile(fileUri: vscode.Uri): Promise<string> {
    const data = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(data).toString('utf8');
}

/**
 * Opens a file dialog to select a profile file.
 *
 * @returns The URI of the selected file or undefined if no file is selected.
 */
export async function selectProfileFile(): Promise<vscode.Uri | undefined> {
    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select profile file',
        filters: {
            'All files': ['*'],
        },
    };
    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) return fileUri[0];
    return undefined;
}

/**
 * Gets the Python path from the Python extension or the Python configuration.
 *
 * @returns The Python path.
 */
export async function getPythonPath(): Promise<string | undefined> {
    const pythonApi: PythonExtension = await PythonExtension.api();
    const { environments } = pythonApi;
    const environmentPath = environments.getActiveEnvironmentPath();
    const environment = await environments.resolveEnvironment(environmentPath);
    if (environment) {
        return environment.path;
    }
    const pythonConfig = vscode.workspace.getConfiguration('python');
    return pythonConfig.get<string>('pythonPath');
}

/**
 * Checks if py-spy is installed. If it is not, prompts the user and installs it if they choose to.
 *
 * @returns Whether py-spy was installed.
 */
export async function checkAndInstallProfiler(): Promise<boolean> {
    try {
        await execAsync('py-spy --version');
        return true;
    } catch {
        const installPySpy = await vscode.window.showInformationMessage(
            'py-spy is not installed. Would you like to install it?',
            'Yes',
            'No'
        );

        // get the python path for installying py-spy via the command
        // `global/path/python-m pip install py-spy`
        // TODO: this section should be improved. Do we really want to install py-spy globally?
        let pythonPath = 'python3';
        try {
            execAsync('python3 --version'); // this should work for linux and macos
        } catch {
            try {
                execAsync('python --version'); // this should work for windows
                pythonPath = 'python';
            } catch {
                // otherwise fallback to the python path selected in the Python extension
                const interpreterPath = await getPythonPath();
                if (!interpreterPath) {
                    vscode.window.showErrorMessage('Please select a Python interpreter.');
                    return false;
                }
                pythonPath = interpreterPath;
            }
        }

        if (installPySpy !== 'Yes') return false;

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Installing py-spy...',
                cancellable: true,
            },
            async (progress) => {
                return new Promise<boolean>((resolve) => {
                    const install = spawn(pythonPath, ['-m', 'pip', 'install', 'py-spy']);
                    let errorOutput = '';

                    install.stdout.on('data', (data: Buffer) => {
                        const message = data.toString().trim();
                        progress.report({ message });
                    });

                    install.stderr.on('data', (data: Buffer) => {
                        const error = data.toString().trim();
                        errorOutput += error;
                        progress.report({ message: error });
                    });

                    install.on('error', (error) => {
                        errorOutput += error;
                        resolve(false);
                    });

                    install.on('close', (code: number) => {
                        if (code === 0 && errorOutput === '') {
                            vscode.window.showInformationMessage('py-spy installed successfully');
                            resolve(true);
                        } else {
                            vscode.window.showErrorMessage(
                                `Failed to install py-spy: ${errorOutput || 'Unknown error'}`
                            );
                            resolve(false);
                        }
                    });
                });
            }
        );
    }
}

/**
 * Prompts the user to open a folder.
 *
 * @param currentFile - The current file.
 */
export function promptUserToOpenFolder(currentFile?: vscode.Uri) {
    vscode.window
        .showErrorMessage(
            currentFile
                ? [
                      `The file ${path.basename(currentFile.fsPath)} is not part of a workspace or folder.`,
                      'Please open the folder containing the file.',
                  ].join('\n')
                : 'The Flamegraph extension requires a workspace or folder to be open in VS Code.',
            { modal: true },
            'Open Folder'
        )
        .then((selection) => {
            if (selection === 'Open Folder') {
                vscode.commands.executeCommand('workbench.action.files.openFolder');
            }
        });
}

/**
 * Executes code on the IPython kernel.
 *
 * @param code - The code to execute.
 * @returns The output of the code.
 */
export async function executeCodeOnIPythonKernel(code: string): Promise<string | undefined> {
    let decodedOutput: string | undefined;
    const jupyterExt = vscode.extensions.getExtension<Jupyter>('ms-toolsai.jupyter');
    if (!jupyterExt) {
        vscode.window.showErrorMessage('Jupyter Extension not installed. Please install the Jupyter extension.');
        return undefined;
    }
    if (!jupyterExt.isActive) {
        await jupyterExt.activate();
    }
    let kernel = await jupyterExt.exports.kernels.getKernel(vscode.window.activeNotebookEditor!.notebook.uri);
    if (!kernel) {
        await vscode.commands.executeCommand('jupyter.restartkernel');
        kernel = await jupyterExt.exports.kernels.getKernel(vscode.window.activeNotebookEditor!.notebook.uri);
    }
    if (!kernel) {
        vscode.window.showErrorMessage('No IPython kernel found. Execute a cell in the notebook and try again.');
        return undefined;
    }
    const tokenSource = new vscode.CancellationTokenSource();
    const ErrorMimeType = vscode.NotebookCellOutputItem.error(new Error('')).mime;
    const textDecoder = new TextDecoder();
    try {
        for await (const output of kernel.executeCode(code, tokenSource.token)) {
            for (const outputItem of output.items) {
                if (outputItem.mime === ErrorMimeType) {
                    const error = JSON.parse(textDecoder.decode(outputItem.data)) as Error;
                    vscode.window.showErrorMessage(
                        `Could not get notebook kernel info:${error.name}. ${error.message},/n ${error.stack}`
                    );
                } else {
                    decodedOutput = textDecoder.decode(outputItem.data);
                    break;
                }
            }
            if (decodedOutput) break;
        }
    } catch (ex) {
        vscode.window.showErrorMessage(`Could not get notebook kernel info to start profiling: ${ex}`);
        decodedOutput = undefined;
    } finally {
        tokenSource.dispose();
    }
    return decodedOutput;
}
