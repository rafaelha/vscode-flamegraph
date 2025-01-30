import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import {
    loadProfileCommand,
    runProfilerCommand,
    toggleProfileCommand,
    showFlamegraphCommand,
    profileCellCommand,
    attachProfilerCommand,
    attachNativeProfilerCommand,
} from './commands';
import { updateDecorations } from './render';
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
        toggleProfileCommand(),
        runProfilerCommand(context),
        attachProfilerCommand(context),
        attachNativeProfilerCommand(context),
        showFlamegraphCommand(context),
        profileCellCommand(context)
    );

    // Register decoration visible changed listener
    context.subscriptions.push(
        extensionState.onUpdateUI(() => {
            vscode.window.visibleTextEditors.forEach((editor) => {
                updateDecorations(editor);
            });
        })
    );

    // Register decoration listeners
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateDecorations(editor);
        }),
        vscode.workspace.onDidChangeTextDocument(() => {
            updateDecorations(vscode.window.activeTextEditor);
        }),
        vscode.window.onDidChangeActiveColorTheme(() => {
            vscode.window.visibleTextEditors.forEach((editor) => {
                updateDecorations(editor);
            });
        })
    );
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    extensionState.dispose();
}
