import { Uri, Webview } from 'vscode';

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
    return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}

/**
 * Normalizes a file path to use forward slashes. This is important for comparing file paths on different platforms.
 *
 * @param filePath - The file path to normalize.
 * @returns The normalized file path.
 */
export function normalizePath(filePath: string) {
    return filePath.replace(/\\/g, '/');
}

export function getModuleName(filePath: string | undefined): string | undefined {
    const moduleName = filePath?.replace(/\//g, '\\').split('\\')[0] || undefined;
    return moduleName && moduleName.startsWith('<') ? undefined : moduleName;
}