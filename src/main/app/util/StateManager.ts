import * as vscode from 'vscode';
import type { ReadOnlyMap, SavableObject } from '../../../../types';
import { PrivateKeys, PrivatePersistanceMap, PublicPersistanceMap, TransientMap } from './PersistantMap';
import { pullScript, pushScript, updateCredentials } from '../ctrl-p-commands';


export const State = new class {
  #_context: vscode.ExtensionContext | null;
  #_variables: PublicPersistanceMap<SavableObject> | null = null;
  #_privates: Record<string, PrivatePersistanceMap<SavableObject>> = {};

  /**
   * a read-only map interceptor for command registrations
   */
  disposables = new class implements ReadOnlyMap<vscode.Disposable> {

    #map = new Map<string, vscode.Disposable>([
      ['bsjs-push-pull.pushScript', vscode.commands.registerCommand('bsjs-push-pull.pushScript', pushScript)],
      ['bsjs-push-pull.pullScript', vscode.commands.registerCommand('bsjs-push-pull.pullScript', pullScript)],
      ['bsjs-push-pull.updateCredentials', vscode.commands.registerCommand('bsjs-push-pull.updateCredentials', updateCredentials)],
      ['bsjs-push-pull.report', vscode.commands.registerCommand('bsjs-push-pull.report', async () => {
        console.log("STATE", State.variables.toJSON(), "PRIVATES", State.privates);
        State.saveState();
      })],
      ['bsjs-push-pull.clear', vscode.commands.registerCommand('bsjs-push-pull.clear', async () => {
        State.variables.clear();
        State.privates = {};
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

  constructor() {
    this.#_context = null;
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

  public get variables() {
    if (this.#_variables === null) {
      throw new Error('Variables map is not set');
    }
    return this.#_variables!;
  }

  public get privates() {
    if (this.#_privates === null) {
      throw new Error('Privates map is not set');
    }
    return this.#_privates!;
  }
  private set privates(value: Record<string, PrivatePersistanceMap<SavableObject>>) {
    this.#_privates = value;
  }

  public initializeFromContext(context: vscode.ExtensionContext) {
    if (this.#_context !== null) {
      throw new Error('Extension context is already set');
    }
    // for some reason we can't perform the truncated version of this. I.E.
    // `.forEach(context.subscriptions.push)`
    this.#_context = context;
    this.disposables.forEach(disposable => context.subscriptions.push(disposable));

    this.#_variables = new PublicPersistanceMap("variables");
    context.secrets.get('privates').then(csl => {
      csl?.split(",").forEach(key => {
        this.#_privates[key] = new PrivatePersistanceMap(key as PrivateKeys);
      });
    });
  }



  public async saveState() {
    this.context.workspaceState.update('variables', this.variables);
    this.context.secrets.store('privates', Object.keys(this.privates).join(","));
  }
}();

