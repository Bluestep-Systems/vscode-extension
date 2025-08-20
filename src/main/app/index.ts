import * as vscode from 'vscode';
import { pullScript, pushScript, updateCredentials } from './ctrl-p-commands';
import { UserManager } from './usermanager';

export const State = new class {
  #context: vscode.ExtensionContext | null;
  #usermanager: UserManager = UserManager;

  /**
   * a map interceptor for command registrations
   */
  disposables = new class {
    #map = new Map<string, vscode.Disposable>([
      ['bsjs-push-pull.pushScript', vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript)],
      ['bsjs-push-pull.pullScript', vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript)],
      ['bsjs-push-pull.updateCredentials', vscode.commands.registerCommand('bsjs-push-pull.updateCredentials', updateCredentials)]
    ]);
    constructor() { }
    forEach(callback: (disposable: vscode.Disposable) => void) {
      this.#map.forEach(callback);
    }
    get(key: string): vscode.Disposable | undefined {
      return this.#map.get(key);
    }
    has(key: string): boolean {
      return this.#map.has(key);
    }
    set(..._args: any[]): void {
      throw new Error('Map is read-only');
    }
  }();

  constructor() {
    this.#context = null;
  }

  #RequireContext() {
    if (this.#context === null) {
      throw new Error('Extension context is not set');
    }
    return this.#context;
  }

  public get context(): vscode.ExtensionContext {
    return this.#RequireContext();
  }

  public initializeFromContext(context: vscode.ExtensionContext) {
    if (this.#context !== null) {
      throw new Error('Extension context is already set');
    }
    // for some reason we can't perform the truncated version of this. I.E.
    // `.forEach(context.subscriptions.push)`
    this.disposables.forEach(disposable => context.subscriptions.push(disposable));
    this.#context = context;
  }

  public get User(): UserManager {
    return this.#usermanager;
  }

}();
