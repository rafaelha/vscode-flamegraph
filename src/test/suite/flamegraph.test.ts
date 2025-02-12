import { Flamegraph } from '../../flamegraph';

describe('Flamegraph', () => {
    test('should create a flamegraph with root node', () => {
        // Create a simple profile string with one sample
        const profileData = 'main.py (main.py:1) 1';

        // Create flamegraph instance
        const flamegraph = new Flamegraph(profileData);

        // Basic assertions
        expect(flamegraph.root).toBeDefined();
        expect(flamegraph.root.samples).toBe(1);
        expect(flamegraph.root.depth).toBe(0);
        expect(flamegraph.root.children.length).toBe(1);
    });
});
