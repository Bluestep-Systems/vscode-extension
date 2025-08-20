import * as vscode from 'vscode';
import { pullScript, pushScript, updateCredentials } from './ctrl-p-commands';
import {UserManager, UserManagerInterface} from './usermanager';


export const State = new class {
  #context: vscode.ExtensionContext | null;
  #usermanager: UserManagerInterface = UserManager;
  // The command must be defined in the package.json file
  // The commandId parameter must match the command field in package.json
  #disposables: vscode.Disposable[] = [
    vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript),
    vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript),
    vscode.commands.registerCommand('bsjs-push-pull.updateCredentials', updateCredentials),
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

  get User(): UserManagerInterface {
    return this.#usermanager;
  }
  set User(_user: any) {
    throw new Error("User property is read-only");
  }
}();

