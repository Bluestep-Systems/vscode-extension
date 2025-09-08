import * as vscode from 'vscode';
import { ScriptFile } from '../../util/data/ScriptUtil';
import pullScript from '../scripts/pull';
export default async function (): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders![0]!.uri;
  const activeEditorUri = vscode.window.activeTextEditor!.document.uri;
  if (workspaceUri === undefined) {
    vscode.window.showErrorMessage('No source path provided');
    return;
  }
  const fileMetaData = new ScriptFile({ downstairsUri: activeEditorUri });
  await pullScript(fileMetaData.getScriptRoot().toBasePullPushUrlString());
}