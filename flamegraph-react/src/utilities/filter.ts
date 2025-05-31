import { Flamenode, Function } from '../components/types';

/**
 * Filters the tree by module. Nodes of hidden modules will be removed and their children are appended to their parents.
 * If after filtering, a node has children with the same functionId and line, they are merged.
 * @param hiddenModules - The set of modules to hide.
 * @param root - The root node of the tree.
 * @param functions - The function list referenced by nodes in the tree.
 * @returns The root node of the filtered tree.
 */
export function filterTreeByModule(hiddenModules: Set<string>, root: Flamenode, functions: Function[]): Flamenode {
    // Check whether the provided node is a valid node, i.e. if its module is not in the set of hidden modules.
    // If it not valid, perform a DFS traversal to find return a list of the first valid child node along each branch.
    function getValidNode(child: Flamenode): Flamenode[] {
        const module = functions[child.functionId]?.module;
        const children: Flamenode[] = [];
        if (!module || !hiddenModules.has(module)) {
            children.push({ ...child, mergedUids: [child.uid] });
        } else {
            for (const child2 of child.children) {
                children.push(...getValidNode(child2));
            }
        }
        return children;
    }

    // Perform a DFS traversal to filter the whole tree
    function filter(node: Flamenode) {
        const children = node.children;
        node.children = [];
        for (const child of children) {
            for (const filteredChild of getValidNode(child)) {
                node.children.push({ ...filteredChild, parent: node, mergedUids: [filteredChild.uid] });
            }
        }

        for (const child of node.children) {
            filter(child);
        }
    }

    const rootCopy: Flamenode = { ...root };

    filter(rootCopy);

    // DFS traversal to merge nodes with same functionId and line
    function merge(node: Flamenode) {
        // Sort children by functionId and line
        node.children.sort((a, b) => {
            const aKey = `${a.functionId}-${a.line}`;
            const bKey = `${b.functionId}-${b.line}`;
            return aKey.localeCompare(bKey);
        });

        // Merge nodes with the same functionId and line
        const mergedChildren: Flamenode[] = [];
        for (const child of node.children) {
            const lastMerged = mergedChildren[mergedChildren.length - 1];

            if (lastMerged && lastMerged.functionId === child.functionId && lastMerged.line === child.line) {
                // Merge samples
                lastMerged.samples += child.samples;
                lastMerged.mergedUids ??= [lastMerged.uid];
                lastMerged.mergedUids.push(child.uid);
                lastMerged.children.push(...child.children);
            } else {
                // Add new child to mergedChildren
                mergedChildren.push(child);
            }
        }
        node.children = mergedChildren;

        // Recursively merge children
        for (const child of node.children) {
            merge(child);
        }
    }

    // perform DFS merging traversal
    merge(rootCopy);

    return rootCopy;
}

/**
 * Checks if the string matches the search term.
 * @param str - The string to check.
 * @param searchTerm - The search term to check.
 * @param caseSensitive - Whether the search term should be case sensitive.
 * @param regex - Whether the search term should be a regular expression.
 * @returns True if the string matches the search term, false otherwise.
 */
function isMatch(str: string, searchTerm: string, caseSensitive: boolean, regex: boolean) {
    if (regex) {
        try {
            return new RegExp(searchTerm, caseSensitive ? 'g' : 'gi').test(str);
        } catch (e) {}
    }
    return caseSensitive ? str.includes(searchTerm) : str.toLowerCase().includes(searchTerm.toLowerCase());
}

/**
 * Filters the tree by search term. Nodes that do not include the search term will be removed and their children are appended to their parents.
 * @param node - The root node of the tree.
 * @param searchTerm - The search term to filter by.
 * @param functions - The function list referenced by nodes in the tree.
 * @param caseSensitive - Whether the search term should be case sensitive.
 * @param regex - Whether the search term should be a regular expression.
 * @returns The root node of the filtered tree.
 */
export function filterBySearchTerm(
    node: Flamenode,
    searchTerm: string,
    functions: Function[],
    caseSensitive: boolean,
    regex: boolean
) {
    if (searchTerm === '') {
        return node;
    }

    function includesSearchTerm(node: Flamenode, searchTerm: string, functions: Function[]) {
        const functionData = functions[node.functionId];
        const str = functionData?.functionName + functionData?.module + functionData?.filePath;

        if (isMatch(str, searchTerm, caseSensitive, regex)) {
            return true;
        }

        const results = [];
        for (const child of node.children) {
            results.push(includesSearchTerm(child, searchTerm, functions));
        }
        const anyIncludesSearchTerm = node.children.some((child) => includesSearchTerm(child, searchTerm, functions));
        if (anyIncludesSearchTerm) {
            // loop through all pairs of results and children (zip)
            const newChildren = [];
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const child = node.children[i];
                if (result) {
                    newChildren.push(child);
                }
            }
            node.children = newChildren;
        }
        node.samples = node.children.reduce((acc, child) => acc + child.samples, 0);
        node.ownSamples = node.children.reduce((acc, child) => acc + child.ownSamples, 0);
        return anyIncludesSearchTerm;
    }

    console.log('searchTerm', searchTerm);
    const rootCopy: Flamenode = { ...node };
    const result = includesSearchTerm(rootCopy, searchTerm, functions);
    if (!result) {
        // return the root node without any children
        return { ...node, children: [] };
    }
    return rootCopy;
}

export function getModuleInfo(
    node: Flamenode,
    functions: Function[],
    currentPath: string[] = [],
    moduleSamples: Map<string, number> = new Map(),
    moduleOwnSamples: Map<string, number> = new Map()
): { moduleSamples: Map<string, number>; moduleOwnSamples: Map<string, number>; totalSamples: number } {
    // Get the module of current node
    const currentModule = functions[node.functionId]?.module;

    // If module exists and hasn't been visited in current path, we can count it towards the module samples
    if (currentModule) {
        if (!currentPath.includes(currentModule)) {
            moduleSamples.set(currentModule, (moduleSamples.get(currentModule) || 0) + node.samples);
        }
        // Add to current path to track that we have already counted
        currentPath.push(currentModule);
    }

    const childrenSamples = node.children.reduce((acc, child) => acc + child.samples, 0);
    const ownSamples = node.samples - childrenSamples;
    if (currentModule) {
        moduleOwnSamples.set(currentModule, (moduleOwnSamples.get(currentModule) || 0) + ownSamples);
    }

    // Recursively process children and accumulate their total samples
    let childTotalSamples = 0;
    for (const child of node.children) {
        const childResult = getModuleInfo(child, functions, currentPath, moduleSamples, moduleOwnSamples);
        childTotalSamples += childResult.totalSamples;
    }

    // Remove from path if it was added (when backtracking)
    if (currentModule) {
        currentPath.pop();
    }

    return { moduleSamples, moduleOwnSamples, totalSamples: ownSamples + childTotalSamples };
}
