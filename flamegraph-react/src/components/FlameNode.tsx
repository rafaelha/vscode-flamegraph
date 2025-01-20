import React from 'react';
import { FlameNodeContent } from './FlameNodeContent';
import { Flamenode, Function } from './types';
import './FlameNode.css';

interface FlameNodeProps {
    node: Flamenode;
    functions: Function[];
    depth: number;
    focusDepth: number;
    x: number;
    width: number;
    height: number;
    rootValue: number;
    focusNodeValue: number;
    isCommandPressed: boolean;
    hoveredLineId: number | null;
    hoveredFunctionId: number | null;
    onNodeClick: (node: Flamenode, e: React.MouseEvent) => void;
    onNodeHover: (frameId: number | null, functionId: number | null) => void;
}

export function FlameNode({
    node,
    functions,
    depth,
    focusDepth,
    x,
    width,
    height,
    rootValue,
    focusNodeValue,
    isCommandPressed,
    hoveredLineId,
    hoveredFunctionId,
    onNodeClick,
    onNodeHover,
}: FlameNodeProps) {
    const { frameId, functionId, samples, line, sourceCode } = node;
    const functionData = functions[functionId];

    if (!functionData) return null;

    const { module, moduleHue, functionHue, fileName, functionName, shortFunctionName } = functionData;

    const isHovered = hoveredLineId === frameId && !fileName?.startsWith('<') && fileName !== '';
    const isRelatedFunction = hoveredFunctionId === functionId && !fileName?.startsWith('<') && fileName !== '';

    const style = {
        left: `${x * 100}%`,
        width: `calc(${width * 100}% - 2px)`,
        top: `${depth * height}px`,
        height: `${height - 2}px`,
        '--node-hue': isCommandPressed && isRelatedFunction ? functionHue : moduleHue,
        position: 'absolute' as const,
        opacity: depth < focusDepth ? 0.35 : 1,
    };

    const handleClick = (e: React.MouseEvent) => onNodeClick(node, e);

    const className = `graph-node ${isHovered && isCommandPressed ? 'same-line-id command-pressed' : ''}`;

    const percentageOfTotal = ((samples / rootValue) * 100).toFixed(1);
    const percentageOfFocus = ((samples / focusNodeValue) * 100).toFixed(1);
    const tooltipContent = [
        fileName ? `${functionName} (${line ? `${fileName}:${line}` : fileName})` : functionName,
        sourceCode,
        module,
        `${samples / 100}s / ${percentageOfTotal}% / ${percentageOfFocus}%`,
    ]
        .filter(Boolean)
        .join('\n');

    return (
        <div
            className={className}
            style={style}
            onClick={handleClick}
            onMouseEnter={() => onNodeHover(frameId, functionId)}
            onMouseLeave={() => onNodeHover(null, null)}
            title={tooltipContent}
        >
            <FlameNodeContent
                sourceCode={sourceCode}
                functionName={shortFunctionName || functionName}
                fileName={fileName}
                line={line}
            />
        </div>
    );
}
