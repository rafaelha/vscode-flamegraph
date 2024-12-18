import { getModuleName } from './pathUtils';

export type ColorTheme = 'light' | 'dark';

export function hashString(str: string): number {
    let hash = 0x9e3779b9; // Initial seed value for the hash function
    for (let i = 0; i < str.length; i += 1) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) ^ char;
    }
    return Math.abs(hash); // Ensure the result is non-negative
}

export function getNodeHue(file?: string, line?: number, functionName?: string): number {
    if (!line) return 180;
    if (!file || !functionName) return 240;

    const moduleName = getModuleName(file);
    const hue = (hashString(moduleName ?? '') + 50) % 360;
    return hue;
}

export function getFunctionHue(functionName: string): number {
    return (hashString(functionName ?? '') + 50) % 360;
}

export function getFunctionColor(functionName: string, theme: ColorTheme = 'dark'): string {
    const hue = getFunctionHue(functionName);
    const lightness = theme === 'dark' ? 40 : 70;
    const saturation = theme === 'dark' ? 50 : 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
