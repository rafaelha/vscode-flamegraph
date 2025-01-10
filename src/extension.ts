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
import { extensionState } from './state';

/**
 * Activates the extension.
 *
 * @param context - The extension context.
 */
export function activate(context: ExtensionContext) {
    // Initialize extension state
    extensionState.setContext(context);

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
 */
export function deactivate() {
    unregisterProfile();
}
