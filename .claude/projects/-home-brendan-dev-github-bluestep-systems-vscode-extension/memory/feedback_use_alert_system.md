---
name: Use Alert utility for user messages
description: Use Alert.info/Alert.error instead of vscode.window.showErrorMessage directly
type: feedback
---

Use the Alert utility (Alert.error, Alert.info) instead of calling vscode.window.showErrorMessage directly.

**Why:** Project has a centralized Alert system for user-facing messages.
**How to apply:** When writing command handlers in this extension, import and use `Alert` from `../util/ui/Alert` for all user-facing messages.
