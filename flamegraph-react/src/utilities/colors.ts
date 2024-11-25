export function hashString(str: string): number {
    let hash = 0x9e3779b9; // Initial seed value for the hash function
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) + hash) ^ char;
    }
    return Math.abs(hash); // Ensure the result is non-negative
}

export function getFunctionColor(functionName: string): string {
    const hue = (hashString(functionName ?? '') + 50) % 360;
    return `hsl(${hue}, 50%, 40%)`;
}
