import * as vscode from 'vscode';
import { State } from '../..';

export default async function (): Promise<void> {
  const creds = await State.User.creds;
  vscode.window.showInformationMessage("Current Credentials: " + JSON.stringify(creds, null, 2));
  const oldUsername = creds.username;
  const oldPassword = creds.password;
  const newUsername = await vscode.window.showInputBox({ prompt: 'Enter new username' , placeHolder: "Leave blank to keep existing username" });
  if (typeof newUsername === 'string') {
    if (newUsername !== "") {
      creds.username = newUsername;
    } 
  } else {
    vscode.window.showErrorMessage('Invalid username');
    return;
  }
  const newPassword = await vscode.window.showInputBox({ prompt: 'Enter new password', placeHolder: "Leave Blank to keep existing password" });
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