import { FlameGraph } from './components/Flamegraph';
import { Flamenode, Function } from './components/types';
import { useState, useEffect } from 'react';
import './tailwind.css';

declare global {
    interface Window {
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
        };
    }
}

/**
 * Adds parents to the tree nodes.
 *
 * @param node - The node to add parents to.
 * @param parent - The parent node.
 */
function addParents(node: Flamenode, parent?: Flamenode) {
    if (parent) node.parent = parent;
    if (node.children) node.children.forEach((child) => addParents(child, node));
}

/**
 * Traverses the tree starting from `node` and returns the node with the given UID.
 *
 * @param node - The node to search.
 * @param uid - The UID to search for.
 * @returns The node with the given UID or null if not found.
 */
function getNodeWithUid(node: Flamenode, uid: number): Flamenode | null {
    if (node.uid === uid) return node;
    if (!node.children) return null;

    for (const child of node.children) {
        const result = getNodeWithUid(child, uid);
        if (result) return result;
    }
    return null;
}

/**
 * Updates the nodes with source code
 * @param node - The node to update
 * @param sourceCodeArray - The source code array
 */
const updateNodesWithSourceCode = (node: Flamenode, sourceCodeArray?: string[]) => {
    if (!sourceCodeArray) return;
    // If the node has a UID that corresponds to an index in the sourceCodeArray
    if (node.uid >= 0 && node.uid < sourceCodeArray.length) {
        node.sourceCode = sourceCodeArray[node.uid];
    }

    // Process children recursively
    if (node.children) {
        node.children.forEach((child) => updateNodesWithSourceCode(child, sourceCodeArray));
    }
};

export default function Home() {
    const [parsedData, setParsedData] = useState<{ root: Flamenode; functions: Function[] } | null>(null);
    const [originalRoot, setOriginalRoot] = useState<Flamenode | null>(null);
    const [sourceCodeVersion, setSourceCodeVersion] = useState(0);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            if (message.type === 'profile-data') {
                const { root, functions, sourceCode } = message.data as {
                    root: Flamenode;
                    functions: Function[];
                    sourceCode: string[];
                };
                const focusUid = message.focusUid as number;

                addParents(root);
                setOriginalRoot(root);
                updateNodesWithSourceCode(root, sourceCode);
                setParsedData({ root: getNodeWithUid(root, focusUid) || root, functions });
            } else if (message.type === 'source-code' && originalRoot) {
                const sourceCodeArray = message.data as string[];

                // Update the nodes with source code in place
                updateNodesWithSourceCode(originalRoot, sourceCodeArray);

                // Update the state with the modified data, maintaining the current focus
                setParsedData((prevData) => {
                    if (!prevData) return null;
                    return {
                        root: getNodeWithUid(originalRoot, prevData.root?.uid ?? 0) || originalRoot,
                        functions: prevData.functions,
                    };
                });

                // Increment the version to force a re-render
                setSourceCodeVersion((prev) => prev + 1);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [originalRoot]);

    if (!parsedData) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Loading profile data...</p>
            </div>
        );
    }

    return (
        <div className="App min-h-screen relative">
            <div className="pb-12">
                <FlameGraph
                    root={parsedData.root}
                    functions={parsedData.functions}
                    key={`flamegraph-${sourceCodeVersion}`}
                />
            </div>
        </div>
    );
}
