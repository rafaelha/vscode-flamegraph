const SAMPLES_PER_SECOND = 100;
/**
 * Converts a number of samples to a unit string.
 * @param samples - The number of samples.
 * @param profileType - The type of profile.
 * @returns The unit string.
 */
export function toUnitString(samples: number, profileType: 'py-spy' | 'memray'): string {
    if (profileType === 'memray') {
        // convert bits to B, MB, GB, TB
        const units = ['B', 'kB', 'MB', 'GB', 'TB'];
        let index = 0;
        let value = samples;
        while (value >= 1024 && index < units.length - 1) {
            value /= 1024;
            index += 1;
        }
        return `${value % 1 === 0 ? Math.floor(value) : value.toFixed(1)}${units[index]}`;
    }
    return `${samples / SAMPLES_PER_SECOND}s`;
}
