import * as vscode from 'vscode';
import { parseProfilingData } from './utilities/ProfileParser';
import { updateDecorations } from './render';
import { readTextFile } from './utilities/io';
import { lineColorDecorationType } from './render';

export async function registerProfile(context: vscode.ExtensionContext, profileUri: vscode.Uri) {
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
        vscode.workspace.onDidChangeTextDocument((event) => {
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
