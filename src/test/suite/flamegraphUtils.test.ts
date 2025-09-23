import { expect } from 'chai';
import { flattenFlamegraphTree } from '../../utilities/flamegraphUtils';
import { Flamenode } from '../../types';

describe('flamegraphUtils', () => {
    describe('flattenFlamegraphTree', () => {
        it('should flatten a single node with no children', () => {
            const root: Flamenode = {
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 10,
                ownSamples: 10,
                children: [],
            };

            const result = flattenFlamegraphTree(root);

            expect(result).to.have.length(1);
            expect(result[0]).to.deep.equal({
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 10,
                ownSamples: 10,
                childrenUids: [],
            });
        });

        it('should flatten a tree with one level of children', () => {
            const root: Flamenode = {
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 20,
                ownSamples: 5,
                children: [
                    {
                        uid: 2,
                        parentUid: 1,
                        frameId: 101,
                        functionId: 201,
                        depth: 1,
                        samples: 8,
                        ownSamples: 8,
                        children: [],
                    },
                    {
                        uid: 3,
                        parentUid: 1,
                        frameId: 102,
                        functionId: 202,
                        depth: 1,
                        samples: 7,
                        ownSamples: 7,
                        children: [],
                    },
                ],
            };

            const result = flattenFlamegraphTree(root);

            expect(result).to.have.length(3);

            // Check root node
            expect(result[0]).to.deep.equal({
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 20,
                ownSamples: 5,
                childrenUids: [2, 3],
            });

            // Check first child
            expect(result[1]).to.deep.equal({
                uid: 2,
                parentUid: 1,
                frameId: 101,
                functionId: 201,
                depth: 1,
                samples: 8,
                ownSamples: 8,
                childrenUids: [],
            });

            // Check second child
            expect(result[2]).to.deep.equal({
                uid: 3,
                parentUid: 1,
                frameId: 102,
                functionId: 202,
                depth: 1,
                samples: 7,
                ownSamples: 7,
                childrenUids: [],
            });
        });

        it('should flatten a deep nested tree', () => {
            const root: Flamenode = {
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 100,
                ownSamples: 10,
                children: [
                    {
                        uid: 2,
                        parentUid: 1,
                        frameId: 101,
                        functionId: 201,
                        depth: 1,
                        samples: 90,
                        ownSamples: 20,
                        children: [
                            {
                                uid: 3,
                                parentUid: 2,
                                frameId: 102,
                                functionId: 202,
                                depth: 2,
                                samples: 70,
                                ownSamples: 30,
                                children: [
                                    {
                                        uid: 4,
                                        parentUid: 3,
                                        frameId: 103,
                                        functionId: 203,
                                        depth: 3,
                                        samples: 40,
                                        ownSamples: 40,
                                        children: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = flattenFlamegraphTree(root);

            expect(result).to.have.length(4);

            // Check that all nodes are present and relationships are preserved
            expect(result[0].uid).to.equal(1);
            expect(result[0].childrenUids).to.deep.equal([2]);

            expect(result[1].uid).to.equal(2);
            expect(result[1].childrenUids).to.deep.equal([3]);

            expect(result[2].uid).to.equal(3);
            expect(result[2].childrenUids).to.deep.equal([4]);

            expect(result[3].uid).to.equal(4);
            expect(result[3].childrenUids).to.deep.equal([]);
        });

        it('should preserve all optional properties', () => {
            const root: Flamenode = {
                uid: 1,
                parentUid: 0,
                frameId: 100,
                functionId: 200,
                line: 42,
                cell: 1,
                sourceCode: 'def main():',
                depth: 0,
                samples: 10,
                ownSamples: 10,
                enterTime: 100,
                exitTime: 200,
                children: [
                    {
                        uid: 2,
                        parentUid: 1,
                        frameId: 101,
                        functionId: 201,
                        line: 43,
                        cell: 1,
                        sourceCode: '    print("hello")',
                        depth: 1,
                        samples: 5,
                        ownSamples: 5,
                        enterTime: 110,
                        exitTime: 150,
                        children: [],
                    },
                ],
            };

            const result = flattenFlamegraphTree(root);

            expect(result).to.have.length(2);

            // Check that all optional properties are preserved
            expect(result[0]).to.deep.equal({
                uid: 1,
                parentUid: 0,
                frameId: 100,
                functionId: 200,
                line: 42,
                cell: 1,
                sourceCode: 'def main():',
                depth: 0,
                samples: 10,
                ownSamples: 10,
                enterTime: 100,
                exitTime: 200,
                childrenUids: [2],
            });

            expect(result[1]).to.deep.equal({
                uid: 2,
                parentUid: 1,
                frameId: 101,
                functionId: 201,
                line: 43,
                cell: 1,
                sourceCode: '    print("hello")',
                depth: 1,
                samples: 5,
                ownSamples: 5,
                enterTime: 110,
                exitTime: 150,
                childrenUids: [],
            });
        });

        it('should handle complex tree with multiple branches', () => {
            const root: Flamenode = {
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 100,
                ownSamples: 10,
                children: [
                    {
                        uid: 2,
                        parentUid: 1,
                        frameId: 101,
                        functionId: 201,
                        depth: 1,
                        samples: 50,
                        ownSamples: 10,
                        children: [
                            {
                                uid: 4,
                                parentUid: 2,
                                frameId: 103,
                                functionId: 203,
                                depth: 2,
                                samples: 40,
                                ownSamples: 40,
                                children: [],
                            },
                        ],
                    },
                    {
                        uid: 3,
                        parentUid: 1,
                        frameId: 102,
                        functionId: 202,
                        depth: 1,
                        samples: 40,
                        ownSamples: 20,
                        children: [
                            {
                                uid: 5,
                                parentUid: 3,
                                frameId: 104,
                                functionId: 204,
                                depth: 2,
                                samples: 10,
                                ownSamples: 10,
                                children: [],
                            },
                            {
                                uid: 6,
                                parentUid: 3,
                                frameId: 105,
                                functionId: 205,
                                depth: 2,
                                samples: 10,
                                ownSamples: 10,
                                children: [],
                            },
                        ],
                    },
                ],
            };

            const result = flattenFlamegraphTree(root);

            expect(result).to.have.length(6);

            // Verify the tree structure is correctly flattened
            const rootNode = result.find((node) => node.uid === 1);
            expect(rootNode?.childrenUids).to.deep.equal([2, 3]);

            const node2 = result.find((node) => node.uid === 2);
            expect(node2?.childrenUids).to.deep.equal([4]);

            const node3 = result.find((node) => node.uid === 3);
            expect(node3?.childrenUids).to.deep.equal([5, 6]);

            const node4 = result.find((node) => node.uid === 4);
            expect(node4?.childrenUids).to.deep.equal([]);

            const node5 = result.find((node) => node.uid === 5);
            expect(node5?.childrenUids).to.deep.equal([]);

            const node6 = result.find((node) => node.uid === 6);
            expect(node6?.childrenUids).to.deep.equal([]);
        });

        it('should handle undefined children property', () => {
            const root: Flamenode = {
                uid: 1,
                frameId: 100,
                functionId: 200,
                depth: 0,
                samples: 10,
                ownSamples: 10,
                children: undefined as any,
            };

            const result = flattenFlamegraphTree(root);

            expect(result).to.have.length(1);
            expect(result[0].childrenUids).to.deep.equal([]);
        });
    });
});
