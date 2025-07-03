import { Flamenode, FlattenedFlamenode } from '../types';

/**
 * Flattens a flamegraph tree structure into an array to avoid JSON serialization
 * issues with very deep nested objects. Each node stores parent UID instead of
 * being nested in children arrays.
 *
 * @param root - The root node of the flamegraph to flatten.
 * @returns An array of flattened nodes.
 */
export function flattenFlamegraphTree(root: Flamenode): FlattenedFlamenode[] {
    const flattened: FlattenedFlamenode[] = [];

    function traverse(node: Flamenode) {
        const { children, ...nodeWithoutChildren } = node;
        const flatNode = {
            ...nodeWithoutChildren,
            childrenUids: children?.map((child: Flamenode) => child.uid) || [],
        };
        flattened.push(flatNode);

        // Traverse children
        if (node.children) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }

    traverse(root);
    return flattened;
}
