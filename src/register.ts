import * as vscode from 'vscode';
import { parseProfilingData } from './utilities/profileParser';
import { updateDecorations, lineColorDecorationType } from './render';
import { readTextFile } from './utilities/fsUtils';

/**
 * Disposes of the profiling data from the workspace state.
 *
 * @param context - The extension context.
 */
export function unregisterProfile(context: vscode.ExtensionContext) {
    // Remove decorations
    vscode.window.visibleTextEditors.forEach((editor) => {
        editor.setDecorations(lineColorDecorationType, []);
    });

    // Dispose of existing listeners
    const disposables = context.workspaceState.get('decorationDisposables') as vscode.Disposable[] | undefined;
    if (disposables) {
        disposables.forEach((d) => d.dispose());
        context.workspaceState.update('decorationDisposables', undefined);
        context.workspaceState.update('decorationDisposables', undefined);
    }
}

/**
 * Loads a profile file and registers it with the extension and the workspace state.
 *
 * @param context - The extension context.
 * @param profileUri - The URI of the profile file.
 */
export async function loadAndRegisterProfile(context: vscode.ExtensionContext, profileUri: vscode.Uri) {
    // Unregister any existing profile
    unregisterProfile(context);

    const profileString = await readTextFile(profileUri);
    context.workspaceState.update('profileData', profileString);
    const [result, flameTree] = parseProfilingData(profileString);

    context.workspaceState.update('flameTree', flameTree);
    context.workspaceState.update('decorationTree', result);

    // Store disposables for later cleanup
    const disposables = [
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateDecorations(editor, result, context.workspaceState);
        }),
        vscode.workspace.onDidChangeTextDocument(() => {
            updateDecorations(vscode.window.activeTextEditor, result, context.workspaceState);
        }),
    ];

    // Add disposables to context subscriptions
    context.subscriptions.push(...disposables);
    context.workspaceState.update('decorationDisposables', disposables);

    // Initial update for all visible editors
    vscode.window.visibleTextEditors.forEach((editor) => {
        updateDecorations(editor, result, context.workspaceState);
    });
}
