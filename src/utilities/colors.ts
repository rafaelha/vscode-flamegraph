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

export function getNodeColor(file?: string, line?: number, functionName?: string, theme: ColorTheme = 'dark'): string {
    if (!line) return theme === 'dark' ? '#008b8b' : '#006666';
    if (!file || !functionName) return theme === 'dark' ? '#808080' : '#a0a0a0';

    const moduleName = getModuleName(file);
    const hue = (hashString(moduleName ?? '') + 50) % 360;
    const saturation =
        theme === 'dark'
            ? 50 + (hashString(functionName) % 50) // Higher saturation for dark mode
            : 10 + (hashString(functionName) % 40); // Lower saturation for light mode
    const lightness =
        theme === 'dark'
            ? 45 + (line % 10) // Darker colors for dark mode
            : 65 + (line % 10); // Lighter colors for light mode
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function getFunctionColor(functionName: string, theme: ColorTheme = 'dark'): string {
    const hue = (hashString(functionName ?? '') + 50) % 360;
    const lightness = theme === 'dark' ? 40 : 70;
    const saturation = theme === 'dark' ? 50 : 40;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
