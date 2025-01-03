import { basename } from 'path';
import { readFileSync } from 'fs';
import { getModuleName, toUnixPath } from './pathUtils';
import { strToHue } from './colors';

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
    hue: number;
    cmdHue: number;
    fileLineId: number;
    functionId: string;
    filePath?: string;
    fileName: string;
    lineNumber?: number;
    codeLine?: string;
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
    hue: number;
    cmdHue: number;
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
        // Parse each frame using a regex. Py-spy records a frame either as
        // functionName (filePath:lineNumber)
        // functionName (filePath)
        // functionName
        const frameRegex = /^(.+?)(?:\s+\(([^:)]+)(?::(\d+))?\))?$/;
        const matches = frame.match(frameRegex);

        if (matches) {
            const [, functionName, filePath, lineNumberStr] = matches;
            if (!functionName) continue; // A function name should always be defined

            const lineNumber = lineNumberStr ? parseInt(lineNumberStr, 10) : undefined;

            // Get the module name from the file path. If the name contains 'process' followed by a number,
            // it is a process frame and the module name is 'process'.
            const moduleName = /process \d+/.test(functionName) ? 'process' : (getModuleName(filePath) ?? '');

            result.push({
                functionName,
                filePath: filePath || '',
                fileName: filePath ? basename(filePath) : '',
                lineNumber,
                moduleName,
                fileLineKey: filePath ? `${filePath}${lineNumber ? `:${lineNumber}` : ''}` : functionName,
                functionId: functionName + (filePath || ''),
                hue: strToHue(moduleName),
                cmdHue: strToHue(functionName),
            });
        }
    }

    return result;
}

const fileCache: Map<string, string[]> = new Map();

function getCodeLine(filePath: string, lineNumber?: number): string {
    if (!filePath || !lineNumber) return '';

    try {
        // Check cache first
        let lines = fileCache.get(filePath);

        if (!lines) {
            // Read file and cache its lines
            const fileContent = readFileSync(filePath, 'utf-8');
            lines = fileContent.split('\n');
            fileCache.set(filePath, lines);
        }

        // Line numbers are 1-based, array is 0-based
        return lines[lineNumber - 1]?.trim() || '';
    } catch (error) {
        // Return empty string if file can't be read
        return '';
    }
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
        fileLineId: -1,
        hue: 240,
        cmdHue: 240,
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
        const parentIds = new Set<number>([root.uid]);
        let currentCallStackStr = '';
        for (const frame of frames) {
            if (!fileLineToInt[frame.fileLineKey]) fileLineToInt[frame.fileLineKey] = uid;

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
                    codeLine: getCodeLine(frame.filePath, frame.lineNumber),
                    numSamples,
                    hue: frame.hue,
                    cmdHue: frame.cmdHue,
                    children: [],
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
