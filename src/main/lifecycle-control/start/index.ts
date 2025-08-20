import * as vscode from 'vscode';
import { b6p_disposables, State } from '../../app';


export default function (context: vscode.ExtensionContext) {
  b6p_disposables
    .forEach(disposable => context.subscriptions.push(disposable));
  State.context = context;
}

