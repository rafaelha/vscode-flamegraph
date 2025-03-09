import * as vscode from 'vscode';
import * as path from 'path';
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
    runAllPytestsCommand,
    runPytestFileCommand,
    topCommand,
} from './commands';
import { updateDecorations } from './render';
import { extensionState } from './state';
import { FlamegraphTaskProvider, PROFILE_FILENAME } from './taskProvider';

/**
 * Activates the extension.
 *
 * @param context - The extension context.
 */
export function activate(context: ExtensionContext) {
    // Initialize extension state
    extensionState.setContext(context);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    const profilePath = path.join(workspaceFolder.uri.fsPath, PROFILE_FILENAME);
    const profileUri = vscode.Uri.file(profilePath);

    // Setup file watcher
    extensionState.activeProfileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, PROFILE_FILENAME)
    );
    extensionState.activeProfileWatcher.onDidCreate(async () =>
        extensionState.handleProfileUpdate(context, profileUri)
    );
    extensionState.activeProfileWatcher.onDidChange(async () =>
        extensionState.handleProfileUpdate(context, profileUri)
    );

    // Register all commands
    context.subscriptions.push(
        loadProfileCommand(context),
        toggleProfileCommand(),
        runProfilerCommand(),
        attachProfilerCommand(),
        showFlamegraphCommand(context),
        profileCellCommand(),
        profileNotebookCommand(),
        runAllPytestsCommand(),
        runPytestFileCommand(),
        topCommand()
    );

    // Register task provider
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(FlamegraphTaskProvider.taskType, new FlamegraphTaskProvider())
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

    // Decorations have to be re-rendered when the visible editors change, i.e. they are not persistent when the editor
    // is hidden and then shown again. See https://github.com/microsoft/vscode/issues/136241
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
            extensionState.updateUI();
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
