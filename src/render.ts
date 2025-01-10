import * as vscode from 'vscode';
import { basename } from 'path';
import { toUnixPath } from './utilities/pathUtils';
import { Flamegraph, Flamenode } from './flamegraph';
import { extensionState } from './state';

// TODO: Make this configurable in VS Code settings
const DECORATION_WIDTH = 100; // Width in pixels for the decoration area
const SAMPLES_PER_SECOND = 100; // TODO: Make this configurable

// Add these constants near the top with other constants
const LIGHT_THEME_SETTINGS = {
    saturation: '85%',
    lightness: '75%',
};

const DARK_THEME_SETTINGS = {
    saturation: '65%',
    lightness: '40%',
};

// Create a decorator type for the line coloring
export const lineColorDecorationType = vscode.window.createTextEditorDecorationType({
    before: {},
});
// Get the current theme from VS Code, which is either 'dark' or 'light'
function getCurrentTheme(): 'dark' | 'light' {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
        ? 'dark'
        : 'light';
}

function emptyLineDecoration(line: number): vscode.DecorationOptions {
    return {
        range: new vscode.Range(line - 1, 0, line - 1, 0),
        renderOptions: {
            before: { contentText: '', width: `${DECORATION_WIDTH}px` },
        },
    };
}

/**
 * Updates the line decorations for the active editor.
 *
 * @param activeEditor - The active editor.
 * @param flamegraph - The flamegraph data.
 */
export function updateDecorations(activeEditor: vscode.TextEditor | undefined, flamegraph: Flamegraph) {
    if (!activeEditor) return;

    const theme = getCurrentTheme();
    const { focusNode } = extensionState;

    const decorations: vscode.DecorationOptions[] = [];
    const documentLines = activeEditor.document.lineCount;
    const filePath = toUnixPath(activeEditor.document.fileName);
    const fileName = basename(filePath).toLowerCase();

    const lineProfiles = flamegraph.getFileProfile(fileName, focusNode);

    if (!lineProfiles) return;

    const totalSamples: Map<number, number> = new Map();
    for (const { nodes } of lineProfiles) {
        for (const node of nodes) {
            totalSamples.set(node.functionId, (totalSamples.get(node.functionId) || 0) + node.ownSamples);
        }
    }

    let lastLine = 1;
    for (const lineProfile of lineProfiles) {
        const { line, nodes } = lineProfile;
        const samples = nodes.reduce((acc: number, node: Flamenode) => acc + node.ownSamples, 0);

        const func = flamegraph.functions[nodes[0].functionId];
        const { functionHue } = func;

        const width =
            samples === 0 ? 0 : Math.round((samples / totalSamples.get(nodes[0].functionId)!) * DECORATION_WIDTH);

        for (; lastLine < line; lastLine += 1) decorations.push(emptyLineDecoration(lastLine));
        lastLine = line + 1;

        decorations.push({
            range: new vscode.Range(line - 1, 0, line - 1, 0),
            renderOptions: {
                before: {
                    backgroundColor: `hsl(${functionHue}, ${
                        theme === 'dark' ? DARK_THEME_SETTINGS.saturation : LIGHT_THEME_SETTINGS.saturation
                    }, ${theme === 'dark' ? DARK_THEME_SETTINGS.lightness : LIGHT_THEME_SETTINGS.lightness})`,
                    contentText: samples > 0 ? `${(samples / SAMPLES_PER_SECOND).toFixed(2)}s` : '',
                    color: theme === 'dark' ? 'white' : 'black',
                    width: `${width}px`,
                    margin: `0px ${DECORATION_WIDTH - width}px 0px 0px`,
                    fontWeight: 'bold',
                },
            },
        });
    }
    for (; lastLine <= documentLines; lastLine += 1) decorations.push(emptyLineDecoration(lastLine));
    activeEditor.setDecorations(lineColorDecorationType, decorations);
}
