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

export default function Home() {
    const [parsedData, setParsedData] = useState<{ root: Flamenode; functions: Function[] } | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'profile-data') {
                const { root, functions } = message.data as { root: Flamenode; functions: Function[] };
                const focusUid = message.focusUid as number;

                addParents(root);
                setParsedData({ root: getNodeWithUid(root, focusUid) || root, functions });
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
                <FlameGraph root={parsedData.root} functions={parsedData.functions} />
            </div>
        </div>
    );
}
