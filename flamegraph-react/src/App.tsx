import { FlameGraph } from './components/Flamegraph';
import { FlamegraphNode } from './components/types';
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
function addParents(node: FlamegraphNode, parent?: FlamegraphNode) {
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
function getNodeWithUid(node: FlamegraphNode, uid: number): FlamegraphNode | null {
    if (node.uid === uid) return node;
    if (!node.children) return null;

    for (const child of node.children) {
        const result = getNodeWithUid(child, uid);
        if (result) return result;
    }
    return null;
}

export default function Home() {
    const [parsedData, setParsedData] = useState<FlamegraphNode | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'profile-data') {
                const root = message.data as FlamegraphNode;
                const focusUid = message.focusUid as number;

                addParents(root);
                setParsedData(getNodeWithUid(root, focusUid) || root);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

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
                <FlameGraph data={parsedData} />
            </div>
        </div>
    );
}
