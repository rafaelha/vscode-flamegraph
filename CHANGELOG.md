# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Auto-install `py-spy`. If `py-spy` is not installed, the extension will ask to install it.
- The flame graph will now remember the selected element after it is closed and reopened.

### Changed
- Better file path resolution when Cmd/Ctrl-clicking on an entry in the flame graph. Specifically, the `--full-filenames` option of `py-spy` is not used by default.
- Inline profile bars can now be shown for non-python files. This is useful for loading profiles that include sample from native code (like C-libraries). Use the `--native` flag of `py-spy` and make sure binaries are compiled with debug symbols.

### Fixed
- Fixed an issue where recursive function calls lead to incorrect inline profile information.
- Fixed a bug where inline profile bars exceeded 100% of the width.

## [0.1.0] - 2023-11-24
### Added
- Interactive inline profile: The flame graph and the inline profile are now linked visualizations. Clicking on a specific entry in the flame graph will filter the inline profile display to show only the profiling info visible in the flame graph. This is useful when a function is invoked from multiple locations. Previously, the inline profile aggregated all calls to the function. Now, aggregation can be filtered using the flame graph.
- Responsive flame graph legend: The items of the flame graph legend are now scrollable and adjust based on the currently visible modules in the flame graph.

## [0.0.4] - 2023-11-20
### Fixed
- Fixed a bug where inline profile decorations were not shown after VS Code update.

## [0.0.3] - 2023-11-16
### Fixed
- Fixed a bug where the `Toggle Inline Profile` command would sometimes not remove the inline profile decorations.

## [0.0.2] - 2024-11-13
### Added
- Initial release.