/**
 * Represents an item in the legend shown at the bottom of the flamegraph.
 */
export interface LegendItem {
    name: string;
    hue: number;
    totalValue: number;
}

/**
 * Represents a node in the flamegraph tree.
 */
export interface FlamegraphNode {
    uid: number;
    functionName: string;
    numSamples: number;
    hue: number;
    cmdHue: number;
    fileLineId: number;
    filePath?: string;
    fileName: string;
    lineNumber?: number;
    codeLine?: string;
    children?: FlamegraphNode[];
    parent?: FlamegraphNode;
    moduleName?: string;
    functionId: string;
}
