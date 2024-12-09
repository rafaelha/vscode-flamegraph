import { basename } from 'path';
import { getModuleName } from './getUri';
import { getNodeColor } from './colors';

export type ProfilingEntry = {
    numSamples: number;
    callStackUids: Set<number>;
    callStackString: string;
    functionId: string;
    uid: number;
};

export type ProfilingResult = {
    filePath: string;
    profile: {
        [lineNumber: string]: {
            functionName: string;
            samples: ProfilingEntry[];
        };
    };
    functionProfile: {
        [functionName: string]: {
            totalSamples: number;
            callStackUids: Set<number>;
        }[];
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
    functionId: string;
    filePath?: string;
    fileName: string;
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

interface Frame {
    functionName: string;
    filePath: string;
    fileName: string;
    lineNumber?: number;
    moduleName?: string;
    fileLineKey: string;
    functionId: string;
    uid?: number;
    parentIds?: Set<number>;
    callStackStr?: string;
}

function parseStackTrace(stackString: string): Frame[] {
    const frames = stackString
        .split(';')
        .map((frameStr) => frameStr.trim())
        .filter((f) => f !== '');

    const result: Frame[] = [];

    for (const frame of frames) {
        // Add new regex for process frames
        const processRegex = /process\s+(\d+):"([^"]+)"/;
        const standardRegex = /\s*(<\w+>|\w+)\s+\(([^:]+):(\d+)\)/;

        const processMatches = frame.match(processRegex);
        const standardMatches = frame.match(standardRegex);

        if (processMatches) {
            const filePath = processMatches[2].trim();
            result.push({
                functionName: `process ${processMatches[1]}`,
                filePath,
                fileName: '',
                fileLineKey: filePath,
                functionId: `process_${processMatches[1]}_${filePath}`,
            });
        } else if (standardMatches) {
            const filePath = standardMatches[2].trim();
            const lineNumber = parseInt(standardMatches[3].trim(), 10);
            const functionName = standardMatches[1].trim();

            result.push({
                functionName,
                filePath,
                fileName: basename(filePath),
                lineNumber,
                moduleName: getModuleName(filePath),
                fileLineKey: `${filePath}:${lineNumber}`,
                functionId: functionName + filePath,
            });
        }
    }

    return result;
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
        uid,
        functionName: 'all',
        functionId: 'all',
        numSamples: 0,
        filePath: '',
        fileName: '',
        lineNumber: 0,
        depth: 0,
        fileLineId: -1,
        color: '#808080',
        children: [],
    };
    const fileLineToInt: Record<string, number> = {};

    lines.forEach((originalLine) => {
        const line = originalLine.trim();
        if (line === '') return; // Skip empty lines

        // Separate the call stack from the sample count
        const lastSpaceIndex = line.lastIndexOf(' ');
        if (lastSpaceIndex === -1) return;

        const callStackStr = line.substring(0, lastSpaceIndex);
        const numSamplesStr = line.substring(lastSpaceIndex + 1);
        const numSamples = parseInt(numSamplesStr, 10);

        if (Number.isNaN(numSamples)) {
            return;
        }

        const frames = parseStackTrace(callStackStr);
        root.numSamples += numSamples;
        let currentNode = root;
        let currentDepth = 0;
        const parentIds = new Set<number>([root.uid]);
        let currentCallStackStr = '';
        for (const frame of frames) {
            if (!fileLineToInt[frame.fileLineKey]) fileLineToInt[frame.fileLineKey] = uid;
            currentDepth += 1;

            let node = currentNode.children?.find(
                (child) =>
                    child.functionName === frame.functionName &&
                    child.filePath === frame.filePath &&
                    child.lineNumber === frame.lineNumber
            );
            if (!node) {
                uid += 1; // increase uid and create new node
                node = {
                    uid,
                    functionName: frame.functionName,
                    filePath: frame.filePath,
                    fileName: frame.fileName,
                    lineNumber: frame.lineNumber,
                    numSamples,
                    color: getNodeColor(frame.filePath, frame.lineNumber, frame.fileName),
                    children: [],
                    depth: currentDepth,
                    fileLineId: fileLineToInt[frame.fileLineKey],
                    functionId: frame.functionId,
                    moduleName: frame.moduleName,
                };
                currentNode.children?.push(node);
            } else {
                node.numSamples += numSamples;
            }
            currentCallStackStr += `${frame.functionName}/`;
            frame.callStackStr = currentCallStackStr;

            parentIds.add(node.uid);
            frame.parentIds = new Set<number>(parentIds);
            frame.uid = node.uid;

            currentNode = node;
        }

        const processedLocations = new Set<string>();
        for (const frame of frames.reverse()) {
            // Construct the decoration tree node
            if (
                frame.functionName.startsWith('<') &&
                frame.functionName.endsWith('>') &&
                frame.functionName !== '<module>'
            )
                // Skip inline functions, such is <listcomp> since they cannot be resolved to a file/function
                continue;
            // Skip if the location has already been processed in the current stack trace. This happens for recursion
            if (processedLocations.has(frame.functionName + frame.filePath)) continue;
            processedLocations.add(frame.functionName + frame.filePath);

            // Initialize the file entry if it doesn't exist
            decorationData[frame.fileName] ??= [];
            const profilingResults = decorationData[frame.fileName];

            // get index of filePath in the list of filePaths
            const filePathIndex = profilingResults.findIndex((x) => x.filePath === frame.filePath);

            let profilingResult: ProfilingResult;
            if (filePathIndex === -1) {
                profilingResult = {
                    filePath: frame.filePath,
                    profile: {},
                    functionProfile: {},
                };
                profilingResults.push(profilingResult);
            } else profilingResult = profilingResults[filePathIndex];

            const { profile } = profilingResult;
            const { functionProfile } = profilingResult;

            const frameLineNumber = frame.lineNumber ?? -1;
            profile[frameLineNumber] ??= {
                functionName: frame.functionName,
                samples: [],
            };
            const frameUid = frame.uid ? frame.uid : -1;
            let i = profile[frameLineNumber].samples.findIndex((x) => x.uid === frameUid);
            if (i === -1) {
                profile[frameLineNumber].samples.push({
                    callStackString: frame.callStackStr ? frame.callStackStr : '',
                    callStackUids: frame.parentIds ? frame.parentIds : new Set<number>([0]),
                    functionId: frame.functionName + frame.filePath,
                    uid: frameUid,
                    numSamples,
                });
            } else {
                profile[frameLineNumber].samples[i].numSamples += numSamples;
            }

            functionProfile[frame.functionName] ??= [];
            i = functionProfile[frame.functionName].findIndex((x) => x.callStackUids === frame.parentIds);
            if (i === -1) {
                functionProfile[frame.functionName].push({
                    totalSamples: numSamples,
                    callStackUids: frame.parentIds ? frame.parentIds : new Set<number>([0]),
                });
            } else {
                functionProfile[frame.functionName][i].totalSamples += numSamples;
            }
        }
    });

    return [decorationData, sortTreeNodeChildren(root)];
}
