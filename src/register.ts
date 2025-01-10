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

    // Clear the global flamegraph
    extensionState.currentFlamegraph = undefined;
    extensionState.profileVisible = false;
}

/**
 * Loads a profile file and registers it with the extension and the workspace state.
 *
 * @param profileUri - The URI of the profile file.
 */
export async function loadAndRegisterProfile(context: vscode.ExtensionContext, profileUri: vscode.Uri) {
    // Unregister any existing profile
    unregisterProfile();

    const profileString = await readTextFile(profileUri);
    const flamegraph = new Flamegraph(profileString);

    // Set the global flamegraph
    extensionState.currentFlamegraph = flamegraph;
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
