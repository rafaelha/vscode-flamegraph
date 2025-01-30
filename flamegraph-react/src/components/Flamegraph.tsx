import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './Flamegraph.css';
import { vscode } from '../utilities/vscode';
import { Legend } from './Legend';
import { Flamenode, Function } from './types';
import { FlameNode } from './FlameNode';
import { filterTreeByModule } from '../utilities/filter';

export function FlameGraph({
    root,
    functions,
    height = 23,
}: {
    root: Flamenode;
    functions: Function[];
    height?: number;
}) {
    // Initialize a map of all modules in the flamegraph to their hues
    const moduleDict = useMemo(() => {
        const modules = new Map<string, { hue: number }>();
        function collectModules(node: Flamenode) {
            const functionData = functions[node.functionId];
            const module = functionData?.module;
            if (module && !modules.has(module)) {
                modules.set(module, { hue: functionData.moduleHue });
            }
            node.children.forEach(collectModules);
        }
        collectModules(root);
        return modules;
    }, [root, functions]);

    const [hiddenModules, setHiddenModules] = useState<Set<string>>(() => new Set(['<importlib>']));

    const filteredRoot = React.useMemo(
        () => filterTreeByModule(hiddenModules, root, functions),
        [hiddenModules, root, functions]
    );

    const [focusNode, setFocusNode] = useState<Flamenode>(filteredRoot);
    const [hoveredLineId, setHoveredLineId] = useState<number | null>(null);
    const [hoveredFunctionId, setHoveredFunctionId] = useState<number | null>(null);
    const [isCommandPressed, setIsCommandPressed] = useState(false);
    const rootValue = filteredRoot.samples;

    // Helper function to handle focus node changes
    const handleFocusNodeChange = useCallback(
        (node: Flamenode) => {
            setFocusNode(node);
            vscode.postMessage({
                command: 'set-focus-node',
                uids: node.mergedUids || [node.uid],
                focusFunctionId: functions[node.functionId]?.functionName,
            });
        },
        [functions]
    );

    React.useEffect(() => {
        handleFocusNodeChange(filteredRoot);
    }, [filteredRoot, handleFocusNodeChange]);

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
            handleFocusNodeChange(node);
        }
    }

    const moduleCount = new Map<string, { hue: number; totalValue: number }>();

    function getModuleCount(node: Flamenode) {
        const functionData = functions[node.functionId];
        const module = functionData?.module;
        if (!module) return false;
        const existing = moduleCount.get(module);
        moduleCount.set(module, {
            hue: existing?.hue || functionData.moduleHue,
            totalValue: (existing?.totalValue || 0) + node.samples,
        });
    }

    // Calculate focusDepth once
    let focusDepth = 0;
    let current = focusNode;
    getModuleCount(current);
    while (current.parent) {
        getModuleCount(current.parent);
        focusDepth += 1;
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
        console.log('render nodes');
        const nodes: React.ReactNode[] = [];

        // Render parents (full width)
        current = focusNode;
        let depth = focusDepth;
        while (current.parent) {
            getModuleCount(current.parent);
            depth -= 1;
            nodes.push(createFlameNode(current.parent, depth, 0, 1));
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
                const aFile = functions[a.functionId]?.shortFilename ?? functions[a.functionId]?.fileName ?? '';
                const bFile = functions[b.functionId]?.shortFilename ?? functions[b.functionId]?.fileName ?? '';
                const aLine = a.line ?? 0;
                const bLine = b.line ?? 0;
                return aFile.localeCompare(bFile) || aLine - bLine;
            });

            node.children?.forEach((child) => {
                const childWidth = child.samples / focusNode.samples;
                getModuleCount(child);
                nodes.push(createFlameNode(child, depth + 1, currentX, childWidth));
                if (childWidth >= 0.008) {
                    renderChildren(child, depth + 1, currentX);
                }
                currentX += childWidth;
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

    // Compute legend items with proper ordering
    const legendItems = Array.from(moduleDict.entries())
        .map(([name]) => {
            const moduleData = moduleCount.get(name) || { hue: moduleDict.get(name)!.hue, totalValue: 0 };
            return { name, hue: moduleData.hue, totalValue: moduleData.totalValue };
        })
        .filter((item) => hiddenModules.has(item.name) || item.totalValue > 0) // Only show items that are either hidden or have value
        .sort((a, b) => {
            // First sort by hidden status
            const aHidden = hiddenModules.has(a.name);
            const bHidden = hiddenModules.has(b.name);
            if (aHidden !== bHidden) return aHidden ? -1 : 1;
            // Then sort by total value
            return b.totalValue - a.totalValue;
        });

    return (
        <div className="flamegraph relative">
            {renderedNodes}
            <Legend
                items={legendItems}
                hiddenModules={hiddenModules}
                onModuleVisibilityChange={(moduleName, isVisible) => {
                    setHiddenModules((prev) => {
                        const next = new Set(prev);
                        if (isVisible) {
                            next.delete(moduleName);
                        } else {
                            next.add(moduleName);
                        }
                        return next;
                    });
                }}
            />
        </div>
    );
}
