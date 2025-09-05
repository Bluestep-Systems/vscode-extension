import * as vscode from 'vscode';
import type {  ReadOnlyMap, SavableObject } from '../../../types';
import { PublicKeys, PublicPersistanceMap } from './util/data/PseudoMaps';
import ctrlPCommands from './ctrl-p-commands';
import { SESSION_MANAGER } from './b6p_session/SessionManager';
import { ContextNode } from './context/ContextNode';
import { Auth } from './authentication';


export const App = new class extends ContextNode {
  #_context: vscode.ExtensionContext | null = null;
  #_settings: PublicPersistanceMap<SavableObject> | null = null;
  #_outputChannel: vscode.LogOutputChannel | null = null;
  parent: ContextNode | null = null;
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
        console.log("STATE", App.settings.toJSON());
        App.logger.info("STATE", App.settings.toJSON());
      })],
      ['bsjs-push-pull.clear', vscode.commands.registerCommand('bsjs-push-pull.clear', async () => {
        App.clearPersistance();
      })]
    ]);
    constructor() { }
    forEach(callback: (disposable: vscode.Disposable, key: string, map: ReadOnlyMap<vscode.Disposable>) => void) {
      this.#map.forEach(callback);
    }
    get(key: string): vscode.Disposable | undefined {
      return this.#map.get(key);
    }
    has(key: string): boolean {
      return this.#map.has(key);
    }
  }();

  public isInitialized(): boolean {
    return this.#_context !== null;
  }

  public get context(): vscode.ExtensionContext {
    if (!this.isInitialized()) {
      throw new Error('Extension context is not set');
    }
    return this.#_context!;
  }

  protected persistence() {
    return this.settings;
  }

  public get settings() {
    if (this.#_settings === null) {
      throw new Error('Settings map is not set');
    }
    return this.#_settings!;
  }

  public get logger() {
    if (this.#_outputChannel === null) {
      throw new Error('Output channel is not set');
    }
    return this.#_outputChannel;
  }

  public init(context: vscode.ExtensionContext) {
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
    this.#_settings = new PublicPersistanceMap(PublicKeys.SETTINGS, App.context);
    SESSION_MANAGER.init(this);
    return this;
  }

  public clearPersistance() {
    this.settings.clear();
    SESSION_MANAGER.clearPersistance();
    Auth.clearManagers();
    App.logger.info("Cleared all settings and auth managers");
  }
}();
