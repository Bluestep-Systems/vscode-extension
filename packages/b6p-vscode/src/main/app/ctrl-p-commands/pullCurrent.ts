import * as vscode from 'vscode';
import type { B6PCore } from '@bluestep-systems/b6p-core';

/**
 * Pulls the current script (derived from active editor) using B6PCore.
 */
export default async function (core: B6PCore): Promise<void> {
  try {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;

    if (!workspaceUri || !activeEditorUri) {
      core.prompt.error('No workspace or active file');
      return;
    }

    await core.pullCurrent({
      filePath: activeEditorUri.fsPath,
      workspacePath: workspaceUri.fsPath,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    core.prompt.error(`Error pulling current file: ${message}`);
    core.logger.error('Pull current file error:', e);
    throw e;
  }
}
