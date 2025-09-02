import * as vscode from 'vscode';
import type {  ReadOnlyMap, SavableObject } from '../../../types';
import { PublicPersistanceMap } from './util/data/PseudoMaps';
import ctrlPCommands from './ctrl-p-commands';
import { BasicAuthManager } from './services/Auth';
import { SessionManager } from './services/SessionManager';


export const App = new class {
  #_context: vscode.ExtensionContext | null;
  #_variables: PublicPersistanceMap<SavableObject> | null = null;
  #_outputChannel: vscode.LogOutputChannel | null = null;
  placeHolder() {
    return this;
  }
  /**
   * a read-only map interceptor for command registrations
   */
  disposables = new class implements ReadOnlyMap<vscode.Disposable> {

    #map = new Map<string, vscode.Disposable>([
      ['bsjs-push-pull.pushScript', vscode.commands.registerCommand('bsjs-push-pull.pushScript', ctrlPCommands.pushScript)],
      ['bsjs-push-pull.pullScript', vscode.commands.registerCommand('bsjs-push-pull.pullScript', ctrlPCommands.pullScript)],
      ['bsjs-push-pull.pullCurrent', vscode.commands.registerCommand('bsjs-push-pull.pullCurrent', ctrlPCommands.pullCurrent)],
      ['bsjs-push-pull.pushCurrent', vscode.commands.registerCommand('bsjs-push-pull.pushCurrent', ctrlPCommands.pushCurrent)],
      ['bsjs-push-pull.updateCredentials', vscode.commands.registerCommand('bsjs-push-pull.updateCredentials', ctrlPCommands.updateCredentials)],
      ['bsjs-push-pull.runTask', vscode.commands.registerCommand('bsjs-push-pull.runTask', ctrlPCommands.runTask)],
      ['bsjs-push-pull.checkForUpdates', vscode.commands.registerCommand('bsjs-push-pull.checkForUpdates', ctrlPCommands.checkForUpdates)],
      ['bsjs-push-pull.notify', vscode.commands.registerCommand('bsjs-push-pull.notify', ctrlPCommands.notify)],
      ['bsjs-push-pull.quickDeploy', vscode.commands.registerCommand('bsjs-push-pull.quickDeploy', ctrlPCommands.quickDeploy)],
      ['bsjs-push-pull.report', vscode.commands.registerCommand('bsjs-push-pull.report', async () => {
        console.log("STATE", App.variables.toJSON());
        App.logger.info("STATE", App.variables.toJSON());
        App.saveState();
      })],
      ['bsjs-push-pull.clear', vscode.commands.registerCommand('bsjs-push-pull.clear', async () => {
        App.variables.clear();
        App.saveState();
        BasicAuthManager.getSingleton().persistanceCollection.clear();
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

  public get logger() {
    if (this.#_outputChannel === null) {
      throw new Error('Output channel is not set');
    }
    return this.#_outputChannel;
  }

  public initializeFromContext(context: vscode.ExtensionContext) {
    if (this.#_context !== null) {
      throw new Error('Extension context is already set');
    }
    this.#_context = context;
    // for some reason we can't perform the truncated version of this. I.E.
    // `.forEach(context.subscriptions.push)`
    this.disposables.forEach(disposable => this.context.subscriptions.push(disposable));
    this.#_outputChannel = vscode.window.createOutputChannel("B6P", {
      log: true,
    });
    this.context.subscriptions.push(this.#_outputChannel);
    this.#_variables = new PublicPersistanceMap("variables");
    BasicAuthManager.touch();
    SessionManager.init();
  }

  public async saveState() {
    this.variables.store();
  }
}();
