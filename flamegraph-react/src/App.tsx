import { FlameGraph } from './components/flame-graph';
import { TreeNode } from './components/types';
import { useState, useEffect } from 'react';
import './tailwind.css';

declare global {
    interface Window {
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
        };
    }
}

function addParents(node: TreeNode, parent?: TreeNode) {
    if (parent) {
        node.parent = parent;
    }

    if (node.children) {
        node.children.forEach((child) => addParents(child, node));
    }
}

function getNodeWithUid(node: TreeNode, uid: number): TreeNode | null {
    if (node.uid === uid) return node;
    if (!node.children) return null;

    for (const child of node.children) {
        const result = getNodeWithUid(child, uid);
        if (result) return result;
    }
    return null;
}

export default function Home() {
    const [parsedData, setParsedData] = useState<TreeNode | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'profile-data') {
                const root = message.data as TreeNode;
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
