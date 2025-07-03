import { Flamenode, FlattenedFlamenode } from '../components/types';

/**
 * Reconstructs a tree structure from flattened nodes array.
 * @param flattenedNodes - Array of flattened nodes with childrenUids instead of children
 * @param rootUid - UID of the root node
 * @returns Reconstructed root node with nested children structure
 */
export function reconstructTreeFromFlattened(
    flattenedNodes: FlattenedFlamenode[],
    rootUid: number,
    focusUid?: number
): { root: Flamenode; focusNode: Flamenode } {
    // Create a map for quick lookup
    const nodeMap = new Map<number, Flamenode>();
    flattenedNodes.forEach((node) => {
        nodeMap.set(node.uid, { ...node, children: [] });
    });

    // Build parent-child relationships
    flattenedNodes.forEach((flatNode) => {
        const node = nodeMap.get(flatNode.uid);
        if (node && flatNode.childrenUids) {
            node.children = flatNode.childrenUids
                .map((childUid: number) => nodeMap.get(childUid))
                .filter(Boolean) as Flamenode[];
        }
    });

    const root = nodeMap.get(rootUid);
    if (!root) {
        throw new Error(`Root node with UID ${rootUid} not found in flattened nodes`);
    }

    const focusNode = focusUid ? nodeMap.get(focusUid) || root : root;
    return { root, focusNode };
}

/**
 * Adds parents to the tree nodes.
 *
 * @param node - The node to add parents to.
 * @param parent - The parent node.
 */
export function addParents(node: Flamenode, parent?: Flamenode) {
    if (parent) node.parent = parent;
    if (node.children) node.children.forEach((child) => addParents(child, node));
}

/**
 * Updates the nodes with source code
 * @param node - The node to update
 * @param sourceCodeArray - The source code array
 */
export function updateNodesWithSourceCode(node: Flamenode, sourceCodeArray?: string[]) {
    if (!sourceCodeArray) return;
    // If the node has a UID that corresponds to an index in the sourceCodeArray
    if (node.uid >= 0 && node.uid < sourceCodeArray.length) {
        node.sourceCode = sourceCodeArray[node.uid];
    }

    // Process children recursively
    if (node.children) {
        node.children.forEach((child) => updateNodesWithSourceCode(child, sourceCodeArray));
    }
}
