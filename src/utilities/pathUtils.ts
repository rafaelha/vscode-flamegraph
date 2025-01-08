import { isAbsolute, normalize } from 'path';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Normalizes a file path to use forward slashes and lower case.
 * This is important for comparing file paths on different platforms.
 *
 * @param filePath - The file path to normalize.
 * @returns The normalized file path.
 */
export function toUnixPath(filePath: string) {
    return normalize(filePath).replace(/\\/g, '/').toLowerCase();
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
    if (filePath.startsWith('<') && filePath.includes('importlib')) return '<importlib>';

    let fileName = filePath;
    if (isAbsolute(filePath)) fileName = shortenFilename(fileName);

    const moduleName = fileName.replace(/\//g, '\\').split('\\')[0] || '<>';

    return moduleName && moduleName.startsWith('<') ? undefined : moduleName;
}
