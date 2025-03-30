import { isAbsolute, normalize } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { URI } from './uri';

/**
 * Normalizes a file path to use forward slashes and lower case.
 * This is important for comparing file paths on different platforms.
 *
 * @param filePath - The file path to normalize.
 * @returns The normalized file path.
 */
export function toUnixPath(filePath: string) {
    // First decode any existing URI-encoded spaces to ensure consistent starting point
    const decodedPath = decodeURIComponent(filePath);
    // convert backslashes to forward slashes, and decode spaces
    return decodedPath.replace(/\\/g, '/');
}

/**
 * Escapes spaces in a string for Windows by replacing them with '` ' (backtick space).
 *
 * @param input - The input string to escape.
 * @returns The escaped string.
 */
export function escapeSpaces(input: string): string {
    if (os.platform() !== 'win32') return input;
    return input.replace(/"([^"]*)"/g, (match) => {
        return match.replace(/ /g, '` ');
    });
}

const filenameCache = new Map<string, string>();

/**
 * Shortens a filename to the nearest parent directory without `__init__.py`.
 *
 * @param filename - The filename to shorten.
 * @returns The shortened filename.
 */
function shortenFilename(filename: string): string {
    // If full filenames are requested, return the original filename.
    // Check if the shortened version is already cached.
    if (filenameCache.has(filename)) {
        const shortName = filenameCache.get(filename);
        if (shortName) return shortName;
    }

    // Traverse upwards until a directory without `__init__.py` is found.
    let currentPath = path.dirname(filename);

    while (fs.existsSync(path.join(currentPath, '__init__.py'))) {
        // set current path to the parent directory
        currentPath = path.dirname(currentPath);
    }
    // Strip the parent path and convert to a relative string.
    const shortened = path.relative(currentPath, filename);

    // Cache the result and return.
    filenameCache.set(filename, shortened);
    return shortened;
}

/**
 * Gets the module name from a file path. The module name is the highest directory whose parent directory does not
 * contain `__init__.py`.
 *
 * @param filePath - The file path to get the module name from.
 * @returns The module name.
 */
export function getModuleName(filePath: string | undefined): string | undefined {
    // check if the file path is absolute
    if (!filePath) return undefined;
    if (filePath.includes('frozen importlib')) return '<importlib>';

    let fileName = URI.parse(filePath).fsPath;
    if (isAbsolute(fileName)) {
        fileName = shortenFilename(fileName);
    }

    const moduleName = fileName.replace(/\//g, '\\').split('\\')[0] || '<>';

    return moduleName && moduleName.startsWith('<') ? undefined : moduleName;
}

/**
 * Splits a string by a delimiter, handling escaped quotes.
 *
 * @param input - The input string to split.
 * @param delimiter - The delimiter to split by.
 * @returns An array of strings.
 */
export function splitOutsideQuotes(input: string, delimiter: string = ';'): string[] {
    // Pre-allocate result array with estimated capacity
    const result: string[] = [];
    const { length } = input;

    // Early return for empty input
    if (length === 0) return result;

    let startIndex = 0;
    let insideQuotes = false;

    for (let i = 0; i < length; i += 1) {
        const char = input.charAt(i);

        // Toggle quote state (handling escaped quotes)
        if (char === '"' && (i === 0 || input.charAt(i - 1) !== '\\')) {
            insideQuotes = !insideQuotes;
        }

        // Split only if delimiter is outside quotes
        if (char === delimiter && !insideQuotes) {
            result.push(input.substring(startIndex, i));
            startIndex = i + 1;
        }
    }

    // Add the final segment
    result.push(input.substring(startIndex));

    return result;
}
