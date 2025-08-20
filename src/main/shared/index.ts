import * as vscode from 'vscode';
import { pullScript, pushScript } from '../ctrl-p-commands';

// The command has been defined in the package.json file
// Now provide the implementation of the command with registerCommand
// The commandId parameter must match the command field in package.json
export const b6p_disposables: vscode.Disposable[] = [
  vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript),
  vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript),
];

export const State = new class {
  #context: vscode.ExtensionContext | null;

  constructor() {
    this.#context = null;
  }

  public getContext(): vscode.ExtensionContext {
    if (this.#context === null) {
      throw new Error('Extension context is not set');
    }
    return this.#context;
  }
  setContext(context: vscode.ExtensionContext) {
    if (this.#context !== null) {
      throw new Error('Extension context is already set');
    }
    this.#context = context;
  }
}();