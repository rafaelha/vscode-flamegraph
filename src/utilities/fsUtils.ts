import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { PythonExtension } from '@vscode/python-extension';
import { Uri, Webview } from 'vscode';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { Jupyter } from '@vscode/jupyter-extension';
import { NotebookCellMap } from '../types';
import { toUnixPath } from './pathUtils';

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
    const pythonExtension = vscode.extensions.getExtension<PythonExtension>('ms-python.python');
    if (pythonExtension) {
        await pythonExtension.activate();

        const { environments } = pythonExtension.exports;
        const environmentPath = environments.getActiveEnvironmentPath();
        const environment = await environments.resolveEnvironment(environmentPath);
        if (environment) {
            return environment.path;
        }
    }
    const pythonConfig = vscode.workspace.getConfiguration('python');
    return pythonConfig.get<string>('pythonPath');
}

/**
 * On MacOS, checks if py-spy is given passwordless sudo access in the sudoers file.
 * Returns true on all other platforms. On MacOS the user will be prompted to add py-spy to the sudoers file
 * if they don't have passwordless sudo access. The user will be given a link to
 * https://github.com/rafaelha/vscode-flamegraph/blob/e5b38dc6c87fee310c5562fcc4a3c6178040bfb3/docs/macos-setup.md
 *
 * @param modal - Whether the VS Code error/info message should be modal.
 * @returns Whether py-spy is installed and has passwordless sudo access.
 */
export async function checkSudoAccess(modal: boolean = true): Promise<boolean> {
    const permaLink =
        'https://github.com/rafaelha/vscode-flamegraph/blob/e5b38dc6c87fee310c5562fcc4a3c6178040bfb3/docs/macos-setup.md';
    // Check for passwordless sudo access to py-spy on macOS
    if (os.platform() === 'darwin' || os.platform() === 'linux') {
        try {
            // Use -n flag to prevent sudo from asking for a password
            await new Promise((resolve, reject) => {
                exec('sudo -n py-spy --version', (error: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(undefined);
                    }
                });
            });
        } catch (error) {
            if (modal) {
                vscode.window
                    .showErrorMessage(
                        'Passwordless sudo access is required for py-spy to profile notebooks. Please add py-spy to your sudoers file.',
                        { modal },
                        'See instructions'
                    )
                    .then((selection) => {
                        if (selection === 'See instructions') {
                            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(permaLink));
                        }
                    });
                return false;
            }
            vscode.window
                .showInformationMessage(
                    'Root access is required to run py-spy. Please enter your password in the terminal. For a better experience, consider adding py-spy to your sudoers file.',
                    { modal },
                    'See instructions'
                )
                .then((selection) => {
                    if (selection === 'See instructions') {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(permaLink));
                    }
                });
        }
    }
    return true;
}

/**
 * Checks if py-spy is installed.
 *
 * @returns Whether py-spy is installed.
 */
async function isPySpyInstalled(): Promise<boolean> {
    try {
        await execAsync('py-spy --version');
        return true;
    } catch {
        return false;
    }
}
/**
 * Guides user through installing py-spy if it is not installed.
 *
 * @returns Whether py-spy was installed.
 */
export async function checkAndInstallProfiler(): Promise<boolean> {
    const isInstalled = await isPySpyInstalled();
    if (isInstalled) return true;

    const installPySpy = await vscode.window.showInformationMessage(
        'py-spy is not installed. Would you like to install it?',
        'Yes',
        'No'
    );

    if (installPySpy !== 'Yes') return false;

    // get the python path for installying py-spy via the command
    // `global/path/python -m pip install py-spy`
    // TODO: improve the logic in this section
    let pythonPath = 'python3';
    try {
        execAsync('python3 --version'); // this should work for linux and macos
    } catch {
        try {
            execAsync('python --version'); // this should work for windows
            pythonPath = 'python';
        } catch {
            return false;
        }
    }

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

                install.on('close', async () => {
                    if (await isPySpyInstalled()) {
                        vscode.window.showInformationMessage('py-spy installed successfully.');
                        resolve(true);
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to install py-spy. Please install it manually into your global python environment with "pip install py-spy". ${errorOutput || 'Unknown error'}`
                        );
                        resolve(false);
                    }
                });
            });
        }
    );
}

/**
 * Checks if py-spy is installed and has sudo access on MacOs.
 *
 * @returns Whether py-spy is installed and has sudo access.
 */
export async function verifyPyspy(
    recommendSudoAccess: boolean = false,
    requireSudoAccess: boolean = false
): Promise<boolean> {
    const success = await checkAndInstallProfiler();
    if (!success) return false;
    if (recommendSudoAccess) {
        const hasSudoAccess = await checkSudoAccess(requireSudoAccess);
        return hasSudoAccess || !requireSudoAccess;
    }
    return true;
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

/**
 * Gets the PID and cell filename map for a notebook. When executing a notebook, the kernel generates temporary files
 * for each notebook cell, with filenames given by the hash of the cell's content. This function does the following:
 * 1. It retrieves the PID of the kernel.
 * 2. It retrieves the filenames of the temporary files generated for each cell and maps them onto URIs of the actual
 *    notebook cells.
 *
 * This is done by executing the following code on the IPython kernel:
 *
 * ```python
 * import os; from ipykernel.compiler import get_file_name
 * print(os.getpid())
 * print("<code of cell 0>")
 * print("<code of cell 1>")
 * ...
 * ```
 *
 * @param notebook - The notebook document.
 * @returns The PID and cell filename map. This is a map from temporary filenames to the actual notebook cell URIs and
 * cell indices.
 */
export async function getPidAndCellFilenameMap(
    notebook: vscode.NotebookDocument
): Promise<{ pid: string; filenameToJupyterCellMap: NotebookCellMap } | undefined> {
    const numCells = notebook.cellCount;

    const getFileNameCode = Array.from({ length: numCells })
        .map((_, i) => notebook.cellAt(i).document.getText())
        .map((code) => `print(get_file_name(${JSON.stringify(code)}));`)
        .join('');

    const code = `import os; from ipykernel.compiler import get_file_name; print(os.getpid());${getFileNameCode}`;
    const output = await executeCodeOnIPythonKernel(code);
    if (!output) {
        return undefined;
    }

    const outputArray = output.split('\n').map((s) => s.trim());
    if (outputArray.length < numCells + 1) {
        if (outputArray.length >= 1) {
            return { pid: outputArray[0], filenameToJupyterCellMap: new Map() };
        }
        return undefined;
    }

    const filenameToJupyterCellMap: NotebookCellMap = new Map();

    const pid = outputArray[0];
    for (let i = 0; i < numCells; i += 1) {
        filenameToJupyterCellMap.set(toUnixPath(outputArray[i + 1]), {
            cellIndex: i,
            cellUri: `${toUnixPath(notebook.cellAt(i).document.uri.toString())}`,
            source: `${notebook.cellAt(i).document.getText()}`,
        });
    }
    return { pid, filenameToJupyterCellMap };
}

/**
 * Gets the command to list running Python processes for the current platform.
 * @returns The command to list running Python processes.
 */
function getProcessListCommand(): string {
    switch (process.platform) {
        case 'darwin': // macOS
            return `ps -eo pid,%cpu,command | grep python | grep -v grep | sort -k2 -nr | awk '{print $1, $3, $4, $5, $6, $7, $8, $9, $10}'`;
        case 'linux':
            return `ps -eo pid,%cpu,cmd --sort=-%cpu | grep python | grep -v grep | awk '{ $2=""; print $0 }'`;
        case 'win32': // Windows
            return `powershell.exe -Command "Get-WmiObject Win32_Process | Where-Object { $_.Name -match 'python' } | Sort-Object CPU -Descending | Select-Object ProcessId, CommandLine"`;
        default:
            return '';
    }
}

/**
 * Gets a list of running Python processes.
 * @returns Promise<Array<{pid: string, command: string}>>
 * @throws Error if platform is unsupported or command fails
 */
export async function getPythonProcesses(): Promise<Array<{ pid: string; command: string }>> {
    const command = getProcessListCommand();
    if (command === '') {
        throw new Error('Unsupported platform');
    }

    try {
        const { stdout } = await execAsync(command);
        return stdout
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
                const [pid, ...commandParts] = line.trim().split(' ');
                // Only return the process if pid is a valid number
                if (!Number.isNaN(Number(pid))) {
                    return {
                        pid,
                        command: commandParts.join(' '),
                    };
                }
                return null;
            })
            .filter((process): process is { pid: string; command: string } => process !== null);
    } catch (error) {
        // exit code 1 means no processes found, return empty array
        if (error instanceof Error && (error as any).code === 1) {
            return [];
        }
        throw error;
    }
}

/**
 * Prompts the user to enter a process ID.
 * @returns The entered PID or undefined if cancelled
 */
export async function promptForPid(): Promise<string | undefined> {
    return vscode.window.showInputBox({
        prompt: 'Enter the Process ID (PID) to attach py-spy to:',
        placeHolder: '1234',
        validateInput: (value) => {
            return /^\d+$/.test(value) ? null : 'Please enter a valid process ID (numbers only)';
        },
    });
}

/**
 * Prompts user to select a Python process ID either from running processes or manual entry.
 * @returns Promise<string | undefined> Selected PID or undefined if selection was cancelled
 */
export async function selectPid(): Promise<string | undefined> {
    const processes = await getPythonProcesses();

    // If no processes found, fallback to manual entry
    if (processes.length === 0) {
        return promptForPid();
    }

    // Create QuickPick items from processes
    const items = [
        ...processes.map((proc) => ({
            label: proc.pid,
            description: proc.command,
        })),
        {
            label: 'Other PID',
            description: 'Enter a process ID manually',
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Python process to attach py-spy',
        title: 'Python Processes',
    });

    if (!selected) {
        return undefined;
    }

    return selected.label === 'Other PID' ? promptForPid() : selected.label;
}
