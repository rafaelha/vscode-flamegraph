const modernColorPalette: string[] = [
    '#FF6F61', // Coral
    '#6B5B95', // Purple
    '#88B04B', // Green
    '#F7CAC9', // Pink
    '#92A8D1', // Light Blue
    '#955251', // Mauve
    '#B565A7', // Orchid
    '#009B77', // Teal
    '#DD4124', // Red
    '#D65076', // Raspberry
    '#45B8AC', // Turquoise
    '#EFC050', // Yellow
    '#5B5EA6', // Indigo
    '#9B2335', // Maroon
    '#DFCFBE', // Beige
    '#55B4B0', // Aqua
    '#E15D44', // Tomato
    '#7FCDCD', // Mint
    '#BC243C', // Crimson
    '#C3447A', // Fuchsia
];

// Function to get a color by index
export function getColorByIndex(index: number): string {
    return modernColorPalette[index % modernColorPalette.length];
}
