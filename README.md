# Flamegraph Visualizer for py-spy Profiles in Python and Jupyter

Profiling your code with *Flamegraph* is simple.

In Jupyter notebooks, click the 🔥 button above the cell you want to profile:

![Profile jupyter notebook](https://github.com/rafaelha/vscode-flamegraph/blob/a0f7c296fa3d9fa55fba485436ed31573d02c86f/assets/screenshot-notebook.png?raw=true)



For Python scripts, select `Flamegraph: Profile file with py-spy` from the dropdown menu next to the ▶️ icon:


![Profile python script](https://github.com/rafaelha/vscode-flamegraph/blob/a0f7c296fa3d9fa55fba485436ed31573d02c86f/assets/screenshot-python.png?raw=true)

Alternatively, open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and type `Flamegraph: Profile file with py-spy`.

Your code will be profiled using [py-spy](https://github.com/benfred/py-spy). You can interrupt the profiling anytime via `Ctrl+C`
or wait for it to finish.
The profiling results are then visualized next to your code and as a flamegraph in a new tab.



> **Note:** On macOS, `py-spy` requires root privileges for profiling Jupyter notebooks. You need to add `py-spy` to the sudoers file, as described [here](https://github.com/rafaelha/vscode-flamegraph/blob/e5b38dc6c87fee310c5562fcc4a3c6178040bfb3/docs/macos-setup.md).

## Usage

The extension visualizes profiling data in two ways:

1. **Inline Code Annotations**: Shows timing information for each function scope, with colors indicating the scope level.

2. **Interactive Flamegraph**: Displays the complete call stack of your profiled code (see [this article](https://www.brendangregg.com/flamegraphs.html) about flamegraphs). You can:
   - Click any element to zoom in
   - Click parent elements to zoom out
   - `Cmd+Click` (Mac) or `Ctrl+Click` (Windows/Linux) any element to jump directly to that code.

The flamegraph and inline annotations are linked -
when you select an element in the flamegraph, the corresponding inline annotations are filtered.

![Interactive flamegraph demo](https://github.com/rafaelha/vscode-flamegraph/blob/main/assets/demo-interactive-flame-graph.gif?raw=true)

The flamegraph and inline annotations complement each other - the flamegraph shows call-stack specific data, while inline annotations show aggregated function-level profile data.

## Commands


-   `Flamegraph: Profile file with py-spy` - Profile the active file with py-spy and display the results.

-   `Flamegraph: Load Profile` - Load a profile from a py-spy file.

-   `Flamegraph: Toggle Inline Profile` - Show or hide the inline annotations.

-   `Flamegraph: Show` - Open a new tab showing the flamegraph.

-   `Flamegraph: Attach py-spy to running process` - Attach py-spy to a running process and display the results. The extension will ask for a Process ID (PID) to attach to.

-   `Flamegraph: Attach py-spy to running process (native)` - Also collects profiling data from native (e.g. C++) extensions. This is not supported on all platforms. See this [blog post by Ben Frederickson](https://www.benfrederickson.com/profiling-native-python-extensions-with-py-spy/).

## Contributing

### Development
1. Clone the repository
```bash
git clone https://github.com/rafaelha/vscode-flamegraph.git
```

2. Install dependencies for both the extension and the flamegraph-react UI
```bash
npm run install:all
```
3. Build webview UI source code, i.e. the flamegraph react component
```bash
npm run build:webview
```

4. In VS Code, press `F5` to open a new Extension Development Host window.




### TODO

- [ ] Unit tests
- [ ] Performance tests
- [x] Option to filter the flamegraph by module. Since processes are treated as a module, this would, e.g., allow to show the flamegraph resolved for all processes or combined for all processes.
- [ ] Refactor flamegraph react component. Currently, the whole graph is recomputed on every mouse hover event.
- [ ] Search in flamegraph
- [ ] Profiling files without opening a workspace/folder. Currently, the extension requires a workspace/folder to be opened.
- [ ] Memray memory profiles
- [ ] Zoom animations in flamegraph
- [ ] Select sampling interval
- [x] Jupyter notebook profiling. Currently, it is possible to attache to a running kernel process. But profile results cannot be displayed in the notebook.