# Flamegraph Visualizer for py-spy Profiles in Python and Jupyter

Profiling your code with *Flamegraph* is simple.

In Jupyter notebooks, click the 🔥 button above the cell you want to profile:

![Profile jupyter notebook](https://github.com/rafaelha/vscode-flamegraph/blob/a0f7c296fa3d9fa55fba485436ed31573d02c86f/assets/screenshot-notebook.png?raw=true)



For Python scripts, select `Flamegraph: Profile file with py-spy` from the dropdown menu next to the ▶️ icon:


![Profile python script](https://github.com/rafaelha/vscode-flamegraph/blob/a0f7c296fa3d9fa55fba485436ed31573d02c86f/assets/screenshot-python.png?raw=true)

Your code will be profiled with [py-spy](https://github.com/benfred/py-spy). You can interrupt the profiling anytime via `Ctrl+C`
or wait for it to finish.
The profiling results are then visualized next to your code and as a flamegraph in a new tab.

To hide the inline annotions, right-click anywhere in the editor and select `Flamegraph: Toggle Inline Profile`.


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

## Useful Commands

Open the Command Palette (Command+Shift+P on Mac and Ctrl+Shift+P on Windows/Linux) and type in one of the following commands:

| Command | Description |
|---------|-------------|
| `Flamegraph: Profile file with py-spy` | Profile the active file with py-spy and display the results |
| `Flamegraph: Load Profile` | Load a profile from a py-spy file. You may also right-click on `.pyspy` files in the file explorer and select `Flamegraph: Load Profile`. |
| `Flamegraph: Toggle Inline Profile` | Show or hide the inline annotations. This is also accessible via right-click on the editor. |
| `Flamegraph: Show` | Open a new tab showing the flamegraph |
| `Flamegraph: Attach py-spy to running process` | Attach py-spy to a running process and display the results. The extension will ask for a Process ID (PID) to attach to |
| `Flamegraph: Attach py-spy to running process (native)` | Attach py-spy, and also collect profiling data from native (e.g. C++) extensions. This is not supported on all platforms. See this [blog post by Ben Frederickson](https://www.benfrederickson.com/profiling-native-python-extensions-with-py-spy/) |
| `Flamegraph: Profile all unit tests with pytest` | Run and profile the `pytest` command |
| `Flamegraph: Profile unit tests in file with pytest` | Run and profile the `pytest` command on the active file |
| `Flamegraph: Show py-spy top` | Displays a top like view of functions consuming CPU using py-spy |

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

- [ ] Switch to `speedscope` format. Eventually, this extension should be refactored to be compatible with all profilers that output `speedscope` files. Currently, only left-heavy profile view is supported.
- [ ] Unit tests
- [x] Performance tests
- [x] Option to filter the flamegraph by module.
- [ ] Refactor flamegraph react component. Currently, the whole graph is recomputed on every mouse hover event. We could consider using `speedscope` npm package to render the flamegraph.
- [ ] Search in flamegraph
- [ ] Profiling files without opening a workspace/folder. Currently, the extension requires a workspace/folder to be opened.
- [ ] Memray memory profiles
- [ ] Zoom animations in flamegraph
- [ ] Select sampling interval
- [x] Jupyter notebook profiling.