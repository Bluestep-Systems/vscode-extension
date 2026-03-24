# BlueStep VS Code/Cursor Extension Setup

## Installation

### Quick Install (Latest Release)

**Linux/Mac:**
```bash
curl -sL $(curl -s https://api.github.com/repos/bluestep-systems/vscode-extension/releases/latest | grep "browser_download_url.*vsix" | cut -d '"' -f 4) -o bsjs-extension.vsix && code --install-extension bsjs-extension.vsix && rm bsjs-extension.vsix
```

**Windows (PowerShell):**
```powershell
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/bluestep-systems/vscode-extension/releases/latest"; $asset = $release.assets | Where-Object { $_.name -like "*.vsix" } | Select-Object -First 1; Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "bsjs-extension.vsix"; code --install-extension bsjs-extension.vsix; Remove-Item "bsjs-extension.vsix"
```

### Manual Installation

1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/bluestep-systems/vscode-extension/releases/latest)
2. In VS Code, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Type "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file

Thank you for installing the BlueStep JavaScript Push/Pull extension!

## Configure File Watcher Exclusions

To prevent VS Code/Cursor from watching directories and hidden files created/managed by this extension, please apply the following to your file settings. This is not strictly required, but it is highly recommended in order to avoid confusion and lessen performance issues.

### Recommended Settings

Add these glob patterns to your `files.watcherExclude` setting:

```json
{
  "files.watcherExclude": {
    "**/U??????/*/{snapshot,.}": true
  }
}
```

Or add them separately:

```json
{
  "files.watcherExclude": {
    "**/U??????/*/snapshot": true,
    "**/U??????/*/.": true
  }
}
```

### Why is this needed?

These patterns exclude:
- **Snapshot directories**: Script snapshots created during operations
- **Hidden metadata**: Internal extension state stored in `.` directories

Without these exclusions, VS Code may experience:
- Performance degradation from watching unnecessary files
- Unintended side effects from reacting to changes in these files

### How to add these settings

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for "files.watcherExclude"
3. Click "Add Pattern"
4. Enter: `**/U??????/*/{snapshot,.}`
5. Click OK

Or edit your `.vscode/settings.json` directly and add the JSON above.

