import { basename } from 'path';
import { getModuleName, toUnixPath } from './pathUtils';
import { getNodeColor } from './colors';

/**
 * A sample from a stack trace.
 */
export type StackProfileSample = {
    numSamples: number;
    callStackUids: Set<number>;
    callStackString: string;
    functionId: string;
    uid: number; // uid of the corresponding node in the flamegraph
};

/**
 * A profile for a file.
 */
export type FileProfileData = {
    filePath: string;
    lineProfiles: {
        [lineNumber: string]: {
            functionName: string;
            samples: StackProfileSample[];
        };
    };
    functionProfiles: {
        [functionName: string]: {
            totalSamples: number;
            callStackUids: Set<number>;
        }[];
    };
};

/**
 * A map of file names to their profile data.
 */
export type ProfilesByFile = {
    [fileName: string]: FileProfileData[];
};

/**
 * A node in the flamegraph.
 */
export interface FlamegraphNode {
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
    children?: FlamegraphNode[];
    parent?: FlamegraphNode;
    moduleName?: string;
}

/**
 * Each profiling sample consists of multiple frames that form a complete call stack trace.
 */
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

/**
 * Sorts the children of a flamegraph node.
 *
 * @param node - The node to sort the children of. To sort the entire flamegraph, pass in the root node.
 * @returns The sorted node.
 */
function sortChildren(node: FlamegraphNode): FlamegraphNode {
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
        node.children.forEach(sortChildren);
    }

    return node;
}

/**
 * Parses a stack trace string into a list of frames.
 *
 * @param stackString - The stack trace string to parse.
 * @returns The list of frames.
 */
function parseStackTrace(stackString: string): Frame[] {
    const frames = stackString
        .split(';')
        .map((frameStr) => frameStr.trim())
        .filter((f) => f !== '');

    const result: Frame[] = [];

    for (const frame of frames) {
        // Add new regex for process frames
        const processRegex = /process\s+(\d+):"([^"]+)"/;
        const standardRegex = /\s*(<[^>]+>|\w+)\s*\((.+):(\d+)\)/;

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
 * Parses profiling data and structures it into two data structures:
 * - ProfilesByFile: A nested data structure optimized for efficient lookup when the file and line number is known. This
 *   is used for line decorations. Note that line decorations will combine the data from multiple call stack samples if
 *   these call stacks include the same file and line number.
 * - FlamegraphNode: A tree structure resolving the call stack into a tree of nodes. This is used for the flamegraph.
 *
 * @param data - The raw profiling data as a string.
 * @returns A tuple containing the decoration data and the root node of the flamegraph.
 */
export function parseProfilingData(data: string): [ProfilesByFile, FlamegraphNode] {
    const decorationData: ProfilesByFile = {};

    // Split the input data into lines
    const lines = data.trim().split('\n');
    let uid = 0;

    const root: FlamegraphNode = {
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
        // Process frames in reverse order to populate the decoration data. For recursive calls, only inner frames
        // of the same function will be processed to avoid double counting.
        for (const frame of frames.reverse()) {
            // Construct the decoration tree node
            if (
                frame.functionName.startsWith('<') &&
                frame.functionName.endsWith('>') &&
                frame.functionName !== '<module>'
            )
                // Skip inline functions, such is <listcomp> since they cannot be resolved to a file/function
                continue;

            const filePath = toUnixPath(frame.filePath);
            const fileName = frame.fileName.toLowerCase();

            // Skip if the location has already been processed in the current stack trace. This happens for recursion
            if (processedLocations.has(frame.functionName + filePath)) continue;
            processedLocations.add(frame.functionName + filePath);

            // Initialize the file entry if it doesn't exist
            decorationData[fileName] ??= [];
            const profilingResults = decorationData[fileName];

            // get index of filePath in the list of filePaths
            const filePathIndex = profilingResults.findIndex((x) => x.filePath === filePath);

            let profilingResult: FileProfileData;
            if (filePathIndex === -1) {
                profilingResult = {
                    filePath,
                    lineProfiles: {},
                    functionProfiles: {},
                };
                profilingResults.push(profilingResult);
            } else profilingResult = profilingResults[filePathIndex];

            const { lineProfiles: profile } = profilingResult;
            const { functionProfiles: functionProfile } = profilingResult;

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
                    functionId: frame.functionName + filePath,
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

    return [decorationData, sortChildren(root)];
}
