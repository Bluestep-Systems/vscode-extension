import * as vscode from 'vscode';
import type { ReadOnlyMap, SavableObject, VSCodeSerializable } from '../../../../types';
import { User } from './UserManager';
import { pullScript, pushScript, updateCredentials } from '../ctrl-p-commands';

// NOTE: this class declaration must be done BEFORE StateManager
export class SavableMap extends Map<string, SavableObject> {
  constructor(entries?: readonly (readonly [string, SavableObject])[] | null) {
    super(entries);
  }
}
class StateManager {
  #_context: vscode.ExtensionContext | null;
  #_usermanager = User;
  static #_singleton = new StateManager();
  variables = new SavableMap();

  /**
   * a read-only map interceptor for command registrations
   */
  disposables = new class implements ReadOnlyMap<vscode.Disposable> {

    #map = new Map<string, vscode.Disposable>([
      ['bsjs-push-pull.pushScript', vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript)],
      ['bsjs-push-pull.pullScript', vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript)],
      ['bsjs-push-pull.updateCredentials', vscode.commands.registerCommand('bsjs-push-pull.updateCredentials', updateCredentials)]
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
  }

  static getSingleton(): StateManager {
    return this.#_singleton;
  }

  public get context(): vscode.ExtensionContext {
    if (this.#_context === null) {
      throw new Error('Extension context is not set');
    }
    return this.#_context;
  }

  public initializeFromContext(context: vscode.ExtensionContext) {
    if (this.#_context !== null) {
      throw new Error('Extension context is already set');
    }
    // for some reason we can't perform the truncated version of this. I.E.
    // `.forEach(context.subscriptions.push)`
    this.disposables.forEach(disposable => context.subscriptions.push(disposable));
    this.#_context = context;
  }

  public get User(): typeof User {
    return this.#_usermanager;
  }

  public saveState() {
    this.variables;
    this.context.workspaceState.update('variables', mapToObj(this.variables));
    function mapToObj(map: SavableMap): VSCodeSerializable {
      const obj = Object.fromEntries(map);
      for (const [key, value] of Object.entries(obj)) {
        if (value instanceof Map) {
          obj[key] = mapToObj(value);
        }
      }
      return obj;
    }
  }
}

export const State = StateManager.getSingleton();
