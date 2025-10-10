# BlueStep VS Code Extension Setup

Thank you for installing the BlueStep JavaScript Push/Pull extension!

## Important: Configure File Watcher Exclusions

To prevent VS Code from watching directories and hidden files created/managed by this extension, please add the following patterns to your workspace settings:

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

