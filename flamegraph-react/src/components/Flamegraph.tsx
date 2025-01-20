import React, { useState, useEffect } from 'react';
import './Flamegraph.css';
import { vscode } from '../utilities/vscode';
import { Legend } from './Legend';
import { Flamenode, Function } from './types';
import { FlameNode } from './FlameNode';

export function FlameGraph({
    root,
    functions,
    height = 23,
}: {
    root: Flamenode;
    functions: Function[];
    height?: number;
}) {
    const [focusNode, setFocusNode] = useState<Flamenode>(root);
    const [hoveredLineId, setHoveredLineId] = useState<number | null>(null);
    const [hoveredFunctionId, setHoveredFunctionId] = useState<number | null>(null);
    const [isCommandPressed, setIsCommandPressed] = useState(false);

    const rootValue = root.samples;

    React.useEffect(() => {
        setFocusNode(root);
    }, [root]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.metaKey || e.ctrlKey) setIsCommandPressed(true);
        }

        function handleKeyUp(e: KeyboardEvent) {
            if (!e.metaKey && !e.ctrlKey) setIsCommandPressed(false);
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', () => setIsCommandPressed(false));

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', () => setIsCommandPressed(false));
        };
    }, []);

    function handleNodeClick(node: Flamenode, e: React.MouseEvent) {
        if (e.metaKey || e.ctrlKey) {
            const functionData = functions[node.functionId];
            if (!functionData?.filePath) return;
            vscode.postMessage({
                command: 'open-file',
                file: functionData.filePath,
                line: node.line || 1,
            });
        } else {
            setFocusNode(node);
            vscode.postMessage({
                command: 'set-focus-node',
                uid: node.uid,
                focusFunctionId: functions[node.functionId]?.functionName,
            });
        }
    }

    const moduleMap = new Map<string, { hue: number; totalValue: number }>();

    function filter(node: Flamenode): boolean {
        const module = functions[node.functionId]?.module;
        if (module) {
            const existing = moduleMap.get(module);
            moduleMap.set(module, {
                hue: existing?.hue || functions[node.functionId]?.moduleHue || 0,
                totalValue: (existing?.totalValue || 0) + node.samples,
            });
        }

        return functions[node.functionId]?.fileName?.startsWith('<') ?? false;
    }

    // Calculate focusDepth once
    let focusDepth = 0;
    let current = focusNode;
    filter(current);
    while (current.parent) {
        if (!filter(current.parent)) focusDepth++;
        current = current.parent;
    }

    function createFlameNode(node: Flamenode, depth: number, x: number, width: number) {
        return (
            <FlameNode
                key={node.uid}
                node={node}
                functions={functions}
                depth={depth}
                focusDepth={focusDepth}
                x={x}
                width={width}
                height={height}
                rootValue={rootValue}
                focusNodeValue={focusNode.samples}
                isCommandPressed={isCommandPressed}
                hoveredLineId={hoveredLineId}
                hoveredFunctionId={hoveredFunctionId}
                onNodeClick={handleNodeClick}
                onNodeHover={(frameId, functionId) => {
                    setHoveredLineId(frameId);
                    setHoveredFunctionId(functionId);
                }}
            />
        );
    }

    function renderNodes(): React.ReactNode[] {
        const nodes: React.ReactNode[] = [];

        // Render parents (full width)
        current = focusNode;
        let depth = focusDepth;
        while (current.parent) {
            if (!filter(current.parent)) {
                depth--;
                nodes.push(createFlameNode(current.parent, depth, 0, 1));
            }
            current = current.parent;
        }

        // Render focus node (full width)
        nodes.push(createFlameNode(focusNode, focusDepth, 0, 1));

        let maxDepth = 0;

        // Render children at respective position and width
        function renderChildren(node: Flamenode, depth: number, startX: number) {
            let currentX = startX;
            maxDepth = Math.max(maxDepth, depth + 1);

            // sort children by file name and line number
            node.children?.sort((a, b) => {
                const aFile = functions[a.functionId]?.fileName || '';
                const bFile = functions[b.functionId]?.fileName || '';
                const aLine = a.line || 0;
                const bLine = b.line || 0;
                return aFile.localeCompare(bFile) || aLine - bLine;
            });

            node.children?.forEach((child) => {
                const childWidth = child.samples / focusNode.samples;
                if (!filter(child)) {
                    nodes.push(createFlameNode(child, depth + 1, currentX, childWidth));
                    if (childWidth >= 0.008) {
                        renderChildren(child, depth + 1, currentX);
                    }
                    currentX += childWidth;
                } else {
                    renderChildren(child, depth, currentX);
                }
            });
        }

        renderChildren(focusNode, focusDepth, 0);

        // Add a single invisible placeholder node at the bottom
        nodes.push(
            <div
                key="placeholder"
                style={{
                    position: 'absolute',
                    height: `${height * 2}px`,
                    opacity: 0,
                    width: '100%',
                    top: `${(maxDepth + 1) * height}px`,
                }}
            />
        );

        return nodes;
    }

    const renderedNodes = renderNodes();

    const legendItems = Array.from(moduleMap.entries())
        .map(([name, { hue, totalValue }]) => ({ name, hue, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue);

    return (
        <div className="flamegraph relative">
            {renderedNodes}
            <Legend items={legendItems} />
        </div>
    );
}
