import {
    Disposable,
    Webview,
    WebviewPanel,
    window,
    Uri,
    ViewColumn,
    workspace,
    Selection,
    TextEditorRevealType,
    TextDocument,
    commands,
} from 'vscode';
import { getUri } from './utilities/fsUtils';
import { getNonce } from './utilities/nonceUtils';
import { Flamegraph } from './flamegraph';
import { extensionState } from './state';
import { flattenFlamegraphTree } from './utilities/flamegraphUtils';

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class FlamegraphPanel {
    // eslint-disable-next-line no-use-before-define
    public static currentPanel: FlamegraphPanel | undefined;

    private readonly _panel: WebviewPanel;

    private _disposables: Disposable[] = [];

    /**
     * The HelloWorldPanel class private constructor (called only from the render method).
     *
     * @param panel A reference to the webview panel
     * @param extensionUri The URI of the directory containing the extension
     */
    private constructor(panel: WebviewPanel, extensionUri: Uri) {
        this._panel = panel;

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Set the HTML content for the webview panel
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._panel.webview);
    }

    /**
     * Renders the current webview panel if it exists otherwise a new webview panel
     * will be created and displayed.
     *
     * @param extensionUri The URI of the directory containing the extension.
     */
    public static render(extensionUri: Uri, alwaysShowFlamegraph: boolean = false) {
        const showFlamegraphBehavior = workspace.getConfiguration('flamegraph').get('showFlamegraph');

        const flamegraph: Flamegraph | undefined = extensionState.currentFlamegraph;
        if (!flamegraph) return;

        if ((showFlamegraphBehavior === 'showAndFocus' || alwaysShowFlamegraph) && FlamegraphPanel.currentPanel) {
            // Reveal the panel if it already exists and the appropriate setting is enabled
            FlamegraphPanel.currentPanel._panel.reveal(ViewColumn.Beside);
        } else if (
            !FlamegraphPanel.currentPanel &&
            (showFlamegraphBehavior !== 'onlyShowCodeAnnotations' || alwaysShowFlamegraph)
        ) {
            // Create a new panel if it doesn't exist and the appropriate setting is enabled
            const panel = window.createWebviewPanel('showFlamegraph', 'Flamegraph', ViewColumn.Beside, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    Uri.joinPath(extensionUri, 'out'),
                    Uri.joinPath(extensionUri, 'flamegraph-react/build'),
                    Uri.joinPath(extensionUri, 'assets'),
                    Uri.joinPath(extensionUri, 'flamegraph-react/node_modules/@vscode/codicons/dist'),
                ],
            });

            // Set the webview panel icon to a flame
            const iconPath = Uri.joinPath(extensionUri, 'assets', 'flame.png');
            panel.iconPath = iconPath;

            FlamegraphPanel.currentPanel = new FlamegraphPanel(panel, extensionUri);
        }

        if (FlamegraphPanel.currentPanel) {
            // Flatten the tree structure to avoid JSON serialization issues with deep trees
            const flattenedNodes = flattenFlamegraphTree(flamegraph.root);

            FlamegraphPanel.currentPanel._panel.webview.postMessage({
                type: 'profile-data',
                data: {
                    flattenedNodes,
                    rootUid: flamegraph.root.uid,
                    focusUid: extensionState.focusNode.length === 1 ? extensionState.focusNode[0] : flamegraph.root.uid,
                    functions: flamegraph.functions,
                    sourceCode: extensionState.sourceCode,
                    profileType: flamegraph.profileType,
                },
            });
        }
    }

    public static postSourceCode(sourceCode: string[]) {
        if (!FlamegraphPanel.currentPanel) return;
        FlamegraphPanel.currentPanel._panel.webview.postMessage({
            type: 'source-code',
            data: sourceCode,
        });
    }

    /**
     * Cleans up and disposes of webview resources when the webview panel is closed.
     */
    public dispose() {
        FlamegraphPanel.currentPanel = undefined;

        // Dispose of the current webview panel
        this._panel.dispose();

        // Dispose of all disposables (i.e. commands) for the current webview panel
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Defines and returns the HTML that should be rendered within the webview panel.
     *
     * @remarks This is also the place where references to the React webview build files
     * are created and inserted into the webview HTML.
     *
     * @param webview A reference to the extension webview
     * @param extensionUri The URI of the directory containing the extension
     * @returns A template string literal containing the HTML that should be
     * rendered within the webview panel
     */
    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
        // The CSS file from the React build output
        const stylesUri = getUri(webview, extensionUri, ['flamegraph-react', 'build', 'static', 'css', 'main.css']);
        const codiconsUri = getUri(webview, extensionUri, [
            'flamegraph-react',
            'node_modules',
            '@vscode',
            'codicons',
            'dist',
            'codicon.css',
        ]);
        // The JS file from the React build output
        const scriptUri = getUri(webview, extensionUri, ['flamegraph-react', 'build', 'static', 'js', 'main.js']);

        const nonce = getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
          <meta name="theme-color" content="#000000">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <link rel="stylesheet" type="text/css" href="${codiconsUri}">
          <title>Flamegraph</title>
        </head>
        <body>
          <noscript>You need to enable JavaScript to run this app.</noscript>
          <div id="root"></div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    /**
     * Sets up an event listener to listen for messages passed from the webview context and
     * executes code based on the message that is received.
     *
     * @param webview A reference to the extension webview
     */
    private _setWebviewMessageListener(webview: Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                const { command } = message;

                switch (command) {
                    case 'open-file':
                        try {
                            // Find the file in the workspace
                            let fileUri: Uri =
                                message.file === 'root' && extensionState.profileDocumentUri
                                    ? extensionState.profileDocumentUri
                                    : Uri.parse(message.file);

                            // Open the first matching file
                            let document: TextDocument;
                            try {
                                document = await workspace.openTextDocument(fileUri);
                            } catch (error) {
                                const files = await workspace.findFiles(`**/${message.file}`);
                                if (files.length === 0) return;
                                [fileUri] = files;
                                document = await workspace.openTextDocument(fileUri);
                            }
                            const editor = await window.showTextDocument(document, {
                                viewColumn: ViewColumn.One,
                                preserveFocus: false,
                            });

                            if (message.file !== 'root') {
                                // Move cursor to specified line
                                const line = Math.max(0, message.line - 1); // Convert to 0-based line number
                                const { range } = document.lineAt(line);
                                editor.selection = new Selection(range.start, range.start);
                                editor.revealRange(range, TextEditorRevealType.InCenter);
                            }

                            // Scroll the document all the way to the left
                            await Promise.all(
                                Array(10)
                                    .fill(0)
                                    .map(() => commands.executeCommand('scrollLeft'))
                            );
                        } catch (error) {
                            // do nothing, error messages are overly verbose
                        }

                        break;

                    case 'set-focus-node': {
                        const syncInlineAnnotations = workspace
                            .getConfiguration('flamegraph')
                            .get('syncInlineAnnotations');
                        if (syncInlineAnnotations) {
                            const { uids } = message;
                            extensionState.focusNode = uids;
                            extensionState.updateUI();
                        }
                        break;
                    }

                    default:
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }
}
