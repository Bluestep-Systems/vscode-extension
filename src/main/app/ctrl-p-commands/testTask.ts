import * as vscode from 'vscode';
import { getActiveEditorUri } from '../util/data/getActiveEditorUri';
import { App } from '../App';

/**
 * A test task for development. be sure to remove it before production.
 */
export default async function () {
  vscode.window.showInformationMessage('Test Task toggled!');
  const activeEditorUri = getActiveEditorUri() || (() => { throw new Error("No active editor URI"); })();
  const fsStat =  await vscode.workspace.fs.stat(activeEditorUri);
  const s = App.context.workspaceState.update('testTaskLastRun', new Date().toISOString());
  console.log("fsStat", fsStat,s);
}