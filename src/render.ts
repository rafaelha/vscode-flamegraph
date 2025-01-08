import * as vscode from 'vscode';
import { basename } from 'path';
import { Flamegraph, Flamenode } from './flamegraph';
import { StackProfileSample, FileProfileData } from './utilities/flamegraphParser';
import { getFunctionColor, ColorTheme } from './utilities/colors';
import { toUnixPath } from './utilities/pathUtils';

// TODO: Make this configurable in VS Code settings
const DECORATION_WIDTH = 100; // Width in pixels for the decoration area
const SAMPLES_PER_SECOND = 100; // TODO: Make this configurable

// Create a decorator type for the line coloring
export const lineColorDecorationType = vscode.window.createTextEditorDecorationType({
    before: {},
});

/**
 * Get the current theme from VS Code, which is either 'dark' or 'light'.
 * @returns The current theme.
 */
function getCurrentTheme(): ColorTheme {
    return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
        ? 'dark'
        : 'light';
}

/**
 * Creates a markdown tooltip displaying the call stack of a profiling entry. This tooltip is used for the line
 * decorations.
 *
 * @param samples - The profiling entries to create the tooltip for.
 * @returns The tooltip.
 */
function makeToolTip(samples: StackProfileSample[]): string {
    if (samples.length === 0) return '';
    if (samples.length <= 1) return samples[0].callStackString.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let toolTip = '### Call Stack\n| | | | |\n|---|---|---|---|\n';
    const totalSamples = samples.reduce((acc, sample) => acc + sample.numSamples, 0);

    const maxEntries = 5; // Maximum number of call stack strings to show
    for (let i = 0; i < Math.min(samples.length, maxEntries); i += 1) {
        const sample = samples[i];
        const percentage = ((sample.numSamples / totalSamples) * 100).toFixed(1);
        const barElements = 15;
        const barLength = Math.round((sample.numSamples / totalSamples) * barElements);
        const bar = '█'.repeat(barLength) + ' '.repeat(barElements - barLength);
        const escapedCallStackString = sample.callStackString.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        toolTip += `| ${sample.numSamples / 100}s | ${bar} | ${percentage}% | ${escapedCallStackString} |\n`;
    }

    if (samples.length > maxEntries) {
        toolTip += `| +${samples.length - maxEntries} other caller(s) | | | |\n`;
    }

    return toolTip;
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
 * @param result - The profiling results.
 * @param workspaceState - The workspace state.
 */
export function updateDecorations(
    activeEditor: vscode.TextEditor | undefined,
    flamegraph: Flamegraph,
    workspaceState: vscode.Memento
) {
    if (!activeEditor) return;

    const theme = getCurrentTheme();
    const focusNode: number = workspaceState.get('focusNode') || 0;

    const decorations: vscode.DecorationOptions[] = [];
    const documentLines = activeEditor.document.lineCount;
    const filePath = toUnixPath(activeEditor.document.fileName);
    const fileName = basename(filePath).toLowerCase();

    const lineProfiles = flamegraph.getFileProfile(fileName, focusNode);

    if (!lineProfiles) return;

    const totalSamples: Map<number, number> = new Map();
    for (const lineProfile of lineProfiles) {
        for (const node of lineProfile.nodes) {
            totalSamples.set(node.functionId, (totalSamples.get(node.functionId) || 0) + node.ownSamples);
        }
    }

    let lastLine = 1;
    for (const lineProfile of lineProfiles) {
        const { line, nodes } = lineProfile;
        const samples = nodes.reduce((acc: number, node: Flamenode) => acc + node.ownSamples, 0);

        const func = flamegraph.functions[nodes[0].functionId];
        const { moduleHue: hue } = func;

        const width =
            samples === 0 ? 0 : Math.round((samples / totalSamples.get(nodes[0].functionId)!) * DECORATION_WIDTH);

        for (; lastLine < line; lastLine += 1) decorations.push(emptyLineDecoration(lastLine));
        lastLine = line + 1;

        decorations.push({
            range: new vscode.Range(line - 1, 0, line - 1, 0),
            renderOptions: {
                before: {
                    backgroundColor: `hsl(${hue}, 100%, 50%)`,
                    contentText: samples > 0 ? `${(samples / SAMPLES_PER_SECOND).toFixed(2)}s` : '',
                    // contentText: `${nodes.length}`,
                    color: theme === 'dark' ? 'white' : 'black',
                    width: `${width}px`,
                    margin: `0px ${DECORATION_WIDTH - width}px 0px 0px`,
                    fontWeight: 'bold',
                },
            },
            // hoverMessage: new vscode.MarkdownString(toolTip),
        });
    }
    for (; lastLine <= documentLines; lastLine += 1) decorations.push(emptyLineDecoration(lastLine));
    activeEditor.setDecorations(lineColorDecorationType, decorations);
}
