import * as vscode from 'vscode';
import { RemoteScriptFile } from '../util/script/RemoteScriptFile';
import pullScript from './pull';
export default async function (): Promise<void> {
  try {
    const workspaceUri = vscode.workspace.workspaceFolders![0]!.uri;
    const activeEditorUri = vscode.window.activeTextEditor!.document.uri;
    if (workspaceUri === undefined) {
      vscode.window.showErrorMessage('No source path provided');
      return;
    }
    const fileMetaData = new RemoteScriptFile({ downstairsUri: activeEditorUri });
    await pullScript(fileMetaData.getScriptRoot().toBaseUpstairsString());
  } catch (e) {
    if (e instanceof Error) {
      vscode.window.showErrorMessage(`Error pulling current file: ${e.message}`);
      console.error('Pull current file error:', e.stack || e.message || e);
    } else {
      vscode.window.showErrorMessage(`Error pulling current file: ${e}`);
      console.error('Pull current file error:', e);
    }
    throw e;
  }
}