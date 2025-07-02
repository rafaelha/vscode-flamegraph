export type NotebookCellMap = Map<string, { cellIndex: number; cellUri: string }>;
export type UriToCodeMap = Map<string, string>;
export type FrameId = number;
export type FunctionId = number;
export type LineNumber = number;

export type Function = {
    functionName: string;
    shortFunctionName?: string;
    filePath?: string;
    fileName?: string;
    shortFilename?: string;
    module?: string;
    moduleHue: number; // for module name
    functionHue?: number; // for function name
};

export type Flamenode = {
    uid: number;
    parentUid?: number;
    frameId: FrameId; // unique id for the frame, which is (functionName, filePath, lineNumber)
    functionId: FunctionId; // unique id for the function, which is (functionName, filePath)
    line?: LineNumber; // line number of the source code for this node
    cell?: number; // cell number of the source code for this node, if the source code is in a jupyter notebook
    sourceCode?: string; // the string of source code for this line
    depth: number; // depth in the tree
    samples: number; // total number of samples for this node as recorded in the profile
    ownSamples: number; // for recursive functions, this is the number of samples for the deepest occurrence
    children: Flamenode[];
    enterTime?: number; // Euler tour enter time
    exitTime?: number; // Euler tour exit time
};

export type FlattenedFlamenode = Omit<Flamenode, 'children'> & {
    childrenUids: number[];
};

export type LineProfile = {
    line: number;
    nodes: Flamenode[];
};

export type FileIndex = {
    // map fileName to a list of matching filePaths
    [fileName: string]: {
        filePath: string;
        lineProfiles: LineProfile[]; // profile data associated with lines in the file
    }[];
};
