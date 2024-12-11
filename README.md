# Flamegraphs in VS Code

####  Flamegraphs with hyperlinks and inline profiling results in VS Code

This is an early version of the extension and is still under active development. Currently only py-spy generated profiles are supported but support for other formats is planned.

![A demo of the extension](https://github.com/rafaelha/vscode-flamegraph/blob/main/assets/demo.gif?raw=true)

## Commands

-   `Flamegraph: Profile active file with py-spy` - Profile the active file with py-spy and display the results inline.

-   `Flamegraph: Load Profile` - Load a profile from a file. Currently only py-spy profiles are supported.

-   `Flamegraph: Toggle Inline Profile` - Show or hide the inline profile bars.

-   `Flamegraph: Show` - Open a new tab showing the flamegraph.

## Usage

1. Profile your code by running the `Flamegraph: Profile active file with py-spy` command.

1. A new tab will open with the flamegraph and profiled timing info will be shown inline in the editor for all files where samples were recorded. Cmd + Click (or Ctrl + Click on Windows/Linux) on any element in the flamegraph to navigate to the corresponding file and line in the editor.

1. Clicking on an element in the flamegraphs will zoom horizontally to that element. To zoom out, click on one of the parent elements. The flamegraph zoom will also affect the inline profile. The inline profile will show only the profiled timing info for the visible part of the flamegraph.

![Interactive flamegraph demo](https://github.com/rafaelha/vscode-flamegraph/blob/main/assets/demo-interactive-flame-graph.gif?raw=true)

## Contributing

### Development

```bash
# Install dependencies for both the extension and webview UI source code
npm run install:all

# Build webview UI source code
npm run build:webview
```

Then, in VS Code

1. Press `F5` to open a new Extension Development Host window
2. Inside the host window, open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and type `Flamegraph: Profile active file with py-spy`
