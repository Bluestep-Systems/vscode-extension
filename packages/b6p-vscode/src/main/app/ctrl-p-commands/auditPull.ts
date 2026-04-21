import * as vscode from 'vscode';
import type { B6PCore } from '@bluestep-systems/b6p-core';

/**
 * Audits the current script for differences against the server using B6PCore,
 * then prompts the user to pull if changes are detected.
 */
export default async function (core: B6PCore): Promise<void> {
  try {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;

    if (!workspaceUri || !activeEditorUri) {
      core.prompt.error('No workspace or active file');
      return;
    }

    // Use B6PCore for auditPull (includes confirmation prompt)
    await core.auditPull({
      filePath: activeEditorUri.fsPath,
      workspacePath: workspaceUri.fsPath,
    });

    // Success message shown by B6PCore
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    core.prompt.error(`Error during audit-pull: ${message}`);
    core.logger.error('Audit-pull error:', e);
  }
}
