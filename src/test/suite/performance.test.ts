import * as fs from 'fs';
import * as path from 'path';
import { Flamegraph } from '../../flamegraph';

describe('Flamegraph Performance', () => {
    let profileContent: string;

    beforeAll(() => {
        // Load the test profile file
        const testFilePath = path.join(__dirname, '../fixtures/large-profile.txt');
        profileContent = fs.readFileSync(testFilePath, 'utf8');
    });

    test('should parse flamegraph data efficiently', () => {
        const startTime = performance.now();
        // eslint-disable-next-line no-unused-vars
        const flamegraph = new Flamegraph(profileContent);
        const parseTime = performance.now() - startTime;

        expect(parseTime).toBeLessThan(500); // at most 0.5s for parsing the 35MB profile
    });

    test('should generate file profiles efficiently', () => {
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
        expect(averageTime).toBeLessThan(5); // Average time should be under 5ms
        expect(maxTime).toBeLessThan(10); // Max time should be under 10ms
    });
});
