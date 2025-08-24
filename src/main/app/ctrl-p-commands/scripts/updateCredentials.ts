import * as vscode from 'vscode';
import { BasicAuthManager } from '../../util/Auth';
import {State as App} from "../../App";

export default async function (): Promise<void> {
  try {
    const creds = await App.BasicAuthManager.getAuth();
    const oldUsername = creds.username;
    const oldPassword = creds.password;
    const newUsername = await vscode.window.showInputBox({ prompt: 'Enter new username', placeHolder: oldUsername + " (Enter to Keep)" });
    if (typeof newUsername === 'string') {
      if (newUsername !== "") {
        creds.username = newUsername;
      }
    } else {
      vscode.window.showErrorMessage('Invalid username');
      return;
    }
    const newPassword = await vscode.window.showInputBox({ prompt: 'Enter new password', placeHolder: "*** (Enter to Keep)", password: true });
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
      vscode.window.showInformationMessage("Credentials Updated!");
    }
    BasicAuthManager.getSingleton().setAuth(creds);
  } catch (error) {
    console.trace("Error getting user credentials:", error);
  }

}