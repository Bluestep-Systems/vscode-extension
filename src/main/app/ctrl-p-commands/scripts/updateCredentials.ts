import * as vscode from 'vscode';
import { State } from "../../../app/util/StateManager";

export default async function (): Promise<void> {
  const creds = await State.User.creds;
  vscode.window.showInformationMessage("Current Credentials: " + JSON.stringify(creds, null, 2));
  const oldUsername = creds.username;
  const oldPassword = creds.password;
  const newUsername = await vscode.window.showInputBox({ prompt: 'Enter new username' , placeHolder: oldUsername + " (Enter to Keep)"});
  if (typeof newUsername === 'string') {
    if (newUsername !== "") {
      creds.username = newUsername;
    } 
  } else {
    vscode.window.showErrorMessage('Invalid username');
    return;
  }
  const newPassword = await vscode.window.showInputBox({ prompt: 'Enter new password', placeHolder: oldPassword + " (Enter to Keep)" });
  if (typeof newPassword === 'string') {
    if (newPassword !== "") {
      creds.password = newPassword;
    }
  } else {
    vscode.window.showErrorMessage('Invalid password');
    return;
  }
  if (creds.username === oldUsername && creds.password === oldPassword) {
    vscode.window.showInformationMessage("No changes made to credentials.");
  } else {
    vscode.window.showInformationMessage("Credentials updated to: " + JSON.stringify(creds, null, 2));
  }
}