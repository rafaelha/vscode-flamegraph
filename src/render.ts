import * as vscode from 'vscode';
import { basename } from 'path';
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
 * Updates the line decorations for the active editor.
 *
 * @param activeEditor - The active editor.
 * @param flamegraph - The flamegraph data.
 */
export function updateDecorations(activeEditor: vscode.TextEditor | undefined) {
    const { focusNode, profileVisible, currentFlamegraph: flamegraph, decorationCache } = extensionState;
    if (!profileVisible || !activeEditor || !flamegraph) {
        activeEditor?.setDecorations(lineColorDecorationType, []);
        return;
    }

    const filePath = toUnixPath(activeEditor.document.fileName);
    const cacheKey = `${filePath}:${focusNode}`;

    // Check if we have cached decorations for this file and focus node
    const cachedDecorations = decorationCache.get(cacheKey);
    if (cachedDecorations) {
        activeEditor.setDecorations(lineColorDecorationType, cachedDecorations);
        return;
    }

    const theme = getCurrentTheme();
    const decorations: vscode.DecorationOptions[] = [];
    const documentLines = activeEditor.document.lineCount;
    const fileName = basename(filePath).toLowerCase();

    const lineProfiles = flamegraph.getFileProfile(fileName, focusNode);

    if (!lineProfiles) return;
    let anyDecorations = false;

    const totalSamples: Map<number, number> = new Map();
    for (const { nodes } of lineProfiles) {
        for (const node of nodes) {
            if (node.ownSamples > 0) anyDecorations = true;
            totalSamples.set(node.functionId, (totalSamples.get(node.functionId) || 0) + node.ownSamples);
        }
    }

    if (!anyDecorations) {
        activeEditor.setDecorations(lineColorDecorationType, []);
        return;
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
            hoverMessage: new vscode.MarkdownString(makeToolTip(nodes, samples, flamegraph)),
        });
    }
    for (; lastLine <= documentLines; lastLine += 1) decorations.push(emptyLineDecoration(lastLine));

    // Cache the decorations before applying them
    decorationCache.set(cacheKey, decorations);
    activeEditor.setDecorations(lineColorDecorationType, decorations);
}
