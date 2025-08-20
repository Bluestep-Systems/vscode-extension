import * as vscode from 'vscode';
import { State } from '../..';
/**
 * TODO
 */
export default function (): void {
  State.User.creds.then(creds => {
    vscode.window.showInformationMessage(JSON.stringify(creds, null, 2));
  });

}