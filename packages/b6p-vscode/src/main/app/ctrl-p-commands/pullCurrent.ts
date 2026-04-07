import * as vscode from 'vscode';
import { App } from '../App';

/**
 * Pulls the current script (derived from active editor) using B6PCore.
 */
export default async function (): Promise<void> {
  try {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;

    if (!workspaceUri || !activeEditorUri) {
      App.core.prompt.error('No workspace or active file');
      return;
    }

    // Use B6PCore for pullCurrent
    await App.core.pullCurrent({
      filePath: activeEditorUri.fsPath,
      workspacePath: workspaceUri.fsPath,
    });

    // Success message shown by B6PCore
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    App.core.prompt.error(`Error pulling current file: ${message}`);
    App.logger.error('Pull current file error:', e);
    throw e;
  }
}