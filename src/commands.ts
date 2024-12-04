import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
import { selectProfileFile } from './utilities/io';
import { registerProfile, unregisterProfile } from './register';

const execAsync = promisify(exec);

export function loadProfileCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.loadProfile', async () => {
        const profileUri = await selectProfileFile();
        context.workspaceState.update('profileUri', profileUri);
        context.workspaceState.update('profileVisible', true);

        if (!profileUri) {
            vscode.window.showErrorMessage('No profile file selected.');
            return;
        }
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
            vscode.commands.executeCommand('flamegraph.showFlamegraph');
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
        await execAsync(`py-spy --version`);
        return true;
    } catch {
        const installPySpy = await vscode.window.showInformationMessage(
            'py-spy is not installed. Would you like to install it?',
            'Yes',
            'No'
        );
        if (installPySpy === 'Yes') {
            return vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Installing py-spy...',
                    cancellable: true,
                },
                async (progress) => {
                    try {
                        progress.report({ increment: 0 });
                        await execAsync(`pip install py-spy`);
                        progress.report({ increment: 100 });
                        return true;
                    } catch (error) {
                        vscode.window.showErrorMessage(
                            'Failed to install py-spy. Please install it manually using pip.'
                        );
                        return false;
                    }
                }
            );
        }
        return false;
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
        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

        const pythonPath = await getPythonPath();
        if (!pythonPath) {
            vscode.window.showErrorMessage(
                'No Python interpreter selected. Please select a Python interpreter in VSCode.'
            );
            return;
        }

        const pySpyInstalled = await checkPySpyInstallation();
        if (!pySpyInstalled) return;

        let terminal: vscode.Terminal;
        const platform = os.platform();
        const escapedPath = platform === 'win32' ? relativePath.replace(/\\/g, '/') : relativePath.replace(/ /g, '\\ ');

        terminal = vscode.window.createTerminal('PySpy Profiler', platform === 'win32' ? 'cmd.exe' : undefined);
        const flags = '--format raw -s';
        const sudo = platform === 'darwin' ? 'sudo ' : '';
        terminal.sendText(`${sudo}py-spy record -o .pyspy-profile ${flags} "${pythonPath}" ${escapedPath}`);
        terminal.show();

        const disp = vscode.window.onDidEndTerminalShellExecution(async (event) => {
            if (event.terminal === terminal) {
                if (event.exitCode === 0) {
                    disp.dispose();
                    // Check if .pyspy-profile exists
                    const profileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, '.pyspy-profile'));
                    try {
                        await vscode.workspace.fs.stat(profileUri);
                        // File exists, register the profile
                        await registerProfile(context, profileUri);
                        context.workspaceState.update('profileUri', profileUri);
                        context.workspaceState.update('profileVisible', true);

                        // open the flamegraph
                        vscode.commands.executeCommand('flamegraph.showFlamegraph');
                    } catch {
                        vscode.window.showErrorMessage('Profile file not found.');
                    }
                }
                terminal.sendText('echo "Press Enter to close terminal" && read && exit');
                terminal.show();
            }
        });
    });
}
