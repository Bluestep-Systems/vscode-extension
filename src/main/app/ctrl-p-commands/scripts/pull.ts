import * as vscode from 'vscode';
import { State } from "../../../app/util/StateManager";
/**
 * TODO
 */
export default function (): void {
  State.User.creds.then(creds => {
    vscode.window.showInformationMessage(JSON.stringify(creds, null, 2));
  });
}


function workspaceModifier(): void {
  const wsedit = new vscode.WorkspaceEdit();
  const file_path = vscode.Uri.file('/path/to/file');
}