import React, { useState, useEffect } from 'react';
import './flame-graph.css';
import { vscode } from '../utilities/vscode';
import { Legend } from './Legend';
import { FlamegraphNode } from './types';
import { getFunctionHue } from '../utilities/colors';

// Function to generate a seeded random number between -range and +range
function seededRandom(seed: string, range: number): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash = hash & hash;
    }
    // Convert hash to a number between -range and +range
    return ((hash % (range * 200)) - range * 100) / 100;
}

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

    const moduleMap = new Map<string, { color: string; totalValue: number }>();

    function renderNode(node: FlamegraphNode, x: number, width: number) {
        // Update module map for legend
        if (node.moduleName) {
            const existing = moduleMap.get(node.moduleName);
            moduleMap.set(node.moduleName, {
                color: existing?.color || node.color,
                totalValue: (existing?.totalValue || 0) + node.numSamples,
            });
        }

        const isHovered = hoveredLineId === node.fileLineId;
        const isRelatedFunction = hoveredFunctionId === node.functionId;

        // Generate consistent random variations based on node properties
        const saturationOffset = seededRandom(node.functionName + node.uid, 5); // ±5%
        const lightnessOffset = seededRandom(node.functionName + node.uid + 'l', 5); // ±5%

        const style = {
            left: `${x * 100}%`,
            width: `calc(${width * 100}% - 2px)`,
            top: `${node.depth * height}px`,
            height: `${height - 2}px`,
            '--node-hue':
                isCommandPressed && isRelatedFunction ? getFunctionHue(node.functionName) : node.color.match(/\d+/)![0],
            '--node-saturation-offset': `${saturationOffset}%`,
            '--node-lightness-offset': `${lightnessOffset}%`,
            position: 'absolute' as const,
            opacity: node.depth < focusNode.depth ? 0.35 : 1,
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
            `${node.functionName}`,
            node.filePath && node.lineNumber
                ? `${node.filePath}:${node.lineNumber}`
                : node.filePath
                  ? node.filePath
                  : null,
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

        // Render parents (full width)
        let current = focusNode;
        while (current.parent) {
            nodes.push(renderNode(current.parent, 0, 1));
            current = current.parent;
        }

        // Render focus node (full width)
        nodes.push(renderNode(focusNode, 0, 1));

        let maxDepth = 0;

        // Render children at respective position and width
        function renderChildren(node: FlamegraphNode, startX: number) {
            let currentX = startX;
            maxDepth = Math.max(maxDepth, node.depth);

            node.children?.forEach((child) => {
                const childWidth = child.numSamples / focusNode.numSamples;
                nodes.push(renderNode(child, currentX, childWidth));
                if (childWidth >= 0.008) {
                    // Only process children if parent is large enough to be visible
                    renderChildren(child, currentX);
                }
                currentX += childWidth;
            });
        }

        renderChildren(focusNode, 0);

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
        const fileInfo = node.lineNumber ? `${fileName}:${node.lineNumber}` : fileName;

        return (
            <div className="node-label">
                <span>{node.functionName}</span>
                {node.filePath && node.lineNumber && <span>{fileInfo}</span>}
            </div>
        );
    }

    const renderedNodes = renderNodes();

    const legendItems = Array.from(moduleMap.entries())
        .map(([name, { color, totalValue }]) => ({ name, color, totalValue }))
        .sort((a, b) => b.totalValue - a.totalValue);

    return (
        <div className="flamegraph relative">
            {renderedNodes}
            <Legend items={legendItems} />
        </div>
    );
}
