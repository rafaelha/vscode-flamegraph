import * as vscode from 'vscode';
import { normalizePath, ProfilingResult, ProfilingResults } from './utilities/ProfileParser';
import { getColorByIndex } from './utilities/colors';
import { basename } from 'path';

const DECORATION_WIDTH = 100; // Width in pixels for the decoration area

// Create a decorator type for the line coloring
export const lineColorDecorationType = vscode.window.createTextEditorDecorationType({
    before: {},
});

// Function to update decorations
export function updateDecorations(activeEditor: vscode.TextEditor | undefined, result: ProfilingResults) {
    if (!activeEditor || activeEditor.document.languageId !== 'python') {
        return;
    }

    const decorations: vscode.DecorationOptions[] = [];
    const documentLines = activeEditor.document.lineCount;
    let filePath = normalizePath(activeEditor.document.fileName);
    let fileName = basename(filePath);
    console.log(fileName);

    if (!(fileName in result)) {
        return;
    }
    let profilingResults = result[fileName];
    let profilingResult: ProfilingResult | undefined = undefined;

    // check if the file path is in the profiling results
    for (let i = 0; i < profilingResults.length; i++) {
        // the file path need not match exactly, but one should be the end of the other.
        // This ensures that relative paths are also matched.
        const resultFilePath = normalizePath(profilingResults[i].filePath);
        if (resultFilePath.endsWith(filePath) || filePath.endsWith(resultFilePath)) {
            profilingResult = profilingResults[i];
            break;
        }
    }
    if (!profilingResult) {
        return;
    }

    let colorIndex = -1;
    let lastFunctionName = '';
    let color = getColorByIndex(0);

    for (let line = 1; line < documentLines + 1; line++) {
        let samples = 0;
        let width = 0;
        let numSamplesNormalized = 0;
        let toolTip = '';
        if (line in profilingResult.profile) {
            const lineProfile = profilingResult.profile[line];
            const callStacks = lineProfile.numSamples;
            const functionName = lineProfile.functionName;
            if (functionName !== lastFunctionName) {
                color = getColorByIndex(++colorIndex);
                lastFunctionName = functionName;
            }
            const stats = profilingResult.functionProfile[functionName];
            for (const [callStack, numSamples] of Object.entries(callStacks)) {
                samples += numSamples;
            }

            const multipleCallers = Object.keys(callStacks).length > 1;
            if (multipleCallers) {
                toolTip += `### Call Stack\n`;
                toolTip += `| | | | |\n`;
                toolTip += `|---|---|---|---|\n`;
            }

            for (const [callStack, numSamples] of Object.entries(callStacks)) {
                if (multipleCallers) {
                    const percentage = ((numSamples / samples) * 100).toFixed(1);
                    const barElements = 20;
                    const barLength = Math.round((numSamples / stats.totalSamples) * barElements);
                    const bar = '█'.repeat(barLength) + ' '.repeat(barElements - barLength);
                    toolTip += `| ${numSamples / 100}s | ${bar} | ${percentage}% | ${callStack} |\n`;
                }
            }
            numSamplesNormalized = samples / stats.totalSamples;
            width = Math.round(numSamplesNormalized * DECORATION_WIDTH);
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

    activeEditor.setDecorations(lineColorDecorationType, decorations);
}
