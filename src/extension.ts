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
    profileNotebookCommand,
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
        profileCellCommand(context),
        profileNotebookCommand(context)
    );

    // Register decoration visible changed listener
    context.subscriptions.push(
        extensionState.onUpdateUI(() => {
            vscode.window.visibleTextEditors.forEach((editor) => {
                updateDecorations(editor);
            });
        })
    );

    // Keep track of previously visible editors
    let previousVisibleEditors = new Set<vscode.TextEditor>();

    vscode.window.onDidChangeVisibleTextEditors(
        (visibleEditors) => {
            const currentVisibleEditors = new Set(visibleEditors);

            // Update decorations only for newly visible editors
            visibleEditors.forEach((editor) => {
                if (!previousVisibleEditors.has(editor)) {
                    updateDecorations(editor);
                }
            });

            // Update the previous state
            previousVisibleEditors = currentVisibleEditors;
        },
        null,
        context.subscriptions
    );
    vscode.workspace.onDidChangeTextDocument(
        () => {
            updateDecorations(vscode.window.activeTextEditor);
        },
        null,
        context.subscriptions
    );
    vscode.window.onDidChangeActiveColorTheme(
        () => {
            vscode.window.visibleTextEditors.forEach((editor) => {
                updateDecorations(editor);
            });
        },
        null,
        context.subscriptions
    );
}

/**
 * Deactivates the extension.
 */
export function deactivate() {
    extensionState.dispose();
}
