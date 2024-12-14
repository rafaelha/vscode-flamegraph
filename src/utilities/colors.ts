import { getModuleName } from './pathUtils';

export function hashString(str: string): number {
    let hash = 0x9e3779b9; // Initial seed value for the hash function
    for (let i = 0; i < str.length; i += 1) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) ^ char;
    }
    return Math.abs(hash); // Ensure the result is non-negative
}

export function getNodeColor(file?: string, line?: number, functionName?: string): string {
    if (!line) return '#008b8b';
    if (!file || !functionName) return '#808080';

    const moduleName = getModuleName(file);

    const hue = (hashString(moduleName ?? '') + 50) % 360;
    const saturation = 50 + (hashString(functionName) % 50);
    const lightness = 25 + (line % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function getFunctionColor(functionName: string): string {
    const hue = (hashString(functionName ?? '') + 50) % 360;
    return `hsl(${hue}, 50%, 40%)`;
}
