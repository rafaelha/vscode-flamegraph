export interface LegendItem {
    name: string;
    color: string;
    totalValue: number;
}

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
    functionId: string;
}
