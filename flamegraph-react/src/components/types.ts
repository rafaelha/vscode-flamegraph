/**
 * Represents an item in the legend shown at the bottom of the flamegraph.
 */
export interface LegendItem {
    name: string;
    color: string;
    totalValue: number;
}

/**
 * Represents a node in the flamegraph tree.
 */
export interface FlamegraphNode {
    uid: number;
    functionName: string;
    numSamples: number;
    depth: number;
    color: string;
    fileLineId: number;
    filePath?: string;
    fileName: string;
    lineNumber?: number;
    children?: FlamegraphNode[];
    parent?: FlamegraphNode;
    moduleName?: string;
    functionId: string;
}
