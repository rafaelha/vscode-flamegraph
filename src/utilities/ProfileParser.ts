import { basename } from 'path';
import { getModuleName } from './getUri';
import { getNodeColor } from './colors';

export type ProfilingEntry = {
    numSamples: number;
    functionName: string;
};

export type ProfilingResult = {
    filePath: string;
    profile: {
        [lineNumber: string]: {
            functionName: string;
            numSamples: {
                [callStack: string]: number; // numSamples
            };
        };
    };
    functionProfile: {
        [functionName: string]: {
            totalSamples: number;
            maxSamples: number;
        };
    };
};

export type ProfilingResults = {
    [fileName: string]: ProfilingResult[];
};

export interface TreeNode {
    uid: number;
    functionName: string;
    numSamples: number;
    depth: number;
    color: string;
    fileLineId: number;
    filePath?: string;
    lineNumber?: number;
    children?: TreeNode[];
    parent?: TreeNode;
    moduleName?: string;
}

function sortTreeNodeChildren(node: TreeNode): TreeNode {
    // Sort current node's children
    if (node.children) {
        node.children.sort((a, b) => {
            // First compare by file
            const fileCompare = (a.filePath || '').localeCompare(b.filePath || '');
            if (fileCompare !== 0) return fileCompare;
            // Then by line number
            return (a.lineNumber || 0) - (b.lineNumber || 0);
        });

        // Recursively sort children's children
        node.children.forEach(sortTreeNodeChildren);
    }

    return node;
}

/**
 * Parses profiling data and structures it into a nested object.
 *
 * @param data - The raw profiling data as a string.
 * @returns A structured ProfilingResults object.
 */
export function parseProfilingData(data: string): [ProfilingResults, TreeNode] {
    const decorationData: ProfilingResults = {};

    // Split the input data into lines
    const lines = data.trim().split('\n');
    let uid = 0;

    const root: TreeNode = {
        uid: uid,
        functionName: 'all',
        numSamples: 0,
        filePath: '',
        lineNumber: 0,
        depth: 0,
        fileLineId: -1,
        color: '#808080',
        children: [],
    };
    const fileLineToInt: Record<string, number> = {};

    lines.forEach((originalLine, lineIndex) => {
        const line = originalLine.trim();
        if (line === '') return; // Skip empty lines

        // Separate the call stack from the sample count
        const lastSpaceIndex = line.lastIndexOf(' ');
        if (lastSpaceIndex === -1) return;

        let currentNode = root;
        let currentDepth = 0;

        const callStackStr = line.substring(0, lastSpaceIndex);
        const numSamplesStr = line.substring(lastSpaceIndex + 1);
        const numSamples = parseInt(numSamplesStr, 10);

        if (isNaN(numSamples)) {
            console.warn(`Invalid number of samples: "${numSamplesStr}" in line ${lineIndex + 1}: ${line}`);
            return;
        }

        // Split the call stack into individual frames
        const frames = callStackStr
            .split(';')
            .map((frameStr) => frameStr.trim())
            .filter((f) => f !== '');

        let accumulatedCallStack = '';
        const processedLocations = new Set<string>();

        frames.forEach((frame, frameIndex) => {
            // Extract node info
            // Match the function name and file:line using regex
            const regex = /\s*(<\w+>|\w+)\s+\(([^:]+):(\d+)\)/;
            const matches = frame.match(regex);
            if (!matches) {
                console.warn(`Invalid frame format at line ${lineIndex + 1}, frame ${frameIndex + 1}: "${frame}"`);
                return;
            }
            const functionName = matches[1].trim();
            const filePath = matches[2].trim();
            const fileName = basename(filePath);
            const lineNumber = parseInt(matches[3].trim());
            const moduleName = getModuleName(filePath);
            const fileLineKey = `${filePath}:${lineNumber}`;

            if (!fileLineToInt[fileLineKey]) fileLineToInt[fileLineKey] = uid;

            // construct the FlameTree node
            let childNode = currentNode.children?.find(
                (child) =>
                    child.functionName === functionName &&
                    child.filePath === filePath &&
                    child.lineNumber === lineNumber
            );
            currentDepth++;
            uid++;
            if (!childNode) {
                childNode = {
                    uid: uid,
                    functionName: functionName,
                    filePath: filePath,
                    lineNumber: lineNumber,
                    numSamples: 0,
                    color: getNodeColor(filePath, lineNumber, fileName),
                    children: [],
                    parent: undefined, // avoid circular ref for serialization
                    depth: currentDepth,
                    fileLineId: fileLineToInt[fileLineKey],
                    moduleName: moduleName,
                };
                currentNode.children?.push(childNode);
            }
            childNode.numSamples += numSamples;
            currentNode = childNode;

            // Construct the decoration tree node
            // Skip if the location has already been processed in the current stack trace. This happens for recursive calls
            if (processedLocations.has(fileLineKey)) return;
            processedLocations.add(fileLineKey);

            // Initialize the file entry if it doesn't exist
            decorationData[fileName] ??= [];
            let profilingResults = decorationData[fileName];

            // get index of filePath in the list of filePaths
            let filePathIndex = profilingResults.findIndex((x) => x.filePath === filePath);

            let profilingResult: ProfilingResult;
            if (filePathIndex === -1) {
                profilingResult = {
                    filePath,
                    profile: {},
                    functionProfile: {},
                };
                profilingResults.push(profilingResult);
            } else profilingResult = profilingResults[filePathIndex];

            let profile = profilingResult.profile;
            let functionProfile = profilingResult.functionProfile;

            profile[lineNumber] ??= { functionName: functionName, numSamples: {} };
            profile[lineNumber].numSamples[accumulatedCallStack] ??= 0;
            profile[lineNumber].numSamples[accumulatedCallStack] += numSamples;

            functionProfile[functionName] ??= {
                totalSamples: 0,
                maxSamples: 0,
            };
            functionProfile[functionName].totalSamples += numSamples;
            functionProfile[functionName].maxSamples = Math.max(functionProfile[functionName].maxSamples, numSamples);

            // Update the accumulated call stack for the next frame
            accumulatedCallStack = accumulatedCallStack
                ? `${accumulatedCallStack};${functionName} (${filePath}:${lineNumber})`
                : `${functionName} (${filePath}:${lineNumber})`;
        });
        root.numSamples += numSamples;
    });

    return [decorationData, sortTreeNodeChildren(root)];
}
