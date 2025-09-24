import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { Flamegraph } from '../../flamegraph';

describe('Flamegraph Performance', () => {
    let profileContent: string;

    // Define the test fixtures directory as a constant, resolved from the current file
    const FIXTURES_DIR = path.resolve(__dirname, '../../../src/test/fixtures');

    before(() => {
        // Load the test profile file from the fixtures directory
        const testFilePath = path.join(FIXTURES_DIR, 'large-profile.txt');
        profileContent = fs.readFileSync(testFilePath, 'utf8');
    });

    it('should parse flamegraph data efficiently', () => {
        const startTime = performance.now();
        // eslint-disable-next-line no-unused-vars
        const flamegraph = new Flamegraph(profileContent);
        const parseTime = performance.now() - startTime;

        expect(parseTime).to.be.lessThan(500); // at most 0.5s for parsing the 35MB profile
    });

    it('should generate file profiles efficiently', () => {
        const flamegraph = new Flamegraph(profileContent);
        const durations: number[] = [];

        // Measure time for each file profile generation
        flamegraph.functions.forEach((func) => {
            if (!func.fileName) return;

            const startTime = performance.now();
            flamegraph.getFileProfile(func.fileName);
            const endTime = performance.now();

            durations.push(endTime - startTime);
        });

        // Calculate statistics
        const averageTime = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxTime = Math.max(...durations);

        // Assert performance expectations
        expect(averageTime).to.be.lessThan(5); // Average time should be under 5ms
        expect(maxTime).to.be.lessThan(10); // Max time should be under 10ms
    });
});
