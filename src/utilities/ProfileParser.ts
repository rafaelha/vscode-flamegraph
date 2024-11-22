import { basename } from 'path';

/**
 * Normalizes a file path to use forward slashes. This is important for comparing file paths on different platforms.
 *
 * @param filePath - The file path to normalize.
 * @returns The normalized file path.
 */
export function normalizePath(filePath: string) {
    return filePath.replace(/\\/g, '/');
}

export type ProfilingEntry = {
    num_samples: number;
    function_name: string;
};

export type ProfilingResult = {
    filePath: string;
    profile: {
        [lineNumber: string]: {
            functionName: string;
            numSamples: {
                [callStack: string]: number; // num_samples
            };
        };
    };
    functionProfile: {
        [functionName: string]: {
            total_samples: number;
            max_samples: number;
        };
    };
};

export type ProfilingResults = {
    [fileName: string]: ProfilingResult[];
};

export interface TreeNode {
    uid: number;
    name: string;
    value: number;
    depth: number;
    color: string;
    fileLineId: number;
    file?: string;
    line?: number;
    children?: TreeNode[];
    parent?: TreeNode;
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function getNodeColor(file?: string, line?: number, functionName?: string): string {
    if (!file || !line || !functionName) return '#808080';

    const moduleName = file.replace(/\//g, '\\').split('\\')[0];

    const hue = (hashString(moduleName ?? '') + 50) % 360;
    const saturation = 50 + (hashString(functionName) % 50);
    const lightness = 25 + (line % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function sortTreeNodeChildren(node: TreeNode): TreeNode {
    // Sort current node's children
    if (node.children) {
        node.children.sort((a, b) => {
            // First compare by file
            const fileCompare = (a.file || '').localeCompare(b.file || '');
            if (fileCompare !== 0) return fileCompare;
            // Then by line number
            return (a.line || 0) - (b.line || 0);
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
        name: 'all',
        value: 0,
        file: '',
        line: 0,
        depth: 0,
        fileLineId: -1,
        color: '#808080',
        children: [],
    };
    const fileLineToInt: Record<string, number> = {};

    lines.forEach((originalLine, lineIndex) => {
        const line = originalLine.trim();
        if (line === '') {
            return; // Skip empty lines
        }

        // Separate the call stack from the sample count
        const lastSpaceIndex = line.lastIndexOf(' ');
        if (lastSpaceIndex === -1) {
            return;
        }

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

        // To build the call stack progressively
        let accumulatedCallStack = '';
        const processedLocations = new Set<string>();

        frames.forEach((frame, frameIndex) => {
            // Match the function name and file:line using regex
            // const regex = /\s*(\w+)\s+\(([^:]+):(\d+)\)/;
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
            const locationKey = `${filePath}:${lineNumber}`;

            const fileLineKey = `${filePath}:${line}`;
            if (!fileLineToInt[fileLineKey]) {
                fileLineToInt[fileLineKey] = uid;
            }

            // Skip if the location has already been processed in the current stack trace. This happens for recursive calls
            if (processedLocations.has(locationKey)) {
                return;
            }
            processedLocations.add(locationKey);

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
            } else {
                profilingResult = profilingResults[filePathIndex];
            }

            let profile = profilingResult.profile;
            let functionProfile = profilingResult.functionProfile;

            profile[lineNumber] ??= { functionName: functionName, numSamples: {} };
            profile[lineNumber].numSamples[accumulatedCallStack] ??= 0;
            profile[lineNumber].numSamples[accumulatedCallStack] += numSamples;

            functionProfile[functionName] ??= {
                total_samples: 0,
                max_samples: 0,
            };
            functionProfile[functionName].total_samples += numSamples;
            functionProfile[functionName].max_samples = Math.max(functionProfile[functionName].max_samples, numSamples);

            // Update the accumulated call stack for the next frame
            accumulatedCallStack = accumulatedCallStack
                ? `${accumulatedCallStack};${functionName} (${filePath}:${lineNumber})`
                : `${functionName} (${filePath}:${lineNumber})`;

            let childNode = currentNode.children?.find(
                (child) => child.name === functionName && child.file === filePath && child.line === lineNumber
            );
            currentDepth++;
            uid++;
            if (!childNode) {
                childNode = {
                    uid: uid,
                    name: functionName,
                    file: filePath,
                    line: lineNumber,
                    value: 0,
                    color: getNodeColor(filePath, lineNumber, fileName),
                    children: [],
                    parent: undefined, // avoid circular ref for serialization
                    depth: currentDepth,
                    fileLineId: fileLineToInt[fileLineKey],
                };
                currentNode.children?.push(childNode);
            }

            childNode.value += numSamples;
            currentNode = childNode;
        });
        root.value += numSamples;
    });

    return [decorationData, sortTreeNodeChildren(root)];
}
