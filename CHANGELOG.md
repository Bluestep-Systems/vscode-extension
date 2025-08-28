# Change Log

All notable changes to the B6P - BlueStep JavaScript Push/Pull extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
