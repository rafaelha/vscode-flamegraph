import { commands, ExtensionContext } from 'vscode';
import { FlamegraphPanel } from './panels/FlamegraphPanel';
import * as vscode from 'vscode';
import { loadProfileCommand, runProfilerCommand, toggleProfileCommand } from './commands';
import { unregisterProfile } from './register';
import { TreeNode } from './utilities/ProfileParser';

export function activate(context: ExtensionContext) {
    const showFlamegraphCommand = commands.registerCommand('flamegraph.showFlamegraph', () => {
        const profileData: TreeNode | undefined = context.workspaceState.get('flameTree');
        if (profileData) {
            FlamegraphPanel.render(context.extensionUri, profileData);
        }
    });

    context.workspaceState.update('profileVisible', false);
    context.workspaceState.update('decorationDisposables', undefined);

    // Register all commands
    context.subscriptions.push(
        loadProfileCommand(context),
        toggleProfileCommand(context),
        runProfilerCommand(context),
        showFlamegraphCommand
    );
}

export function deactivate(context: vscode.ExtensionContext) {
    unregisterProfile(context);
}
