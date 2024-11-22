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
    const result = parseProfilingData(profileString);

    const disposables = [
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateDecorations(editor, result);
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            updateDecorations(vscode.window.activeTextEditor, result);
        }),
    ];

    // Add disposables to context subscriptions
    context.subscriptions.push(...disposables);

    // Store disposables in workspaceState for cleanup
    context.workspaceState.update('decorationDisposables', disposables);

    // Initial update for the current active editor
    updateDecorations(vscode.window.activeTextEditor, result);
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
    }
}
