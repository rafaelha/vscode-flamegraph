# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.3.11] - 2025-04-17
### Added
- Added toggle in flamegraph legend to switch between source code and function name display.
- Code display now works for Jupyter notebook cells in addition to python files.
- New VS Code setting `flamegraph.alwaysUseSudo` to always use `sudo` when running py-spy commands. This is required for some Linux distributions.
- Flamegraph icon in flamegraph tab.

### Fixed
- Fixed an issue where the `py-spy top` was run without `sudo` on Linux.

### Changed
- Improved process selection with streamlined PID picking and added support for ray processes.

## [0.3.10] - 2025-04-10
### Changed
- Improved legend in the flamegraph. Now, filtering by module (by deselcting items in the legend) does not reset the zoom level, unless the currently selected node is affected by the module filtering.
- Legend items are now sorted by total time (previously they were sorted by visible area in the flamegraph).

### Added
- When clicking the `all` node in the flamegraph, the VS Code editor will now open the file that was profiled.

### Fixed
- Fixed an issue where the `Profile Cell` command did not work when executed via the command palette.

## [0.3.9] - 2025-04-04
### Added
- Added tooltips to flamegraph legend items that show time/ own time for each module.

## [0.3.8] - 2025-03-29
### Fixed
- Fixed broken flamegraph hyperlinks on Windows.
- Fixed an issue on Linux where `sudo` was not used when attaching to a running process.

## [0.3.7] - 2025-03-08
### Added
- VS Code settings `flamegraph.py-spy.subprocesses`, `flamegraph.py-spy.native`, `flamegraph.py-spy.nativeAttach`, `flamegraph.py-spy.gil`, `flamegraph.py-spy.idle`, `flamegraph.py-spy.nonblocking` to set py-spy flags.
- VS Code setting `flamegraph.syncInlineAnnotations` (enabled by default) to sync inline annotations with the flamegraph. When enabled, selected a node in the flamegraph will update the inline annotations to only show timing information for the visible flamegraph nodes.

### Changed
- When a flamegraph tab is already open, profiling a file will no longer resize or reveal the existing tab.

### Fixed
- Fixed an issue where the profile data was not parsed correctly in multi-process applications.

### Removed

- Removed command `Flamegraph: Attach py-spy to running process (native)`. Instead, the `--native` flag for `py-spy`
can be enabled with the setting `flamegraph.py-spy.native` or by defining a custom task in your `tasks.json` file (see README for details).

## [0.3.6] - 2025-03-02
### Added
- Added support for VS Code task API. Now you can add your custom task definitions to your `tasks.json` file. See README for details.

### Changed
- Reintroduced source code display in the flamegraph.
- When profiling Jupyter notebooks, the task terminal will now remain in the background.

## [0.3.5] - 2025-02-24
### Fixed
- Fixed issue where profiles were not rendered in Jupyter cells with CRLF line endings
- Fix issue where py-spy was not found when the file path contained spaces.

### Changed
- Improved py-spy installation process. Now, py-spy installations in the currently selected virtual environment
are used if no global installation is found.
- On windows, the VS Code taks will now always use `powershell`.
- Improved instructions on how to add py-spy to the sudoers file on macOS and Linux.
- The flamegraph does not show source code anymore to improve load time. This features will be added back in a future release.


## [0.3.4] - 2025-02-17
### Added
- Added `Flamegraph: Show py-spy top` command. This command will display a `top`-like view of functions consuming CPU using py-spy.
- Added `Flamegraph: Profile all unit tests with pytest` and `Flamegraph: Profile unit tests in file with pytest` commands.

### Changed
- The `Attach py-spy to running process` command now shows a dropdown list with running python processes to select from.

## [0.3.3] - 2025-02-12
### Changed
- Improved py-spy installation process

## [0.3.2] - 2025-02-02
### Fixed
- Fixed an issue where module level line annotations were not shown in notebooks for some versions of Jupyter.

## [0.3.1] - 2025-02-02
### Fixed
- Fixed broken release: The extension was not activating due to incorrect access of the Python extension API.

## [0.3.0] - 2025-02-02
### Added
- Support for profiling Jupyter notebooks. Notebooks can be profiled by clicking `Profile` button in the notebook toolbar. Profiling results will show up in all executed cells and python files. Individual cells can be profiled with the 🔥 button at the top of each cell.
- Faster profile loading via caching.

### Fixed
- Fixed an issue where profiles were not rendered when the filepath contained spaces on Windows.

## [0.2.7] - 2025-01-23
### Added
- Module filtering in the flamegraph. Modules entries in the flamegraph legend can now be checked and unchecked.
This will filter nodes in the flamegraph by their module. When a node is filtered out, its children are appended to its parent. A common use case is to check/uncheck the `process` module in multiprocessing applications. This will show the flamegraph resolved for all processes or combined for all processes.
- Tighter integration with VS Code: The extension now provides context menu items in the file explorer for `.py` and `.pyspy` files. Additionally, the ▶️ icon in the editor title bar can now be switched to a 🔥 icon which starts the py-spy profiler. Right-clicking on a python editor reveals the `Toggle Inline Profile` command.

### Changed
- Py-spy profiles are now saved as `profile.pyspy` in the workspace directory.

## [0.2.6] - 2025-01-16
### Fixed
- Fixed a bug where the inline profile decorations were not cleared after executing the `Toggle Inline Profile` command.

## [0.2.5] - 2025-01-13
### Fixed
- Fixed an issue with auto-installing `py-spy` via the extension.
- Fixed a bug where inline profile decorations were sometimes not updated after zooming the flamegraph.

## [0.2.4] - 2025-01-12
### Fixed
- Fixed a performance issue where the extension was slow for large profile files.
- Fixed a bug where native frames were not shown in the flamegraph.

## [0.2.3] - 2024-12-20
### Changed
- The flamegraph now shows code line content instead of function names.
- The flamegraph is now filtered to only show relevant frames. In the future, we will add an option to show all and filter by module.

## [0.2.2] - 2024-12-18
### Added
- Added support for light and high contrast themes in VS Code.
- Added two new commands: `Attach py-spy to running process` and `Attach py-spy to running process (native)`. The extension will ask for the PID of the process to attach to. In the `native` case, the `--native` flag of `py-spy` is used, i.e. native python extensions will be sampled. This is not supported on all platforms. See this [blog post by Ben Frederickson](https://www.benfrederickson.com/profiling-native-python-extensions-with-py-spy/).

### Changed
- Simplified flamegraph coloring: Colors are now determined solely by module names. Previously file names and line numbers slightly influenced saturation and lightness. This  change should make the flamegraph less visually noisy and easier to read.

## [0.2.1] - 2024-12-13
### Fixed
- Fixed a bug on Windows where inline profile bars where not shown for all files even though profile data was available.

### Changed
- The command `Profile file with py-spy` now launches a VS Code task instead of a terminal.

## [0.2.0] - 2024-12-10
### Added
- Auto-install `py-spy`. If `py-spy` is not installed, the extension will ask to install it.
- The flame graph will now remember the selected element after it is closed and reopened.

### Changed
- Better file path resolution when Cmd/Ctrl-clicking on an entry in the flame graph. Specifically, the `--full-filenames` option of `py-spy` is now used by default.
- Inline profile bars can now be shown for non-python files. This is useful for loading profiles that include samples from native code (like C-libraries). Use the `--native` flag of `py-spy` and make sure binaries are compiled with debug symbols.

### Fixed
- Fixed an issue where recursive function calls lead to incorrect inline profile information.
- Fixed a bug where inline profile bars exceeded 100% of the width.

## [0.1.0] - 2024-11-24
### Added
- Interactive inline profile: The flame graph and the inline profile are now linked visualizations. Clicking on a specific entry in the flame graph will filter the inline profile display to show only the profiling info visible in the flame graph. This is useful when a function is invoked from multiple locations. Previously, the inline profile aggregated all calls to the function. Now, aggregation can be filtered using the flame graph.
- Responsive flame graph legend: The items of the flame graph legend are now scrollable and adjust based on the currently visible modules in the flame graph.

## [0.0.4] - 2024-11-20
### Fixed
- Fixed a bug where inline profile decorations were not shown after VS Code update.

## [0.0.3] - 2024-11-16
### Fixed
- Fixed a bug where the `Toggle Inline Profile` command would sometimes not remove the inline profile decorations.

## [0.0.2] - 2024-11-13
### Added
- Initial release.