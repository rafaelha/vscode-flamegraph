import { FlameGraph, TreeNode } from './components/flame-graph';
import React, { useState, useEffect, useMemo } from 'react';
import './tailwind.css';

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

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

export default function Home() {
    const [parsedData, setParsedData] = useState<TreeNode | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'profile-data') {
                const root = message.data as TreeNode;
                addParents(root);
                setParsedData(root);
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
