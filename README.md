# Flamegraphs in VS Code

####  Flamegraphs with hyperlinks and inline profiling results

Getting started is as simple as:
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to open the command palette
2. Type "Flamegraph: Profile" and select `Flamegraph: Profile active file with py-spy`

That's it! Your code will be profiled and the results will appear automatically.

![A demo of the extension](https://github.com/rafaelha/vscode-flamegraph/blob/main/assets/demo.gif?raw=true)

This is an early version of the extension and is still under active development. Currently only py-spy generated profiles are supported but support for other formats is planned.

## Usage

The extension visualizes profiling data in two ways:

1. **Inline Code Annotations**: Shows timing information for each function scope, with colors indicating the scope level.

2. **Interactive Flamegraph**: Displays the complete call stack of your profiled code, with colors denoting the Python module. You can:
   - Click any element to zoom in
   - Click parent elements to zoom out
   - `Cmd+Click` (Mac) or `Ctrl+Click` (Windows/Linux) any element to jump directly to that code.

**The inline annotations and flamegraph are linked**:
When you zoom in the flamegraph, the inline annotations automatically filter to show only the timing data for the visible part of the flamegraph.

![Interactive flamegraph demo](https://github.com/rafaelha/vscode-flamegraph/blob/main/assets/demo-interactive-flame-graph.gif?raw=true)

The flamegraph and inline annotations complement each other: The flamegraph shows call-stack specific data, while inline annotations show aggregated function-level profile data.

## Commands

-   `Flamegraph: Profile active file with py-spy` - Profile the active file with py-spy and display the results inline.

-   `Flamegraph: Load Profile` - Load a profile from a file. Currently only py-spy profiles are supported.

-   `Flamegraph: Toggle Inline Profile` - Show or hide the inline profile bars.

-   `Flamegraph: Show` - Open a new tab showing the flamegraph.

-   `Flamegraph: Attach py-spy to running process` - Attach py-spy to a running process and display the results inline. The extension will ask for a Process ID (PID) to attach to.

-   `Flamegraph: Attach py-spy to running process (native)` - Also collects profiling data from native (e.g. C++) extensions. This is not supported on all platforms. See this [blog post by Ben Frederickson](https://www.benfrederickson.com/profiling-native-python-extensions-with-py-spy/).

## Usage

1. Profile your code by running the `Flamegraph: Profile active file with py-spy` command.

1. A new tab will open with the flamegraph and profiled timing info will be shown inline in the editor for all files where samples were recorded. Cmd + Click (or Ctrl + Click on Windows/Linux) on any element in the flamegraph to navigate to the corresponding file and line in the editor.

1. Clicking on an element in the flamegraphs will zoom horizontally to that element. To zoom out, click on one of the parent elements. The flamegraph zoom will also affect the inline profile. The inline profile will show only the profiled timing info for the visible part of the flamegraph.

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
