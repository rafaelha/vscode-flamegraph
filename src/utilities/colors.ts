import { getModuleName } from './pathUtils';

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
 * Convert a filename to a hue. The hue is computed from the module name which is inferred from the filename.
 * @param file - The file name.
 * @returns The hue for the module.
 */
export function getModuleHue(file?: string): number {
    if (!file) return 240;
    const moduleName = getModuleName(file);
    const hue = (hashString(moduleName ?? '') + 50) % 360;
    return hue;
}

/**
 * Convert a function name to a hue.
 * @param functionName - The function name.
 * @returns The hue for the function.
 */
export function getFunctionHue(functionName: string): number {
    return (hashString(functionName ?? '') + 50) % 360;
}

/**
 * Convert a function name to a hsl color.
 * @param functionName - The function name.
 * @param theme - The color theme.
 * @returns The color for the function.
 */
export function getFunctionColor(functionName: string, theme: ColorTheme = 'dark'): string {
    const hue = getFunctionHue(functionName);
    const lightness = theme === 'dark' ? 40 : 70;
    const saturation = theme === 'dark' ? 50 : 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
