# Flamegraph Visualizer for py-spy Profiles in Python and Jupyter


[![Installs](https://img.shields.io/visual-studio-marketplace/i/rafaelha.vscode-flamegraph?color=ff4500&style=flat&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=rafaelha.vscode-flamegraph)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/rafaelha.vscode-flamegraph?color=ffff00&style=flat&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=rafaelha.vscode-flamegraph)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/rafaelha.vscode-flamegraph?color=ff8c00&style=flat&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=rafaelha.vscode-flamegraph)
[![Like this? Leave a star](https://img.shields.io/github/stars/rafaelha/vscode-flamegraph?style=flat&label=Like%20this%3F%20Leave%20a%20star&color=yellow&logo=github)](https://github.com/rafaelha/vscode-flamegraph)


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
| `Flamegraph: Profile all unit tests with pytest` | Run and profile the `pytest` command |
| `Flamegraph: Profile unit tests in file with pytest` | Run and profile the `pytest` command on the active file |
| `Flamegraph: Show py-spy top` | Displays a top like view of functions consuming CPU using py-spy |



## Using Tasks

The extension allows you to run the py-spy profiler from VS Code's task system. This makes it easy to integrate profiling into your workflow and configure custom tasks.

### Using the Task Explorer

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
2. Type "Tasks: Run Task" and select "flamegraph"
3. Choose one of the available flamegraph tasks or click the gear icon to customize the task.

### Creating a tasks.json File

You can also create a `tasks.json` file in your `.vscode` folder to customize the tasks. For example, the task



```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"type": "flamegraph",
			"file": "${file}",
			"args": [
				"--my-custom-arg1",
				"value",
			],
			"label": "Flamegraph: My custom profile command"
		}
	]
}
```

will execute the command

```py-spy <py-spy-args> -- python <current-file> --my-custom-arg1 value```.

Or, you can profile a specific unit test (via `pytest`) with the following task definition:


```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"type": "flamegraph",
			"args": [
				"-m",
				"pytest",
				"path/to/my_test_file.py::test_my_function",
			],
			"subprocesses": false,
			"native": true,
			"subprocesses": false,
			"gil": false,
			"idle": false,
			"nonblocking": false,
			"label": "Flamegraph: Profile my_test_function"
		}
	]
}
```

Notice that we additionally enabled the py-spy native option. This will execute the command

```py-spy <py-spy-args> --native -- python -m pytest path/to/my_test_file.py::test_my_function```



### Setting custom keyboard shortcuts

You can bind tasks to keyboard shortcuts by adding entries to your `keybindings.json` file:

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
2. Type "Preferences: Open Keyboard Shortcuts (JSON)" and select it
3. Add entries like the following:

```json
{
    "key": "ctrl+shift+enter",
    "command": "workbench.action.tasks.runTask",
    "args": "Flamegraph: My custom profile command"
}
```

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