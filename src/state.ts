import * as vscode from 'vscode';
import { Flamegraph } from './flamegraph';

class ExtensionState {
    // eslint-disable-next-line no-use-before-define
    private static instance: ExtensionState;

    private _context?: vscode.ExtensionContext;

    private _currentFlamegraph?: Flamegraph;

    private _profileVisible: boolean = false;

    private _focusNode: number = 0;

    // Private constructor to prevent instantiation
    // eslint-disable-next-line no-useless-constructor, no-empty-function
    private constructor() {}

    public static getInstance(): ExtensionState {
        if (!ExtensionState.instance) {
            ExtensionState.instance = new ExtensionState();
        }
        return ExtensionState.instance;
    }

    public setContext(context: vscode.ExtensionContext) {
        this._context = context;
        this.clearContext();
    }

    get currentFlamegraph(): Flamegraph | undefined {
        return this._currentFlamegraph;
    }

    set currentFlamegraph(flamegraph: Flamegraph | undefined) {
        this._currentFlamegraph = flamegraph;
    }

    get profileVisible(): boolean {
        return this._profileVisible;
    }

    set profileVisible(visible: boolean) {
        this._profileVisible = visible;
    }

    get focusNode(): number {
        return this._focusNode;
    }

    set focusNode(node: number) {
        this._focusNode = node;
    }

    // Profile URI with workspaceState persistence
    get profileUri(): vscode.Uri | undefined {
        if (!this._context) return undefined;
        return this._context.workspaceState.get('profileUri');
    }

    set profileUri(uri: vscode.Uri | undefined) {
        if (!this._context) return;
        this._context.workspaceState.update('profileUri', uri);
    }

    private clearContext() {
        if (!this._context) return;
        for (const key of this._context.workspaceState.keys()) {
            if (key !== 'profileUri') {
                this._context.workspaceState.update(key, undefined);
            }
        }
    }
}

// Export a singleton instance
export const extensionState = ExtensionState.getInstance();
