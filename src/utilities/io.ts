import * as vscode from 'vscode';

export async function readTextFile(fileUri: vscode.Uri): Promise<string> {
    const data = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(data).toString('utf8');
}

export async function selectProfileFile(): Promise<vscode.Uri | undefined> {
    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select profile file',
        filters: {
            'All files': ['*'],
        },
    };
    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) return fileUri[0];
    return undefined;
}
