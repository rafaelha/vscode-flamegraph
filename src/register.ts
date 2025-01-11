import * as vscode from 'vscode';
import { updateDecorations, lineColorDecorationType } from './render';
import { readTextFile } from './utilities/fsUtils';
import { Flamegraph } from './flamegraph';
import { extensionState } from './state';

/**
 * Disposes of the profiling data from the workspace state.
 *
 * @param context - The extension context.
 */
export function unregisterProfile() {
    // Remove decorations
    vscode.window.visibleTextEditors.forEach((editor) => {
        editor.setDecorations(lineColorDecorationType, []);
    });

    extensionState.profileVisible = false;
}

export async function loadProfile(profileUri: vscode.Uri) {
    const profileString = await readTextFile(profileUri);
    extensionState.currentFlamegraph = new Flamegraph(profileString);
}

/**
 * Loads a profile file and registers it with the extension and the workspace state.
 *
 * @param profileUri - The URI of the profile file.
 */
export async function registerProfile(
    context: vscode.ExtensionContext,
    profileUri: vscode.Uri,
    reload: boolean = true
) {
    // Unregister any existing profile
    unregisterProfile();

    if (reload || !extensionState.currentFlamegraph) {
        await loadProfile(profileUri);
    }
    if (!extensionState.currentFlamegraph) return;
    const flamegraph = extensionState.currentFlamegraph;

    extensionState.profileVisible = true;

    // Store disposables for later cleanup
    const disposables = [
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateDecorations(editor, flamegraph);
        }),
        vscode.workspace.onDidChangeTextDocument(() => {
            updateDecorations(vscode.window.activeTextEditor, flamegraph);
        }),
        // Add theme change listener
        vscode.window.onDidChangeActiveColorTheme(() => {
            vscode.window.visibleTextEditors.forEach((editor) => {
                updateDecorations(editor, flamegraph);
            });
        }),
    ];
    context.subscriptions.push(...disposables);

    // Initial update for all visible editors
    vscode.window.visibleTextEditors.forEach((editor) => {
        updateDecorations(editor, flamegraph);
    });
}
