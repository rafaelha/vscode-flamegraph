import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './Flamegraph.css';
import { vscode } from '../utilities/vscode';
import { Legend } from './Legend';
import { Flamenode, Function } from './types';
import { FlameNode } from './FlameNode';
import { filterTreeByModule, getModuleInfo, filterBySearchTerm, getModuleDict } from '../utilities/filter';

export function FlameGraph({
    root,
    functions,
    height = 23,
    profileType,
}: {
    root: Flamenode;
    functions: Function[];
    height?: number;
    profileType: 'py-spy' | 'memray';
}) {
    const [showFiltered, setShowFiltered] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [matchCase, setMatchCase] = useState<boolean>(false);
    const [useRegex, setUseRegex] = useState<boolean>(false);
    const [regexValid, setRegexValid] = useState<boolean>(true);

    // Initialize a map of all modules in the flamegraph to their hues
    const moduleDict = useMemo(() => {
        return getModuleDict(root, functions);
    }, [root, functions]);

    const sourceCodeAvailable = useMemo(() => {
        // traverse all nodes from the root and check if the source code is available
        function traverse(node: Flamenode) {
            if (node.sourceCode) {
                return true;
            }
            for (const child of node.children) {
                if (traverse(child)) {
                    return true;
                }
            }
            return false;
        }
        return traverse(root);
    }, [root]);

    const [hiddenModules, setHiddenModules] = useState<Set<string>>(() => {
        return new Set(['<importlib>', '<runpy>'].filter((m) => moduleDict.has(m)));
    });
    const [showSourceCode, setShowSourceCode] = useState<boolean>(true);

    const filteredRoot = React.useMemo(() => {
        const moduleFiltered = filterTreeByModule(hiddenModules, root, functions);
        if (showFiltered) {
            const filterResult = filterBySearchTerm(moduleFiltered, searchTerm, functions, matchCase, useRegex);
            setRegexValid(filterResult.regexValid);
            return filterResult.filteredNode;
        } else {
            setRegexValid(true);
            return moduleFiltered;
        }
    }, [hiddenModules, root, functions, searchTerm, showFiltered, matchCase, useRegex]);

    const { moduleSamples, moduleOwnSamples, totalSamples } = useMemo(() => {
        return getModuleInfo(filteredRoot, functions);
    }, [filteredRoot, functions]);

    const rootModuleInfo = useMemo(() => {
        return getModuleInfo(root, functions);
    }, [root, functions]);

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
        // Get the UIDs of the node we *want* to keep focus on from the current focusNode state
        const targetUids = focusNode.mergedUids || [focusNode.uid];

        // Helper function to search the tree for a node by its UIDs
        function findNodeByUids(node: Flamenode, uidsToFind: number[]): Flamenode | null {
            const nodeUids = node.mergedUids || [node.uid];
            // Compare sorted UIDs to handle potential order differences
            if (JSON.stringify([...nodeUids].sort()) === JSON.stringify([...uidsToFind].sort())) {
                return node;
            }
            // Recursively search children
            for (const child of node.children) {
                const found = findNodeByUids(child, uidsToFind);
                if (found) {
                    return found;
                }
            }
            // Not found in this subtree
            return null;
        }

        // Try to find the node corresponding to the previous focus in the *new* filtered tree
        const preservedNode = findNodeByUids(filteredRoot, targetUids);

        // If we found the node in the new tree, focus it. Otherwise, focus the new root.
        // Check if the focus needs to change to avoid unnecessary updates if the node is the same.
        if (preservedNode && preservedNode !== focusNode) {
            handleFocusNodeChange(preservedNode);
        } else if (!preservedNode && filteredRoot !== focusNode) {
            // If the preserved node wasn't found, and the current focus isn't already the filtered root
            handleFocusNodeChange(filteredRoot);
        }
        // If preservedNode is found and is the same as focusNode, or
        // if preservedNode is not found and focusNode is already filteredRoot, do nothing.
    }, [filteredRoot, handleFocusNodeChange, focusNode]); // Add focusNode dependency to access its UIDs

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
            if (node.uid === 0) {
                vscode.postMessage({
                    command: 'open-file',
                    file: 'root',
                    line: 0,
                });
            } else {
                const functionData = functions[node.functionId];
                if (!functionData?.filePath) return;
                vscode.postMessage({
                    command: 'open-file',
                    file: functionData.filePath,
                    line: node.line || 1,
                });
            }
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
                showSourceCode={showSourceCode}
                profileType={profileType}
            />
        );
    }

    function renderNodes(): React.ReactNode[] {
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
                if (childWidth >= 0.002) {
                    getModuleCount(child);
                    nodes.push(createFlameNode(child, depth + 1, currentX, childWidth));
                    if (childWidth >= 0.008) {
                        renderChildren(child, depth + 1, currentX);
                    }
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
            return {
                name,
                hue: moduleDict.get(name)?.hue || 0,
                totalValue: rootModuleInfo.moduleSamples.get(name) || 0,
                visibleValue: moduleCount.get(name)?.totalValue || 0,
            };
        })
        .filter((item) => hiddenModules.has(item.name) || item.visibleValue > 0) // Only show items that are either hidden or have value
        .sort((a, b) => {
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
                moduleSamples={moduleSamples}
                moduleOwnSamples={moduleOwnSamples}
                totalSamples={totalSamples}
                showSourceCode={showSourceCode}
                showFiltered={showFiltered}
                matchCase={matchCase}
                useRegex={useRegex}
                regexValid={regexValid}
                onToggleSourceCode={() => setShowSourceCode(!showSourceCode)}
                onToggleFiltered={() => setShowFiltered(!showFiltered)}
                onToggleMatchCase={() => setMatchCase(!matchCase)}
                onToggleUseRegex={() => setUseRegex(!useRegex)}
                sourceCodeAvailable={sourceCodeAvailable}
                profileType={profileType}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
            />
        </div>
    );
}
