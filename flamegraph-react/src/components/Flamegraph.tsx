import React, { useState, useEffect } from 'react';
import './Flamegraph.css';
import { vscode } from '../utilities/vscode';
import { Legend } from './Legend';
import { FlamegraphNode } from './types';
import { Highlight, themes } from 'prism-react-renderer';

export function FlameGraph({ data, height = 23 }: { data: FlamegraphNode; height?: number }) {
    const [focusNode, setFocusNode] = useState<FlamegraphNode>(data);
    const [hoveredLineId, setHoveredLineId] = useState<number | null>(null);
    const [hoveredFunctionId, setHoveredFunctionId] = useState<string | null>(null);
    const [isCommandPressed, setIsCommandPressed] = useState(false);

    const rootValue = data.numSamples;

    React.useEffect(() => {
        setFocusNode(data);
    }, [data]);

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

    const moduleMap = new Map<string, { hue: number; totalValue: number }>();

    function renderNode(node: FlamegraphNode, depth: number, focusDepth: number, x: number, width: number) {
        // Update module map for legend
        if (node.moduleName) {
            const existing = moduleMap.get(node.moduleName);
            moduleMap.set(node.moduleName, {
                hue: existing?.hue || node.hue,
                totalValue: (existing?.totalValue || 0) + node.numSamples,
            });
        }

        const isHovered = hoveredLineId === node.fileLineId && !node.fileName.startsWith('<') && node.fileName !== '';
        const isRelatedFunction =
            hoveredFunctionId === node.functionId && !node.fileName.startsWith('<') && node.fileName !== '';

        const style = {
            left: `${x * 100}%`,
            width: `calc(${width * 100}% - 2px)`,
            top: `${depth * height}px`,
            height: `${height - 2}px`,
            '--node-hue': isCommandPressed && isRelatedFunction ? node.cmdHue : node.hue,
            position: 'absolute' as const,
            opacity: depth < focusDepth ? 0.35 : 1,
        };

        const handleClick = (e: React.MouseEvent) => {
            if (e.metaKey || e.ctrlKey) {
                if (!node.filePath) return;
                // Send message to extension
                vscode.postMessage({
                    command: 'open-file',
                    file: node.filePath,
                    line: node.lineNumber || 1,
                });
            } else {
                setFocusNode(node);
                // get the stack of all parents uid
                let callStack: number[] = [];
                for (let current = node; current.parent; current = current.parent) callStack.push(current.parent.uid);
                vscode.postMessage({
                    command: 'set-focus-node',
                    uid: node.uid,
                    focusFunctionId: node.functionName,
                    callStack: callStack,
                });
            }
        };

        const className = `graph-node ${isHovered && isCommandPressed ? 'same-line-id command-pressed' : ''}`;

        // Add tooltip content
        const percentageOfTotal = ((node.numSamples / rootValue) * 100).toFixed(1);
        const percentageOfFocus = ((node.numSamples / focusNode.numSamples) * 100).toFixed(1);
        const tooltipContent = [
            `${node.functionName} (${node.lineNumber ? `${node.fileName}:${node.lineNumber}` : node.fileName})`,
            node.codeLine,
            `${node.numSamples / 100}s / ${percentageOfTotal}% / ${percentageOfFocus}%`,
        ]
            .filter(Boolean)
            .join('\n');

        return (
            <div
                key={node.uid}
                className={className}
                style={style}
                onClick={handleClick}
                onMouseEnter={() => {
                    setHoveredLineId(node.fileLineId);
                    setHoveredFunctionId(node.functionId);
                }}
                onMouseLeave={() => {
                    setHoveredLineId(null);
                    setHoveredFunctionId(null);
                }}
                title={tooltipContent}
            >
                {renderNodeContent(node)}
            </div>
        );
    }

    function renderNodes(): React.ReactNode[] {
        const nodes: React.ReactNode[] = [];

        function filter(node: FlamegraphNode): boolean {
            return node.fileName.startsWith('<');
        }

        // Render parents (full width)
        let current = focusNode;

        // Figure out the depth of the focus node by counting the number of parents
        let focusDepth = 0;
        while (current.parent) {
            if (!filter(current.parent)) focusDepth++;
            current = current.parent;
        }

        current = focusNode;
        let depth = focusDepth;
        while (current.parent) {
            if (!filter(current.parent)) {
                depth--;
                nodes.push(renderNode(current.parent, depth, focusDepth, 0, 1));
            }
            current = current.parent;
        }

        // Render focus node (full width)
        nodes.push(renderNode(focusNode, focusDepth, focusDepth, 0, 1));

        let maxDepth = 0;

        // Render children at respective position and width
        function renderChildren(node: FlamegraphNode, depth: number, startX: number) {
            let currentX = startX;
            maxDepth = Math.max(maxDepth, depth + 1);

            node.children?.forEach((child) => {
                const childWidth = child.numSamples / focusNode.numSamples;
                if (!filter(child)) {
                    nodes.push(renderNode(child, depth + 1, focusDepth, currentX, childWidth));
                    if (childWidth >= 0.008) {
                        // Only process children if parent is large enough to be visible
                        renderChildren(child, depth + 1, currentX);
                    }
                    currentX += childWidth;
                } else {
                    renderChildren(child, depth, currentX);
                }
            });
        }

        renderChildren(focusNode, focusDepth, 0);

        // Add a single invisible placeholder node at the bottom, for some scroll padding
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

    function renderNodeContent(node: FlamegraphNode) {
        const fileName = node.fileName;
        const fileInfo = node.filePath ? (node.lineNumber ? `${fileName}:${node.lineNumber}` : fileName) : '';

        return (
            <div className="node-label">
                <span>
                    {node.codeLine ? (
                        <Highlight code={node.codeLine} language="python" theme={themes.vsDark}>
                            {({ tokens, getTokenProps }) => (
                                <>
                                    {tokens[0].map((token, i) => (
                                        <span key={i} {...getTokenProps({ token })} />
                                    ))}
                                </>
                            )}
                        </Highlight>
                    ) : (
                        node.functionName
                    )}
                </span>
                <span>{fileInfo}</span>
            </div>
        );
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
