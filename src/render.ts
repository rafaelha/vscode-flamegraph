import * as vscode from 'vscode';
import { basename } from 'path';
import { ProfilingEntry, ProfilingResult, ProfilingResults } from './utilities/ProfileParser';
import { getFunctionColor } from './utilities/colors';
import { normalizePath } from './utilities/getUri';

const DECORATION_WIDTH = 100; // Width in pixels for the decoration area

// Create a decorator type for the line coloring
export const lineColorDecorationType = vscode.window.createTextEditorDecorationType({
    before: {},
});

function makeToolTip(samples: ProfilingEntry[]) {
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

// Function to update decorations
export function updateDecorations(
    activeEditor: vscode.TextEditor | undefined,
    result: ProfilingResults,
    workspaceState: vscode.Memento
) {
    if (!activeEditor) return;

    const focusNode: number = workspaceState.get('focusNode') || 0;
    const focusFunctionId: string = workspaceState.get('focusFunctionId') || 'all';

    const decorations: vscode.DecorationOptions[] = [];
    const documentLines = activeEditor.document.lineCount;
    const filePath = normalizePath(activeEditor.document.fileName);
    const fileName = basename(filePath);

    if (!(fileName in result)) return;

    const profilingResults = result[fileName];
    let profilingResult: ProfilingResult | undefined;

    // check if the file path is in the profiling results
    for (let i = 0; i < profilingResults.length; i += 1) {
        // the file path need not match exactly, but one should be the end of the other.
        // This ensures that relative paths are also matched.
        const resultFilePath = normalizePath(profilingResults[i].filePath);
        if (resultFilePath.endsWith(filePath) || filePath.endsWith(resultFilePath)) {
            profilingResult = profilingResults[i];
            break;
        }
    }
    if (!profilingResult) return;

    const focusNodeCallStack = workspaceState.get('focusNodeCallStack') as Set<number>;
    let nonZeroDecorations = false;

    for (let line = 1; line < documentLines + 1; line += 1) {
        let width = 0;
        let toolTip = '';
        let samples = 0;
        let color = '';

        if (line in profilingResult.profile) {
            const lineProfile = profilingResult.profile[line];
            const { functionName } = lineProfile;

            color = getFunctionColor(functionName);
            const stats = profilingResult.functionProfile[functionName];
            let totalSamples = 0;

            for (const stat of stats) if (stat.callStackUids.has(focusNode)) totalSamples += stat.totalSamples;

            const callStackSamples: ProfilingEntry[] = [];

            for (const sample of lineProfile.samples) {
                if (sample.callStackUids.has(focusNode)) {
                    samples += sample.numSamples;
                    callStackSamples.push(sample);
                }

                // If the sample is in the call stack of the focus node, process it
                // This tracks profiling info for all parent nodes of the focus node.
                // There is a caveat for recursive calls: we must ensure that the parent node is not part of the same
                // function as the focus node.
                if (focusNodeCallStack.has(sample.uid) && focusFunctionId !== sample.functionId) {
                    samples += sample.numSamples;
                    totalSamples += sample.numSamples;
                }
            }

            toolTip = makeToolTip(callStackSamples);
            width = samples === 0 ? 0 : Math.round((samples / totalSamples) * DECORATION_WIDTH);
            if (samples > 0) nonZeroDecorations = true;
        }
        decorations.push({
            range: new vscode.Range(line - 1, 0, line - 1, 0),
            renderOptions: {
                before: {
                    backgroundColor: color,
                    contentText: samples > 0 ? `${(samples / 100).toFixed(2)}s` : '',
                    color: 'white',
                    width: `${width}px`,
                    margin: `0px ${DECORATION_WIDTH - width}px 0px 0px`,
                    fontWeight: 'bold',
                },
            },
            hoverMessage: new vscode.MarkdownString(toolTip),
        });
    }

    if (nonZeroDecorations) activeEditor.setDecorations(lineColorDecorationType, decorations);
    else activeEditor.setDecorations(lineColorDecorationType, []);
}
