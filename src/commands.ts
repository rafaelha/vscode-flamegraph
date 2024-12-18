import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { checkAndInstallProfiler, getPythonPath, selectProfileFile } from './utilities/fsUtils';
import { loadAndRegisterProfile, unregisterProfile } from './register';
import { FlamegraphPanel } from './flamegraphPanel';
import { FlamegraphNode } from './utilities/flamegraphParser';

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

async function runTask(
    context: vscode.ExtensionContext,
    workspaceFolder: vscode.WorkspaceFolder,
    command: string,
    flags: string
): Promise<void> {
    const profilePath = path.join(workspaceFolder.uri.fsPath, '.pyspy-profile');
    const profileUri = vscode.Uri.file(profilePath);

    const pySpyInstalled = await checkAndInstallProfiler();
    if (!pySpyInstalled) return;

    // Setup file watcher
    if (!activeProfileWatcher) {
        activeProfileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '.pyspy-profile')
        );
        context.subscriptions.push(activeProfileWatcher);
    }

    activeProfileWatcher.onDidCreate(() => handleProfileUpdate(context, profileUri));
    activeProfileWatcher.onDidChange(() => handleProfileUpdate(context, profileUri));

    const sudo = os.platform() === 'darwin' ? 'sudo ' : '';

    // Create task definition
    const taskDefinition: vscode.TaskDefinition = {
        type: 'shell',
        command: `${sudo}py-spy record --output .pyspy-profile --format raw --full-filenames ${flags} ${command}`,
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
    return vscode.commands.registerCommand('flamegraph.runProfiler', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('File is not part of a workspace.');
            return;
        }
        const pythonPath = await getPythonPath();
        if (!pythonPath) {
            vscode.window.showErrorMessage('No Python interpreter selected. Please select a Python interpreter.');
            return;
        }
        const filePath = editor.document.uri.fsPath;
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
export async function attach(context: vscode.ExtensionContext, flags: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace in VS Code.');
        return;
    }

    // Prompt user for PID
    const pid = await vscode.window.showInputBox({
        prompt: 'Enter the Process ID (PID) to attach py-spy to:',
        placeHolder: '1234',
        validateInput: (value) => {
            // Validate that input is a number
            return /^\d+$/.test(value) ? null : 'Please enter a valid process ID (numbers only)';
        },
    });
    if (!pid) return;
    runTask(context, workspaceFolder, `--pid ${pid}`, flags);
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
    return vscode.commands.registerCommand('flamegraph.showFlamegraph', () => {
        const profileData: FlamegraphNode | undefined = context.workspaceState.get('flameTree');
        if (profileData) FlamegraphPanel.render(context, context.extensionUri, profileData);
    });
}
