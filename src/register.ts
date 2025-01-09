import * as vscode from 'vscode';
import { updateDecorations, lineColorDecorationType } from './render';
import { readTextFile } from './utilities/fsUtils';
import { Flamegraph } from './flamegraph';
import { setCurrentFlamegraph } from './state';

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

    // Clear the global flamegraph
    setCurrentFlamegraph(undefined);
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
    const flamegraph = new Flamegraph(profileString);

    // Set the global flamegraph
    setCurrentFlamegraph(flamegraph);

    // Store disposables for later cleanup
    const disposables = [
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updateDecorations(editor, flamegraph, context.workspaceState);
        }),
        vscode.workspace.onDidChangeTextDocument(() => {
            updateDecorations(vscode.window.activeTextEditor, flamegraph, context.workspaceState);
        }),
        // Add theme change listener
        vscode.window.onDidChangeActiveColorTheme(() => {
            vscode.window.visibleTextEditors.forEach((editor) => {
                updateDecorations(editor, flamegraph, context.workspaceState);
            });
        }),
    ];

    // Add disposables to context subscriptions
    context.subscriptions.push(...disposables);
    context.workspaceState.update('decorationDisposables', disposables);

    // Initial update for all visible editors
    vscode.window.visibleTextEditors.forEach((editor) => {
        updateDecorations(editor, flamegraph, context.workspaceState);
    });
}
