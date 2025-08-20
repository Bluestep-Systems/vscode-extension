import * as vscode from 'vscode';
import { pullScript, pushScript } from './ctrl-p-commands';


export const State = new class {
  #context: vscode.ExtensionContext | null;
  #vars: Map<string, any> = new Map<string, any>();

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  #disposables: vscode.Disposable[] = [
    vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript),
    vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript),
  ];
  constructor() {
    this.#context = null;
  }

  get context(): vscode.ExtensionContext {
    if (this.#context === null) {
      throw new Error('Extension context is not set');
    }
    return this.#context;
  }

  set context(context: vscode.ExtensionContext) {
    if (this.#context !== null) {
      throw new Error('Extension context is already set');
    }
    this.#context = context;
    this.#disposables.forEach(disposable => context.subscriptions.push(disposable));
  }
}();

