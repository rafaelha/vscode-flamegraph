import * as vscode from 'vscode';
import { Flamegraph } from './flamegraph';

/**
 * Singleton class to manage the state of the VSCode extension
 */
class ExtensionState {
    // eslint-disable-next-line no-use-before-define
    private static instance: ExtensionState;

    private _context?: vscode.ExtensionContext;

    private _currentFlamegraph?: Flamegraph;

    private _profileVisible: boolean = false;

    private _focusNode: number[] = [0];

    private _activeProfileWatcher?: vscode.FileSystemWatcher;

    private _onUpdateUI: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    public readonly onUpdateUI: vscode.Event<void> = this._onUpdateUI.event;

    // Private constructor to prevent instantiation
    // eslint-disable-next-line no-useless-constructor, no-empty-function
    private constructor() {}

    /**
     * Returns the singleton instance of ExtensionState
     * @returns The ExtensionState instance
     */
    public static getInstance(): ExtensionState {
        if (!ExtensionState.instance) {
            ExtensionState.instance = new ExtensionState();
        }
        return ExtensionState.instance;
    }

    /**
     * Sets the VSCode extension context and clears any existing context
     * @param context The VSCode extension context
     */
    public setContext(context: vscode.ExtensionContext) {
        this._context = context;
        this.clearContext();
    }

    /**
     * Gets the current flamegraph instance
     * @returns The current Flamegraph instance or undefined if none exists
     */
    get currentFlamegraph(): Flamegraph | undefined {
        return this._currentFlamegraph;
    }

    /**
     * Sets the current flamegraph instance and clears the decoration cache
     * @param flamegraph The new Flamegraph instance or undefined to clear
     */
    set currentFlamegraph(flamegraph: Flamegraph | undefined) {
        this._currentFlamegraph = flamegraph;
    }

    /**
     * Gets the profile visibility state
     * @returns The current profile visibility state
     */
    get profileVisible(): boolean {
        return this._profileVisible;
    }

    /**
     * Sets the profile visibility state
     * @param visible The new profile visibility state
     */
    set profileVisible(visible: boolean) {
        if (this._profileVisible !== visible) {
            this._profileVisible = visible;
        }
    }

    /**
     * Gets the current focus node, i.e. the node that is currently selected in the react flamegraph
     * @returns The current focus node
     */
    get focusNode(): number[] {
        return this._focusNode;
    }

    /**
     * Sets the current focus node, i.e. the node that is currently selected in the react flamegraph
     * @param node The new focus node
     */
    set focusNode(node: number[]) {
        this._focusNode = node;
    }

    /**
     * Gets the profile URI from the workspaceState
     * @returns The profile URI or undefined if not set
     */
    get profileUri(): vscode.Uri | undefined {
        if (!this._context) return undefined;
        return this._context.workspaceState.get('profileUri');
    }

    /**
     * Sets the profile URI in the workspaceState
     * @param uri The new profile URI or undefined to clear
     */
    set profileUri(uri: vscode.Uri | undefined) {
        if (!this._context) return;
        this._context.workspaceState.update('profileUri', uri);
    }

    /**
     * Gets the active profile watcher. This monitors the profile file produced by py-spy
     * @returns The active profile watcher or undefined if none exists
     */
    get activeProfileWatcher(): vscode.FileSystemWatcher | undefined {
        return this._activeProfileWatcher;
    }

    /**
     * Sets the active profile watcher. This monitors the profile file produced by py-spy
     * @param watcher The new profile watcher or undefined to clear
     */
    set activeProfileWatcher(watcher: vscode.FileSystemWatcher | undefined) {
        if (this._activeProfileWatcher) {
            this._activeProfileWatcher.dispose();
        }
        this._activeProfileWatcher = watcher;
    }

    /**
     * Triggers a UI update event
     */
    public updateUI() {
        this._onUpdateUI.fire();
    }

    /**
     * Clears the VSCode extension context
     */
    private clearContext() {
        if (!this._context) return;
        for (const key of this._context.workspaceState.keys()) {
            if (key !== 'profileUri') {
                this._context.workspaceState.update(key, undefined);
            }
        }
    }

    /**
     * Cleans up resources by disposing event emitters and watchers
     */
    dispose() {
        this._onUpdateUI.dispose();
        if (this._activeProfileWatcher) {
            this._activeProfileWatcher.dispose();
        }
    }
}

// Export a singleton instance
export const extensionState = ExtensionState.getInstance();
