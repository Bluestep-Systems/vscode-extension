import * as vscode from 'vscode';
import type { ReadOnlyMap, SavableObject } from '../../../../types';
import { User } from './UserManager';
import { SavableMap } from './SavableMap';
import { pullScript, pushScript, updateCredentials } from '../ctrl-p-commands';


class StateManager {
  #_context: vscode.ExtensionContext | null;
  #_usermanager = User;
  static #_singleton = new StateManager();
  #_variables: SavableMap<SavableObject> | null;
  #_privates: SavableMap<SavableObject> | null;

  /**
   * a read-only map interceptor for command registrations
   */
  disposables = new class implements ReadOnlyMap<vscode.Disposable> {

    #map = new Map<string, vscode.Disposable>([
      ['bsjs-push-pull.pushScript', vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript)],
      ['bsjs-push-pull.pullScript', vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript)],
      ['bsjs-push-pull.updateCredentials', vscode.commands.registerCommand('bsjs-push-pull.updateCredentials', updateCredentials)],
      ['bsjs-push-pull.report', vscode.commands.registerCommand('bsjs-push-pull.report', async () => {
        console.log("STATE", State.variables.toJSON(), "PRIVATES", State.privates.toJSON());
        State.saveState();
      })],
      ['bsjs-push-pull.clear', vscode.commands.registerCommand('bsjs-push-pull.clear', async () => {
        State.variables.clear();
        State.privates.clear();
        State.saveState();
      })]
    ]);
    constructor() { }
    forEach(callback: (disposable: vscode.Disposable, key?: string) => void) {
      this.#map.forEach(callback);
    }
    get(key: string): vscode.Disposable | undefined {
      return this.#map.get(key);
    }
    has(key: string): boolean {
      return this.#map.has(key);
    }
  }();

  private constructor() {
    this.#_context = null;
    this.#_variables = null;
    this.#_privates = null;
  }

  static getSingleton(): StateManager {
    return this.#_singleton;
  }

  public isInitialized(): boolean {
    return this.#_context !== null;
  }

  public get context(): vscode.ExtensionContext {
    if (!this.isInitialized()) {
      throw new Error('Extension context is not set');
    }
    return this.#_context!;
  }

  public get variables(): SavableMap<SavableObject> {
    if (this.#_variables === null) {
      throw new Error('Variables map is not set');
    }
    return this.#_variables!;
  }

  public get privates(): SavableMap<SavableObject> {
    if (this.#_privates === null) {
      throw new Error('Privates map is not set');
    }
    return this.#_privates!;
  }

  public initializeFromContext(context: vscode.ExtensionContext) {
    if (this.#_context !== null) {
      throw new Error('Extension context is already set');
    }
    // for some reason we can't perform the truncated version of this. I.E.
    // `.forEach(context.subscriptions.push)`
    this.disposables.forEach(disposable => context.subscriptions.push(disposable));
    this.#_context = context;
    this.#_variables = new SavableMap(context.workspaceState.get('variables', undefined));
    context.secrets.get('privates').then(jsonString => {
      this.#_privates = new SavableMap(jsonString ? JSON.parse(jsonString) : undefined);
      console.log("Privates:", State.privates.toJSON());
    });
  }

  public get User(): typeof User {
    return this.#_usermanager;
  }

  public async saveState() {
    this.context.workspaceState.update('variables', this.variables.toSavableObject());
    this.context.secrets.store('privates', this.privates.toJSON());
  }
}

export const State = StateManager.getSingleton();
