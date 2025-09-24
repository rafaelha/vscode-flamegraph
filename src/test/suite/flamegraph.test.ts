import { expect } from 'chai';
import { Flamegraph } from '../../flamegraph';

describe('Flamegraph', () => {
    it('should create a flamegraph with root node', () => {
        // Create a simple profile string with one sample
        const profileData = 'main.py (main.py:1) 1';

        // Create flamegraph instance
        const flamegraph = new Flamegraph(profileData);

        // Basic assertions
        expect(flamegraph.root).to.exist;
        expect(flamegraph.root.samples).to.equal(1);
        expect(flamegraph.root.depth).to.equal(0);
        expect(flamegraph.root.children.length).to.equal(1);
    });
});
