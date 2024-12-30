export type ColorTheme = 'light' | 'dark';

/**
 * Hash a string to a number.
 * @param str - The string to hash.
 * @returns The hash of the string.
 */
export function hashString(str: string): number {
    let hash = 0x9e3779b9; // Initial seed value for the hash function
    for (let i = 0; i < str.length; i += 1) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) ^ char;
    }
    return Math.abs(hash); // Ensure the result is non-negative
}

/**
 * Convert a string to a hue.
 * @param str - The string to convert.
 * @returns The hue for the string.
 */
export function strToHue(str: string): number {
    return (hashString(str) + 50) % 360;
}

/**
 * Convert a function name to a hsl color.
 * @param functionName - The function name.
 * @param theme - The color theme.
 * @returns The color for the function.
 */
export function getFunctionColor(functionName: string, theme: ColorTheme = 'dark'): string {
    const hue = strToHue(functionName);
    const lightness = theme === 'dark' ? 40 : 70;
    const saturation = theme === 'dark' ? 50 : 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
