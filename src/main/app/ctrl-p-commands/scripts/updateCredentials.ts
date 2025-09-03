import * as vscode from 'vscode';

import { BasicAuthManager } from '../../services/Auth';

/**
 * Updates the user credentials. As of right now this is only using Basic Auth, so we'll
 * need to retool this when another auth type is needed
 * @returns A promise that resolves when the update is complete.
 */
export default async function (): Promise<void> {
  
  try {
    const flag = BasicAuthManager.determineFlag();
    const firstTime = !BasicAuthManager.hasAuth(flag);
    const creds = await BasicAuthManager.getAuth(flag);
    if (firstTime) {
      return; // getAuth prompts for creds if they don't exist
      // so if we don't return here it would be redundant
    }
    const oldUsername = creds.username;
    const oldPassword = creds.password;
    const newUsername = await vscode.window.showInputBox({ prompt: 'Enter new username', placeHolder: oldUsername + " (Enter to Keep)" });

    if (typeof newUsername === 'undefined') {
      vscode.window.showErrorMessage('cancelled');
      return;
    } else {
      if (newUsername !== "") {
        creds.username = newUsername;
      }
    }
    const newPassword = await vscode.window.showInputBox({ prompt: 'Enter new password', placeHolder: "*** (Enter to Keep)", password: true });
    if (typeof newPassword === 'undefined') {
      vscode.window.showErrorMessage('cancelled');
      return;
    } else {
      if (newPassword !== "") {
        creds.password = newPassword;
      }
    }
    if (creds.username === oldUsername && creds.password === oldPassword) {
      vscode.window.showInformationMessage("No changes made to credentials.");
    } else {
      vscode.window.showInformationMessage("Credentials Updated!");
    }
    BasicAuthManager.setAuth(creds);
  } catch (error) {
    console.trace("Error getting user credentials:", error);
  }
}
