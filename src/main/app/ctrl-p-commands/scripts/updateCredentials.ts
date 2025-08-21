import * as vscode from 'vscode';
import { State } from "../../../app/util/StateManager";

export default async function (): Promise<void> {
  const creds = await State.User.creds;
  const sto = creds.store.get('default')!;
  vscode.window.showInformationMessage("Current Credentials: " + JSON.stringify(sto, null, 2));
  const oldUsername = sto.username;
  const oldPassword = sto.password;
  const newUsername = await vscode.window.showInputBox({ prompt: 'Enter new username' , placeHolder: oldUsername + " (Enter to Keep)"});
  if (typeof newUsername === 'string') {
    if (newUsername !== "") {
      sto.username = newUsername;
    } 
  } else {
    vscode.window.showErrorMessage('Invalid username');
    return;
  }
  const newPassword = await vscode.window.showInputBox({ prompt: 'Enter new password', placeHolder: oldPassword + " (Enter to Keep)" });
  if (typeof newPassword === 'string') {
    if (newPassword !== "") {
      sto.password = newPassword;
    }
  } else {
    vscode.window.showErrorMessage('Invalid password');
    return;
  }
  if (sto.username === oldUsername && sto.password === oldPassword) {
    vscode.window.showInformationMessage("No changes made to credentials.");
  } else {
    vscode.window.showInformationMessage("Credentials updated to: " + JSON.stringify(sto, null, 2));
  }
  creds.store.set('default', sto);
  State.User.saveCreds();
}