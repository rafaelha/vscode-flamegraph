import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { PythonExtension } from '@vscode/python-extension';
import { Uri, Webview } from 'vscode';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { Jupyter } from '@vscode/jupyter-extension';
import { NotebookCellMap, UriToCodeMap } from '../types';
import { toUnixPath } from './pathUtils';
import { extensionState } from '../state';

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
 * Checks if sudo is installed.
 * @returns Whether sudo is installed.
 */
async function checkSudoInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
        exec(`sudo --version`, (error: any) => {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * On MacOS or Linux, checks if py-spy is given passwordless sudo access in the sudoers file.
 * Returns true on all other platforms. The user will be prompted to add py-spy to their sudoers file
 * if they don't have passwordless sudo access. The user will be given a link to the setup instructions
 * for their platform.
 *
 * @param pySpyPath - The path to py-spy.
 * @param modal - Whether the VS Code error/info message should be modal.
 * @returns Whether py-spy is installed and has passwordless sudo access.
 */
export async function checkSudoAccess(
    pySpyPath: string,
    modal: boolean = true,
    profilerName: string = 'py-spy'
): Promise<boolean> {
    if (os.platform() === 'darwin' || os.platform() === 'linux') {
        const userName = await execAsync('whoami');
        if (pySpyPath === 'py-spy') {
            pySpyPath = (await execAsync('which py-spy')).stdout.trim();
        }
        const permaLink = `https://www.rafaelha.dev/sudoers?path=${pySpyPath.replace(/ /g, '\\ ')}&os=${os.platform()}&username=${userName.stdout.trim()}&profiler=${profilerName}`;
        try {
            // Use -n flag to prevent sudo from asking for a password
            await new Promise((resolve, reject) => {
                exec(`sudo -n "${pySpyPath}" --version`, (error: any) => {
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
                        `Passwordless sudo access is required for ${profilerName} to profile notebooks. Please add ${profilerName} to your sudoers file.`,
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
                    `Root access is required to run ${profilerName}. Please enter your password in the terminal. For a better experience, consider adding ${profilerName} to your sudoers file.`,
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
 * Checks if py-spy is installed and returns the path to it. It will first be checked if py-spy is installed in the
 * global python environment. If not, it will be checked if py-spy is installed in the currently selected virtual
 * environment.
 *
 * @returns The path to py-spy or undefined if it is not installed.
 */
export async function getPyspyPath(): Promise<string | undefined> {
    try {
        await execAsync(`py-spy --version`);
        return (await execAsync(`which py-spy`)).stdout.trim();
    } catch {
        try {
            // get python path
            const pythonPath = await getPythonPath();
            if (!pythonPath) return undefined;
            const profilerPath = path.join(path.dirname(pythonPath), 'py-spy');
            await execAsync(`"${profilerPath}" --version`);
            return profilerPath;
        } catch {
            return undefined;
        }
    }
}

/**
 * Checks if memray is installed in the Python environment.
 *
 * @returns The command to run memray or undefined if it is not installed.
 */
export async function getMemrayPath(): Promise<string | undefined> {
    try {
        const pythonPath = await getPythonPath();
        if (!pythonPath) return undefined;

        const profilerPath = path.join(path.dirname(pythonPath), 'memray');
        await execAsync(`"${profilerPath}" --version`);
        return profilerPath;
    } catch {
        return undefined;
    }
}

/**
 * Generic function to install a Python package using pip.
 *
 * @param packageName - The name of the package to install.
 * @param pythonPath - The path to the Python interpreter.
 * @param silent - Whether to show a notification when the package is installed successfully.
 * @returns The path to the installed package or undefined if installation fails.
 */
async function installPythonPackage(
    packageName: string,
    pythonPath: string,
    getPackagePath: () => Promise<string | undefined>,
    silent: boolean = false
): Promise<string | undefined> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${packageName}...`,
            cancellable: true,
        },
        async (progress) => {
            return new Promise<string | undefined>((resolve) => {
                const install = spawn(pythonPath, ['-m', 'pip', 'install', packageName]);
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
                    resolve(undefined);
                });

                install.on('close', async () => {
                    // check if package was installed successfully
                    const packagePath = await getPackagePath();
                    if (packagePath) {
                        if (!silent) {
                            vscode.window.showInformationMessage(`${packageName} installed successfully.`);
                        }
                        resolve(packagePath);
                    } else {
                        if (!silent) {
                            vscode.window.showErrorMessage(
                                `Failed to install ${packageName}. Please install it manually with "pip install ${packageName}". ${errorOutput || ''}`
                            );
                        }
                        resolve(undefined);
                    }
                });
            });
        }
    );
}

/**
 * Get the command to run memray. If memray is not found, the user will be guided to install it.
 *
 * @returns The command to run memray or undefined if installation is aborted or fails.
 */
export async function getOrInstallMemray(): Promise<string | undefined> {
    const memrayPath = await getMemrayPath();
    if (memrayPath) return memrayPath;

    const installMemray = await vscode.window.showInformationMessage(
        'memray is not installed. Would you like to install it?',
        'Yes',
        'No'
    );

    if (installMemray !== 'Yes') return undefined;

    // Get python path from the current environment
    const pythonPath = await getPythonPath();
    if (!pythonPath) {
        vscode.window.showErrorMessage('No Python interpreter found. Please configure a Python interpreter first.');
        return undefined;
    }

    // Install memray using the generic installation function
    return installPythonPackage('memray', pythonPath, getMemrayPath);
}

/**
 * Get the path to py-spy. If py-spy is not found, the user will be guided to install it.
 * The global python environment will be checked first, then the currently selected virtual environment.
 * For installation py-spy, the global python environment is preferred
 *
 * @returns The path to py-spy or undefined if installation is aborted or fails.
 */
export async function getOrInstallPySpy(): Promise<string | undefined> {
    const pySpyPath = await getPyspyPath();
    if (pySpyPath) return pySpyPath;

    const installPySpy = await vscode.window.showInformationMessage(
        'py-spy is not installed. Would you like to install it?',
        'Yes',
        'No'
    );

    if (installPySpy !== 'Yes') return undefined;

    let pythonPath: string | undefined;
    const pythonExtensionPythonPath = await getPythonPath();
    if (os.platform() !== 'linux') {
        // Try to get the global python path
        try {
            // Check specifically for pip availability
            await execAsync('python3 -m pip --version'); // this should work for macos
            pythonPath = 'python3';
        } catch {
            try {
                // Fix typo in pip check and ensure pip is available
                await execAsync('python -m pip --version'); // this should work for windows
                pythonPath = 'python';
            } catch {
                // if both approaches fail, we will use the python path from the python extension below
            }
        }

        if (pythonPath) {
            const result = await installPythonPackage(
                'py-spy',
                pythonPath,
                getPyspyPath,
                pythonExtensionPythonPath !== undefined
            );
            if (result) {
                return result;
            }
            // if the installation fails, we will try to install it using the selected python interpreter path
            // Global installation is preferred since py-spy will be available across all environments.
            // It is also convenient for MacOS users who only have to add the global py-spy to their sudoers file.
        }
    }
    // If we get here, we will try to install py-spy using the python path from the python extension
    if (!pythonExtensionPythonPath) {
        return undefined;
    }
    return installPythonPackage('py-spy', pythonExtensionPythonPath, getPyspyPath);
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
): Promise<{ pid: string; filenameToJupyterCell: NotebookCellMap; uriToCode: UriToCodeMap } | undefined> {
    const numCells = notebook.cellCount;

    const getFileNameCode = Array.from({ length: numCells })
        // make sure to replace CRLF line endings with LF
        .map((_, i) => notebook.cellAt(i).document.getText().replace(/\r\n/g, '\n'))
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
            return { pid: outputArray[0], filenameToJupyterCell: new Map(), uriToCode: new Map() };
        }
        return undefined;
    }

    const filenameToJupyterCell: NotebookCellMap = new Map();
    const uriToCode: UriToCodeMap = new Map();

    const pid = outputArray[0];
    for (let i = 0; i < numCells; i += 1) {
        const source = notebook.cellAt(i).document.getText();
        const cellUri = toUnixPath(notebook.cellAt(i).document.uri.toString());
        filenameToJupyterCell.set(toUnixPath(outputArray[i + 1]), {
            cellIndex: i,
            cellUri,
        });
        uriToCode.set(cellUri, source);
    }

    return { pid, filenameToJupyterCell, uriToCode };
}

/**
 * Gets the command to list running Python processes for the current platform.
 * @returns The command to list running Python processes.
 */
function getProcessListCommand(): string {
    switch (process.platform) {
        case 'darwin': // macOS
            return `ps -eo pid,%cpu,command | grep -E 'python|ray::' | grep -v 'ray::IDLE' | grep -v grep | sort -k2 -nr | awk '{print $1, $3, $4, $5, $6, $7, $8, $9, $10}'`;
        case 'linux':
            return `ps -eo pid,%cpu,cmd --sort=-%cpu | grep -E 'python|ray::' | grep -v 'ray::IDLE' | grep -v grep | awk '{ $2=""; print $0 }'`;
        case 'win32':
            return `powershell.exe -Command "Get-WmiObject Win32_Process | Where-Object { ($_.CommandLine -match 'python' -or $_.CommandLine -match 'ray::') -and ($_.CommandLine -notmatch 'ray::IDLE') } | Sort-Object CreationDate -Descending | Select-Object ProcessId, CommandLine"`;

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

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = 'Select a Python process to attach py-spy or type a PID';
    quickPick.title = 'Python Processes';
    quickPick.matchOnDescription = true;

    // Add process items
    quickPick.items = [
        ...processes.map((proc) => ({
            label: proc.pid,
            description: proc.command,
        })),
        {
            label: 'Use this PID',
            description: 'Attach py-spy to the entered PID',
            alwaysShow: true,
        },
    ];

    // Create a promise that will be resolved when user accepts
    return new Promise<string | undefined>((resolve) => {
        // Track if user is typing a custom PID
        let lastValue = '';
        let userManuallySelected = false;

        quickPick.onDidChangeValue((value) => {
            lastValue = value;
            // Clear active selection when value changes, unless user manually selected an item
            if (!userManuallySelected) {
                quickPick.activeItems = [];
            }
        });

        // Track when user actively selects an item with arrow keys or mouse
        quickPick.onDidChangeActive(() => {
            if (quickPick.activeItems.length > 0) {
                userManuallySelected = true;
            }
        });

        quickPick.onDidAccept(() => {
            // If user manually selected an item or there's a valid selection
            if (userManuallySelected && quickPick.selectedItems.length > 0) {
                const selectedItem = quickPick.selectedItems[0];

                if (selectedItem.label === 'Use this PID') {
                    // When "Use this PID" is selected, check if there's already a number in the input
                    if (/^\d+$/.test(lastValue)) {
                        resolve(lastValue);
                    } else {
                        // Otherwise fall back to the regular prompt
                        quickPick.hide();
                        promptForPid().then(resolve);
                        return;
                    }
                } else {
                    // User selected a process from the list
                    resolve(selectedItem.label);
                }
            } else if (/^\d+$/.test(lastValue)) {
                // No explicit selection but user entered a complete PID number
                resolve(lastValue);
            } else {
                // No selection and no valid PID entered
                resolve(undefined);
            }

            quickPick.hide();
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve(undefined);
        });

        quickPick.show();
    });
}

/**
 * Verifies the user's environment and returns the requested information.
 *
 * @param options - The options to verify.
 * @param options.requireUri - Whether to require a file URI.
 * @param options.requirePython - Whether to require a Python interpreter.
 * @param options.useSudo - Whether to use sudo access.
 * @param options.ensurePasswordlessSudo - Whether to ensure passwordless sudo access.
 * @param options.requirePid - Whether to require a process ID (PID).
 * @param options.fileUri - The file URI to verify.
 * @param options.pid - The process ID (PID) to verify.
 * @param options.profilerType - The type of profiler to use ('py-spy' or 'memray').
 * @returns A promise that resolves to the requested information or false if verification fails.
 */
export async function verify({
    requireUri,
    requirePython,
    useSudo,
    ensurePasswordlessSudo,
    requirePid,
    fileUri,
    pid,
    profilerType = 'py-spy',
}: {
    requireUri: boolean;
    requirePython: boolean;
    useSudo: boolean;
    ensurePasswordlessSudo: boolean;
    requirePid: boolean;
    fileUri?: vscode.Uri;
    pid?: string;
    profilerType: 'py-spy' | 'memray';
}): Promise<
    | false
    | {
          uri?: vscode.Uri;
          pythonPath?: string;
          profilerPath: string;
          workspaceFolder: vscode.WorkspaceFolder;
          pid?: string;
          useSudo: boolean;
      }
> {
    if (profilerType === 'memray' && process.platform === 'win32') {
        vscode.window.showErrorMessage('Memray is not supported on Windows.', 'More info').then((selection) => {
            if (selection === 'More info') {
                vscode.commands.executeCommand(
                    'vscode.open',
                    vscode.Uri.parse(
                        'https://bloomberg.github.io/memray/supported_environments.html#supported-operating-systems'
                    )
                );
            }
        });
        return false;
    }

    // Step 1: Verify that we have a file URI and that it is pointing to a Python file
    if (requireUri) {
        if (!fileUri) {
            vscode.window.showErrorMessage(
                'No file is currently selected. Please open a Python file in an editor tab and try again.'
            );
            return false;
        }
        if (!fileUri.fsPath.endsWith('.py')) {
            vscode.window.showErrorMessage(
                'Only Python files are supported. Please open a Python file in an editor tab and try again.'
            );
            return false;
        }
    }

    // Step 2: Verify that we have a workspace folder
    const workspaceFolder = fileUri
        ? vscode.workspace.getWorkspaceFolder(fileUri)
        : vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        promptUserToOpenFolder(fileUri);
        return false;
    }

    // Step 3: Verify that we have a Python interpreter
    let pythonPath: string | undefined;
    if (requirePython) {
        pythonPath = await getPythonPath();
        if (!pythonPath) {
            vscode.window.showErrorMessage('No Python interpreter selected. Please select a Python interpreter.');
            return false;
        }
    } else {
        pythonPath = (await getPythonPath()) || '';
    }

    // Step 4: Verify that we have a profiler
    const profilerPath = profilerType === 'memray' ? await getOrInstallMemray() : await getOrInstallPySpy();
    if (!profilerPath) {
        return false;
    }

    // Step 5: Verify that we have sudo access
    const sudoInstalled = await checkSudoInstalled();
    let verifiedUseSudo = false;
    if (sudoInstalled) {
        if (profilerType === 'memray') {
            const config = vscode.workspace.getConfiguration('flamegraph.memray');
            const sudoSetting = config.get<boolean>('alwaysUseSudo', false);
            verifiedUseSudo = sudoSetting || useSudo;
            if (verifiedUseSudo) {
                const hasSudoAccess = await checkSudoAccess(profilerPath, ensurePasswordlessSudo, 'memray');
                if (!hasSudoAccess && ensurePasswordlessSudo) return false;
            }
        } else {
            const config = vscode.workspace.getConfiguration('flamegraph.py-spy');
            const sudoSetting = config.get<boolean>('alwaysUseSudo', false);
            verifiedUseSudo = sudoSetting || useSudo;
            if (verifiedUseSudo) {
                const hasSudoAccess = await checkSudoAccess(profilerPath, ensurePasswordlessSudo, 'py-spy');
                if (!hasSudoAccess && ensurePasswordlessSudo) return false;
            }
        }
    }

    // Step 6: Verify that we have a PID
    if (requirePid) {
        if (!pid) {
            pid = await selectPid();
        }
        if (!pid) return false;
    }

    // Track the profile document URI. This is used when the user clicks the "all" entry
    extensionState.profileDocumentUri = fileUri;

    // If all checks pass, return the requested information
    return {
        uri: fileUri,
        pythonPath,
        profilerPath,
        workspaceFolder,
        pid,
        useSudo: verifiedUseSudo,
    };
}
