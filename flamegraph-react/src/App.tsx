import { FlameGraph } from './components/Flamegraph';
import { Flamenode, FlattenedFlamenode, Function } from './components/types';
import { useState, useEffect } from 'react';
import './tailwind.css';
import { reconstructTreeFromFlattened, addParents, updateNodesWithSourceCode } from './utilities/flamegraphUtils';

declare global {
    interface Window {
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
        };
    }
}

export default function Home() {
    const [parsedData, setParsedData] = useState<{
        root: Flamenode;
        functions: Function[];
        profileType: 'py-spy' | 'memray';
    } | null>(null);
    const [originalRoot, setOriginalRoot] = useState<Flamenode | null>(null);
    const [sourceCodeVersion, setSourceCodeVersion] = useState(0);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            if (message.type === 'profile-data') {
                const { flattenedNodes, rootUid, focusUid, functions, sourceCode, profileType } = message.data as {
                    flattenedNodes: FlattenedFlamenode[];
                    rootUid: number;
                    focusUid: number;
                    functions: Function[];
                    sourceCode: string[];
                    profileType: 'py-spy' | 'memray';
                };
                const { root, focusNode } = reconstructTreeFromFlattened(flattenedNodes || [], rootUid, focusUid);

                addParents(root);
                setOriginalRoot(root);
                updateNodesWithSourceCode(root, sourceCode);
                setParsedData({ root: focusNode, functions, profileType });
            } else if (message.type === 'source-code' && originalRoot) {
                const sourceCodeArray = message.data as string[];
                updateNodesWithSourceCode(originalRoot, sourceCodeArray);

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
                    profileType={parsedData.profileType}
                    key={`flamegraph-${sourceCodeVersion}`}
                />
            </div>
        </div>
    );
}
