import { commands, ExtensionContext } from 'vscode';
import { FlamegraphPanel } from './panels/FlamegraphPanel';
import * as vscode from 'vscode';
import { loadProfileCommand, runProfilerCommand, toggleProfileCommand } from './commands';
import { unregisterProfile } from './register';

export function activate(context: ExtensionContext) {
    // Create the show hello world command
    const showFlamegraphCommand = commands.registerCommand('flamegraph.showFlamegraph', () => {
        const profileData: string | undefined = context.workspaceState.get('profileData');
        if (profileData) {
            FlamegraphPanel.render(context.extensionUri, profileData);
        }
    });

    console.log('Activated');
    context.workspaceState.update('profileVisible', false);

    // Register all commands
    context.subscriptions.push(
        loadProfileCommand(context),
        toggleProfileCommand(context),
        runProfilerCommand(context),
        showFlamegraphCommand
    );
}

// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
    // Reset the lineDecorationsWidth when the extension is deactivated
    unregisterProfile(context);
}
