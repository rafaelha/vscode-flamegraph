const modernColorPalette: string[] = [
  "#FF6F61", // Coral
  "#6B5B95", // Purple
  "#88B04B", // Green
  "#92A8D1", // Light Blue
  "#955251", // Mauve
  "#B565A7", // Orchid
  "#009B77", // Teal
  "#DD4124", // Red
  "#D65076", // Raspberry
  "#45B8AC", // Turquoise
  "#5B5EA6", // Indigo
  "#9B2335", // Maroon
  "#55B4B0", // Aqua
  "#E15D44", // Tomato
  "#BC243C", // Crimson
  "#C3447A", // Fuchsia
];

// Function to get a color by index
export function getColorByIndex(index: number): string {
  return modernColorPalette[index % modernColorPalette.length];
}
