import { getModuleName } from "./getUri";

const modernColorPalette: string[] = [
    '#FF6F61', // Coral
    '#6B5B95', // Purple
    '#88B04B', // Green
    '#92A8D1', // Light Blue
    '#955251', // Mauve
    '#B565A7', // Orchid
    '#009B77', // Teal
    '#DD4124', // Red
    '#D65076', // Raspberry
    '#45B8AC', // Turquoise
    '#5B5EA6', // Indigo
    '#9B2335', // Maroon
    '#55B4B0', // Aqua
    '#E15D44', // Tomato
    '#BC243C', // Crimson
    '#C3447A', // Fuchsia
];

// Function to get a color by index
export function getColorByIndex(index: number): string {
    return modernColorPalette[index % modernColorPalette.length];
}

export function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export function getNodeColor(file?: string, line?: number, functionName?: string): string {
    if (!file || !line || !functionName) return '#808080';

    const moduleName = getModuleName(file);

    const hue = (hashString(moduleName ?? '') + 50) % 360;
    const saturation = 50 + (hashString(functionName) % 50);
    const lightness = 25 + (line % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}