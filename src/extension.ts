import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import {
    loadProfileCommand,
    runProfilerCommand,
    toggleProfileCommand,
    showFlamegraphCommand,
    attachProfilerCommand,
    attachNativeProfilerCommand,
} from './commands';
import { unregisterProfile } from './register';

/**
 * Activates the extension.
 *
 * @param context - The extension context.
 */
export function activate(context: ExtensionContext) {
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
        attachProfilerCommand(context),
        attachNativeProfilerCommand(context),
        showFlamegraphCommand(context)
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
