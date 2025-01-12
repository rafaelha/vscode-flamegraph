import * as vscode from 'vscode';
import { Uri, Webview } from 'vscode';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';

const execAsync = promisify(exec);
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
    // get the python path from the python extension
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    if (pythonExtension) {
        await pythonExtension.activate();
        const details = await pythonExtension.exports.settings.getExecutionDetails();
        return details.execCommand.join(' ');
    }
    // otherwise fallback to the python path from the python config
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

        if (installPySpy !== 'Yes') return false;

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Installing py-spy...',
                cancellable: false,
            },
            async (progress) => {
                return new Promise<boolean>((resolve) => {
                    const install = spawn('pip', ['install', 'py-spy']);
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

                    install.on('close', (code: number) => {
                        if (code === 0) {
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
