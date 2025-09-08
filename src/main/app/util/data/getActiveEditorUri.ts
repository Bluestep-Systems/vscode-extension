import * as vscode from 'vscode';

/**
 * Gets the URI of the active editor; performing basic checks to ensure it is valid.
 * @returns The URI of the active editor, or undefined if not available. NOTE: it
 * will also inform the user via vscode notifications if there is an issue.
 */
export function getActiveEditorUri(): vscode.Uri | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return void 0;
  }
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showErrorMessage('No active text editor found.');
    return void 0;
  }
  const workspaceUri = workspaceFolders[0].uri;
  const activeEditorUri = activeEditor.document.uri;
  if (!activeEditorUri.path.startsWith(workspaceUri.path)) {
    vscode.window.showWarningMessage('Active file is not in the current workspace');
    return void 0;
  }
  return activeEditorUri;
}