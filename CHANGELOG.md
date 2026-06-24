# Change Log

All notable changes to the B6P - BlueStep JavaScript Push/Pull extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.2] - 2026-06-24

### Changed

- Extracted from the former `bsjs-push-pull` monorepo into this standalone single-extension
  repository. The vscode-free core was split into
  [`@bluestep-systems/b6p-core`](https://github.com/Bluestep-Systems/b6p-core) and the CLI into
  [`@bluestep-systems/b6p-cli`](https://github.com/Bluestep-Systems/b6p-cli).
- `@bluestep-systems/b6p-core` is now resolved from the **public npm registry** by version (pinned via
  the committed `.npmrc`) and bundled into the `.vsix` by esbuild, instead of a monorepo workspace
  symlink. Self-contained `tsconfig`/eslint/prettier config now live at the repo root.
- Added a PR/push CI validation workflow (`.github/workflows/ci.yml`) on the win/mac matrix alongside the
  existing tag-driven release workflow.

### Fixed

- Bumped `@bluestep-systems/b6p-core` to `0.1.1`, which fixes Windows drive-letter path parsing in
  `DownstairsPathParser` — gitignore detection and root URI resolution now work correctly on Windows.
- Fixed test assertion for downstairs URI conversion to be drive-letter tolerant on Windows.

No change to extension behavior, commands, settings, or installation — it is still distributed as a
`.vsix` via GitHub Releases (no Marketplace).

## [0.0.1] - 2025-08-28

### Added
- Initial release of B6P Extension
- WebDAV integration for BlueStep systems
- Push/Pull functionality for JavaScript files
- Basic authentication management
- Command palette integration
- Sidebar quick commands
- Custom update checking system
  - Automatic update checks every 24 hours
  - Manual update checking via command
  - GitHub releases integration
  - Update notifications with download links
  - Configurable update settings
  - Release notes viewer

### Features
- **Push Script** - Upload JavaScript files to BlueStep systems
- **Pull Script** - Download JavaScript files from BlueStep systems  
- **Push Current** - Upload the currently active file
- **Pull Current** - Download files for the current project
- **Update Credentials** - Manage WebDAV authentication
- **Run Task** - Execute JavaScript code directly
- **Check for Updates** - Manually check for extension updates
- **Report State** - Debug command to show extension state
- **Clear State** - Reset extension state and credentials

### Technical
- TypeScript implementation with strict type checking
- ESBuild for production bundling
- Custom VSIX packaging system
- Private distribution support
- Comprehensive error handling
- VS Code API 1.103.0+ compatibility

## [0.0.12] - 2025-09-10

### Fixed
- Improved error handling
- Fixed UI glitches in the sidebar panel
- Fixed concurrency issues
- Fixed update notification bugs
- Fixed credential storage issues
- Fixed file path handling for different OSes
- Fixed issues with large file uploads/downloads