import * as vscode from 'vscode';
import { b6p_disposables } from '../../shared';


export function attachCommands(context: vscode.ExtensionContext) {
  b6p_disposables
    .forEach(disposable => context.subscriptions.push(disposable));
}

