import * as vscode from 'vscode';
import { ProgressLocation } from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { selectProfileFile } from './utilities/io';
import { registerProfile, unregisterProfile } from './register';

const execAsync = promisify(exec);

let activeProfileWatcher: vscode.FileSystemWatcher | undefined;
const handleProfileUpdate = async (context: vscode.ExtensionContext, profileUri: vscode.Uri) => {
    try {
        await registerProfile(context, profileUri);
        context.workspaceState.update('profileUri', profileUri);
        context.workspaceState.update('profileVisible', true);
        context.workspaceState.update('focusNode', 0);
        vscode.commands.executeCommand('flamegraph.showFlamegraph');
    } catch (error) {
        vscode.window.showErrorMessage('Failed to open performance profile.');
    }
    // Cleanup watcher after profile is loaded
    if (activeProfileWatcher) {
        activeProfileWatcher.dispose();
        activeProfileWatcher = undefined;
    }
};

export function loadProfileCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.loadProfile', async () => {
        const profileUri = await selectProfileFile();
        context.workspaceState.update('profileUri', profileUri);

        if (!profileUri) {
            vscode.window.showErrorMessage('No profile file selected.');
            return;
        }
        context.workspaceState.update('focusNode', 0);
        context.workspaceState.update('profileVisible', true);
        registerProfile(context, profileUri);
        vscode.commands.executeCommand('flamegraph.showFlamegraph');
    });
}

export function toggleProfileCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.toggleProfile', () => {
        const profileVisible = context.workspaceState.get('profileVisible') as boolean | undefined;
        const profileUri = context.workspaceState.get('profileUri') as vscode.Uri | undefined;

        if (profileVisible) {
            unregisterProfile(context);
            context.workspaceState.update('profileVisible', false);
        } else {
            if (!profileUri) {
                vscode.window.showErrorMessage('No profile loaded. Please load a profile first.');
                return;
            }
            registerProfile(context, profileUri);
            context.workspaceState.update('profileVisible', true);
        }
    });
}

async function getPythonPath(): Promise<string | undefined> {
    // get the python path from the python extension
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    if (pythonExtension) {
        await pythonExtension.activate();
        return pythonExtension.exports.settings.getExecutionDetails().execCommand.join(' ');
    }
    // otherwise fallback to the python path from the python config
    const pythonConfig = vscode.workspace.getConfiguration('python');
    return pythonConfig.get<string>('pythonPath');
}

async function checkPySpyInstallation(): Promise<boolean> {
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
                location: ProgressLocation.Notification,
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

export function runProfilerCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.runProfiler', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('File is not part of a workspace.');
            return;
        }

        // Setup file watcher before running profiler
        const profilePath = path.join(workspaceFolder.uri.fsPath, '.pyspy-profile');
        const profileUri = vscode.Uri.file(profilePath);

        const pythonPath = await getPythonPath();
        if (!pythonPath) {
            vscode.window.showErrorMessage('No Python interpreter selected. Please select a Python interpreter.');
            return;
        }

        const pySpyInstalled = await checkPySpyInstallation();
        if (!pySpyInstalled) return;

        // Cleanup any existing watcher
        if (!activeProfileWatcher) {
            activeProfileWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceFolder, '.pyspy-profile')
            );
            // Ensure watcher cleanup on extension deactivation
            context.subscriptions.push(activeProfileWatcher);
        }

        activeProfileWatcher.onDidCreate(() => handleProfileUpdate(context, profileUri));
        activeProfileWatcher.onDidChange(() => handleProfileUpdate(context, profileUri));

        const terminal = vscode.window.createTerminal('PySpy Profiler');
        const flags = '--format raw --full-filenames --subprocesses';
        const sudo = os.platform() === 'darwin' ? 'sudo ' : '';
        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        terminal.sendText(`${sudo}py-spy record --output .pyspy-profile ${flags} "${pythonPath}" "${relativePath}"`);
        terminal.show();

        const disp = vscode.window.onDidEndTerminalShellExecution((event) => {
            if (event.terminal === terminal) {
                if (os.platform() === 'win32')
                    terminal.sendText('echo "Press Enter to close terminal"; Read-Host; exit');
                else terminal.sendText('echo "Press Enter to close terminal" && read && exit');
                terminal.show();
                disp.dispose();
            }
        });
    });
}
