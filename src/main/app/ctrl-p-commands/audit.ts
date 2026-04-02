import * as vscode from 'vscode';
import { App } from '../App';
import { Alert } from '../util/ui/Alert';

export interface AuditResult {
  changedFiles: string[];
  baseUrl: string;
}

/**
 * Audits the current script for differences against the server using B6PCore.
 * @returns The audit result with changed file list and base URL, or `null` if the audit could not run.
 */
export default async function (): Promise<AuditResult | null> {
  try {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;

    if (!workspaceUri) {
      Alert.error('No workspace folder open');
      return null;
    }
    if (!activeEditorUri) {
      Alert.error('No active editor');
      return null;
    }

    // Use B6PCore for audit
    const result = await App.core.audit({
      filePath: activeEditorUri.fsPath,
      workspacePath: workspaceUri.fsPath,
    });

    // Result is already shown by B6PCore's prompt provider
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Alert.error(`Error during audit: ${message}`);
    App.logger.error('Audit error:', e);
    throw e;
  }
}
