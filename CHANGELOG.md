# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- The command `Profile active file with py-spy` now launches a VS Code task instead of a terminal.

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