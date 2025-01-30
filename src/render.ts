import * as vscode from 'vscode';
import { toUnixPath } from './utilities/pathUtils';
import { Flamegraph, Flamenode } from './flamegraph';
import { extensionState } from './state';

// TODO: Make this configurable in VS Code settings
const DECORATION_WIDTH = 100; // Width in pixels for the decoration area
const SAMPLES_PER_SECOND = 100; // TODO: Make this configurable
const MAX_TOOLTIP_ENTRIES = 5;
const TOOLTIP_BAR_ELEMENTS = 15;

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
    before: {
        contentText: '',
        width: `$0px`,
        margin: `0px ${DECORATION_WIDTH}px 0px 0px`,
        fontWeight: 'bold',
    },
});
// Get the current theme from VS Code, which is either 'dark' or 'light'
function getCurrentTheme(): 'dark' | 'light' {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
        ? 'dark'
        : 'light';
}

/**
 * Creates an empty line decoration.
 * @remarks Unfortunately, the `before` decorations are only rendered before the range specified in the decoration.
 * This means that we need to create individual decoration for every line, even the empty ones.
 * See for example, here:
 * https://github.com/gitkraken/vscode-gitlens/blob/5abb804b10f1a90d507827477582c806bd9c9fe8/src/annotations/gutterBlameAnnotationProvider.ts#L153
 * It also means that all decorations have to be re-rendered when the file is changed.
 * It would be nice if we could make use of the `DecorationRangeBehavior` to automatically extend ranges when new lines
 * are added.
 *
 * @param line - The line number to create the decoration for.
 * @returns The decoration options.
 */
function emptyLineDecoration(line: number): vscode.DecorationOptions {
    return {
        range: new vscode.Range(line - 1, 0, line - 1, 0),
        renderOptions: {
            before: { contentText: '' },
        },
    };
}
/**
 * Creates a markdown tooltip displaying the call stack of a profiling entry. This tooltip is used for the line
 * decorations.
 *
 * @param nodes - The profiling entries to create the tooltip for.
 * @param samples - The total samples for the profiling entries.
 * @param flamegraph - The flamegraph data.
 * @returns The tooltip.
 */
function makeToolTip(nodes: Flamenode[], samples: number, flamegraph: Flamegraph): string {
    const n = nodes.length;
    if (n === 0) return '';

    const stackToString = (stack: string[]): string => stack.join('/').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (n <= 1) return stackToString(flamegraph.getCallStack(nodes[0]));
    let toolTip = '### Call Stack\n| | | | |\n|---|---|---|---|\n';

    let callStacks: string[][] = [];
    for (const node of nodes.slice(0, MAX_TOOLTIP_ENTRIES)) {
        callStacks.push(flamegraph.getCallStack(node));
    }

    // remove elements from the top of the call stacks until they are the same for all call stacks
    // this is to make the tooltip more readable
    while (n > 1 && callStacks[0].length > 1) {
        const s = callStacks[0];
        if (!callStacks.every((stack) => stack[0] === s[0])) break;
        callStacks = callStacks.map((stack) => stack.slice(1));
    }

    for (let i = 0; i < Math.min(n, MAX_TOOLTIP_ENTRIES); i += 1) {
        const node = nodes[i];
        const percentage = ((node.ownSamples / samples) * 100).toFixed(1);
        const barLength = Math.round((node.ownSamples / samples) * TOOLTIP_BAR_ELEMENTS);
        const bar = '█'.repeat(barLength) + ' '.repeat(TOOLTIP_BAR_ELEMENTS - barLength);
        const callStack = stackToString(callStacks[i]);
        toolTip += `| ${node.ownSamples / 100}s | ${bar} | ${percentage}% | ${callStack} |\n`;
    }

    if (n > MAX_TOOLTIP_ENTRIES) {
        toolTip += `| +${n - MAX_TOOLTIP_ENTRIES} other caller(s) | | | |\n`;
    }

    return toolTip;
}

/**
 * Clears the line decorations for the active editor.
 *
 * @param activeEditor - The active editor.
 */
function clearDecorations(activeEditor: vscode.TextEditor) {
    activeEditor.setDecorations(lineColorDecorationType, []);
}

/**
 * Updates the line decorations for the active editor.
 *
 * @param activeEditor - The active editor.
 */
export function updateDecorations(activeEditor: vscode.TextEditor | undefined) {
    const { focusNode, profileVisible, currentFlamegraph: flamegraph } = extensionState;
    const theme = getCurrentTheme();
    if (!activeEditor) return;
    if (!profileVisible || !flamegraph) {
        clearDecorations(activeEditor);
        return;
    }

    let cellNumber: number | undefined;
    const notebookEditor = vscode.window.visibleNotebookEditors.find(
        (e) => e.notebook.uri.path === activeEditor.document.uri.path
    );
    if (notebookEditor) {
        // get the notebook cell that contains the active editor
        const numCells = notebookEditor?.notebook.cellCount;
        for (let i = 0; i < numCells; i += 1) {
            const cell = notebookEditor?.notebook.cellAt(i);
            if (cell.document === activeEditor.document) {
                cellNumber = i + 1;
                break;
            }
        }
    }
    if (!notebookEditor && activeEditor.document.uri.fragment !== '') {
        // This seems to be a bug in VS Code. Whenever a tab is opened, vscode.windows.visibleNotebookEditors is empty,
        // even though the tab is a notebook.
        return;
    }

    let filePath = toUnixPath(activeEditor.document.fileName);
    if (cellNumber) {
        filePath = `${filePath}:<${cellNumber}>`;
    }

    const decorations: vscode.DecorationOptions[] = [];
    const documentLines = activeEditor.document.lineCount;

    const lineProfiles = flamegraph.getFileProfile(filePath, focusNode);

    if (!lineProfiles) {
        clearDecorations(activeEditor);
        return;
    }

    let anyDecorations = false;

    const totalSamples: Map<number, number> = new Map();
    for (const { nodes } of lineProfiles) {
        for (const node of nodes) {
            if (node.ownSamples > 0) anyDecorations = true;
            totalSamples.set(node.functionId, (totalSamples.get(node.functionId) || 0) + node.ownSamples);
        }
    }

    if (!anyDecorations) {
        clearDecorations(activeEditor);
        return;
    }

    let lastLine = 1;
    for (const lineProfile of lineProfiles) {
        const { line, nodes } = lineProfile;
        if (line > documentLines) break;
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
                },
            },
            hoverMessage: new vscode.MarkdownString(makeToolTip(nodes, samples, flamegraph)),
        });
    }
    for (; lastLine <= documentLines; lastLine += 1) decorations.push(emptyLineDecoration(lastLine));

    activeEditor.setDecorations(lineColorDecorationType, decorations);
}
