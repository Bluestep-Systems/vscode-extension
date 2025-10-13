import * as vscode from 'vscode';
import { App } from '../App';
export default async function () {
  vscode.commands.executeCommand('workbench.action.openSettings', App.appKey);
}