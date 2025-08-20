import * as vscode from 'vscode';
import { pullScript, pushScript } from '../ctrl-p-commands';
import State from "./state";

// The command has been defined in the package.json file
// Now provide the implementation of the command with registerCommand
// The commandId parameter must match the command field in package.json
export const b6p_disposables: vscode.Disposable[] = [
  vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript),
  vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript),
];

export { State };