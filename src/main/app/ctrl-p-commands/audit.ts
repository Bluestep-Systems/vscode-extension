import * as vscode from 'vscode';
import { App } from '../App';
import { Util } from '../util/';
import { ScriptUrlParser } from '../util/data/ScriptUrlParser';
import { ScriptFactory } from '../util/script/ScriptFactory';
import { Alert } from '../util/ui/Alert';

export interface AuditResult {
  changedFiles: string[];
  baseUrl: string;
}

/**
 * Audits the current script for differences against the server and reports the results.
 * @returns The audit result with changed file list and base URL, or `null` if the audit could not run.
 */
export default async function (): Promise<AuditResult | null> {
  try {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    if (!workspaceUri) {
      vscode.window.showErrorMessage('No workspace folder open');
      return null;
    }
    if (!activeEditorUri) {
      vscode.window.showErrorMessage('No active editor');
      return null;
    }

    const scriptFile = ScriptFactory.createFile(activeEditorUri);
    const scriptRoot = scriptFile.getScriptRoot();
    const baseUrl = await scriptRoot.getBaseWebDavUrlString();

    const parser = new ScriptUrlParser(baseUrl);
    const fetchedScriptObject = await parser.getScript();
    if (!fetchedScriptObject) {
      App.logger.warn("fetchedScriptObject is null during audit");
      return null;
    }

    const activePath = Util.getActiveWorkspaceFolderUri();
    const U = await parser.getU();

    const changedFiles: string[] = [];
    for (const entry of fetchedScriptObject) {
      const ultimatePath = vscode.Uri.joinPath(activePath, U, entry.downstairsPath);
      if (ultimatePath.toString().endsWith("/")) {
        continue;
      }
      const sf = ScriptFactory.createFile(ultimatePath);
      if (!(await sf.exists())) {
        changedFiles.push(entry.downstairsPath + " (new)");
        continue;
      }
      if (!(await sf.currentIntegrityMatches())) {
        changedFiles.push(entry.downstairsPath);
      }
    }

    if (changedFiles.length === 0) {
      Alert.info("No differences detected. Local script is in sync with the server.");
    } else {
      Alert.info(`Detected ${changedFiles.length} file(s) with differences:\n\n${changedFiles.join("\n")}`);
    }

    return { changedFiles, baseUrl };
  } catch (e) {
    if (e instanceof Error) {
      vscode.window.showErrorMessage(`Error during audit: ${e.message}`);
      console.error('Audit error:', e.stack || e.message || e);
    } else {
      vscode.window.showErrorMessage(`Error during audit: ${e}`);
      console.error('Audit error:', e);
    }
    throw e;
  }
}
