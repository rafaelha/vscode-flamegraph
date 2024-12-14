import * as vscode from 'vscode';
import { commands, ExtensionContext } from 'vscode';
import { FlamegraphPanel } from './panels/FlamegraphPanel';
import { loadProfileCommand, runProfilerCommand, toggleProfileCommand } from './commands';
import { unregisterProfile } from './register';
import { FlamegraphNode } from './utilities/profileParser';

/**
 * Activates the extension.
 *
 * @param context - The extension context.
 */
export function activate(context: ExtensionContext) {
    const showFlamegraphCommand = commands.registerCommand('flamegraph.showFlamegraph', () => {
        const profileData: FlamegraphNode | undefined = context.workspaceState.get('flameTree');
        if (profileData) FlamegraphPanel.render(context, context.extensionUri, profileData);
    });

    context.workspaceState.update('profileVisible', false);
    context.workspaceState.update('decorationDisposables', undefined);
    context.workspaceState.update('focusNode', 0);
    context.workspaceState.update('focusNodeCallStack', new Set<number>());
    context.workspaceState.update('focusFunctionId', 'all');

    // Register all commands
    context.subscriptions.push(
        loadProfileCommand(context),
        toggleProfileCommand(context),
        runProfilerCommand(context),
        showFlamegraphCommand
    );
}

/**
 * Deactivates the extension.
 *
 * @param context - The extension context.
 */
export function deactivate(context: vscode.ExtensionContext) {
    unregisterProfile(context);
}
