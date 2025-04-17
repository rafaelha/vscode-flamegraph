import * as vscode from 'vscode';
import { Flamegraph } from './flamegraph';
import { NotebookCellMap, UriToCodeMap } from './types';
import { FlamegraphPanel } from './flamegraphPanel';
import { readTextFile } from './utilities/fsUtils';

/**
 * Singleton class to manage the state of the VSCode extension
 */
class ExtensionState {
    // eslint-disable-next-line no-use-before-define
    private static instance: ExtensionState;

    private _context?: vscode.ExtensionContext;

    private _currentFlamegraph?: Flamegraph;

    private _profileVisible: boolean = false;

    private _profileDocumentUri?: vscode.Uri;

    private _focusNode: number[] = [0];

    private _sourceCode?: string[];

    private _activeProfileWatcher?: vscode.FileSystemWatcher;

    private _onUpdateUI: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    private _filenameToJupyterCellMap: NotebookCellMap = new Map();

    private _uriToCode: UriToCodeMap = new Map();

    private _decorationCache: Map<string, vscode.DecorationOptions[]> = new Map();

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
     * Gets the source code
     * @returns The source code
     */
    get sourceCode(): string[] | undefined {
        return this._sourceCode;
    }

    /**
     * Sets the source code
     *  @param sourceCode The new source code
     */
    set sourceCode(sourceCode: string[] | undefined) {
        this._sourceCode = sourceCode;
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
     * Gets the profile document URI
     * @returns The profile document URI or undefined if not set
     */
    get profileDocumentUri(): vscode.Uri | undefined {
        return this._profileDocumentUri;
    }

    /**
     * Sets the profile document URI
     * @param uri The new profile document URI or undefined to clear
     */
    set profileDocumentUri(uri: vscode.Uri | undefined) {
        if (uri) {
            this._profileDocumentUri = uri;
        }
    }

    /**
     * Gets the fileNameToJupyterCellMap
     * @returns The fileNameToJupyterCellMap
     */
    get filenameToJupyterCellMap(): NotebookCellMap {
        return this._filenameToJupyterCellMap;
    }

    /**
     * Sets the filenameToJupyterCellMap
     * @param filenameToJupyterCellMap The new filenameToJupyterCellMap
     */
    set filenameToJupyterCellMap(filenameToJupyterCellMap: NotebookCellMap) {
        this._filenameToJupyterCellMap = filenameToJupyterCellMap;
    }

    /**
     * Gets the uriToCodeMap
     * @returns The uriToCodeMap
     */
    get uriToCode(): UriToCodeMap {
        return this._uriToCode;
    }

    /**
     * Sets the uriToCodeMap
     * @param uriToCode The new uriToCodeMap
     */
    set uriToCode(uriToCode: UriToCodeMap) {
        this._uriToCode = uriToCode;
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
     * Gets the decoration cache for a specific file
     * @returns The decoration cache map
     */
    get decorationCache(): Map<string, vscode.DecorationOptions[]> {
        return this._decorationCache;
    }

    /**
     * Clears the decoration cache
     */
    public clearDecorationCache() {
        this._decorationCache.clear();
    }

    /**
     * Loads the source code asynchronously without blocking the main thread
     */
    public loadSourceCode() {
        if (!this.currentFlamegraph) return;
        this.currentFlamegraph
            .readSourceCode(this.uriToCode)
            .then((sourceCode) => {
                this.sourceCode = sourceCode;
                FlamegraphPanel.postSourceCode(sourceCode);
            })
            .catch(() => {
                // Silently ignore any errors during source code loading
            });
    }

    /**
     * Handles the profile update event. This is called when a new profile is written to the file system.
     *
     * @param context - The extension context.
     * @param profileUri - The URI of the profile file.
     */
    public handleProfileUpdate = async (context: vscode.ExtensionContext, profileUri: vscode.Uri) => {
        try {
            this.currentFlamegraph = new Flamegraph(await readTextFile(profileUri), this.filenameToJupyterCellMap);
            this.profileUri = profileUri;
            this.focusNode = [0];
            this.profileVisible = true;
            this.sourceCode = undefined;
            this.updateUI();
            FlamegraphPanel.render(context.extensionUri);
            this.loadSourceCode();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open profile: ${error}`);
        }
    };

    /**
     * Triggers a UI update event
     */
    public updateUI() {
        this.clearDecorationCache();
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
        this.clearDecorationCache();
    }
}

// Export a singleton instance
export const extensionState = ExtensionState.getInstance();
