import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { checkAndInstallProfiler, getPythonPath, selectProfileFile } from './utilities/fsUtils';
import { loadAndRegisterProfile, unregisterProfile } from './register';
import { FlamegraphPanel } from './panels/FlamegraphPanel';
import { FlamegraphNode } from './utilities/profileParser';

let activeProfileWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Handles the profile update event. This is called when a new profile is written to the file system.
 *
 * @param context - The extension context.
 * @param profileUri - The URI of the profile file.
 */
const handleProfileUpdate = async (context: vscode.ExtensionContext, profileUri: vscode.Uri) => {
    try {
        await loadAndRegisterProfile(context, profileUri);
        context.workspaceState.update('profileUri', profileUri);
        context.workspaceState.update('profileVisible', true);
        context.workspaceState.update('focusNode', 0);
        vscode.commands.executeCommand('flamegraph.showFlamegraph');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open profile: ${error}`);
    }
    // Cleanup watcher after profile is loaded
    if (activeProfileWatcher) {
        activeProfileWatcher.dispose();
        activeProfileWatcher = undefined;
    }
};

/**
 * Loads a profile from a file specified by the user.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
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
        loadAndRegisterProfile(context, profileUri);
        vscode.commands.executeCommand('flamegraph.showFlamegraph');
    });
}

/**
 * Toggles the inline profile visibility.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
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
            loadAndRegisterProfile(context, profileUri);
            context.workspaceState.update('profileVisible', true);
        }
    });
}

/**
 * Runs the profiler on the active file.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
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

        const pySpyInstalled = await checkAndInstallProfiler();
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

        const terminal = vscode.window.createTerminal();
        const flags = '--format raw --full-filenames --subprocesses';
        const sudo = os.platform() === 'darwin' ? 'sudo ' : '';
        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        terminal.sendText(`${sudo}py-spy record --output .pyspy-profile ${flags} "${pythonPath}" "${relativePath}"`);
        terminal.show();

        const disp = vscode.window.onDidEndTerminalShellExecution((event) => {
            if (event.terminal === terminal) {
                terminal.sendText(
                    `msg="Press Enter to close"; [ -n "$COMSPEC" ] && powershell -c "Write-Host '$msg'; Read-Host; exit" || { echo "$msg"; read; exit; }`
                );
                terminal.show();
                disp.dispose();
            }
        });
    });
}

/**
 * Shows the flamegraph visualization panel.
 *
 * @param context - The extension context.
 * @returns The command registration.
 */
export function showFlamegraphCommand(context: vscode.ExtensionContext) {
    return vscode.commands.registerCommand('flamegraph.showFlamegraph', () => {
        const profileData: FlamegraphNode | undefined = context.workspaceState.get('flameTree');
        if (profileData) FlamegraphPanel.render(context, context.extensionUri, profileData);
    });
}
