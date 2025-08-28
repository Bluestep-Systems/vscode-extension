## IMPORTANT

install the required vscode extensions found in the .vscode/extensions.json file

run tests by going to the "run" panel and selecting "Run 'Test' Environment"

## Features

### Custom Update Checking

The B6P Extension includes a custom update checking system that:

- **Automatically checks for updates** every 24 hours after startup
- **Checks GitHub Releases** for the latest version using the GitHub API
- **Shows notifications** when updates are available with options to:
  - Download the update directly
  - View release notes in a built-in viewer
  - Disable automatic update checking
  - Remind later
- **Manual updates** via the "B6P: Check for Updates" command
- **Configurable settings** to control update checking behavior

#### Configuration

You can configure update checking in VS Code settings:

- `bsjs-push-pull.updateCheck.enabled` - Enable/disable automatic update checking (default: true)
- `bsjs-push-pull.updateCheck.showNotifications` - Show/hide update notifications (default: true)

#### How it works

1. On startup, the extension waits 5 seconds then checks GitHub for the latest release
2. It compares the latest version with the currently installed version
3. If a newer version is found, it shows a notification with update options
4. Users can also manually check for updates using the Command Palette: "B6P: Check for Updates"

#### Private Distribution

This custom update system is designed for private extension distribution. When you want to distribute updates:

1. Create a GitHub release with your `.vsix` file attached
2. Users will automatically be notified of the update
3. They can download and install it manually via VS Code's extension manager

The update checker automatically filters out draft releases and pre-releases to only show stable versions to users.