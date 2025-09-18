import * as vscode from 'vscode';
import { Settings, type ReadOnlyMap } from '../../../types';
import { Auth } from './authentication';
import { SESSION_MANAGER as SM } from './b6p_session/SessionManager';
import { ContextNode } from './context/ContextNode';
import ctrlPCommands from './ctrl-p-commands';
import readOnlyCheck from './services/ReadOnlyChecker';
import { UPDATE_MANAGER as UM } from './services/UpdateChecker';
import { SettingsMap } from './util/data/PseudoMaps';
import { Alert } from './util/ui/Alert';



export const App = new class extends ContextNode {
  #_context: vscode.ExtensionContext | null = null;
  #_settings: SettingsMap | null = null;
  #_outputChannel: vscode.LogOutputChannel | null = null;
  #debugMode: boolean = false;
  public readonly appKey = "bsjs-push-pull";
  parent: ContextNode | null = null;

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
      ['bsjs-push-pull.testTask', vscode.commands.registerCommand('bsjs-push-pull.testTask', ctrlPCommands.testTask)],
      ['bsjs-push-pull.report', vscode.commands.registerCommand('bsjs-push-pull.report', async () => {
        //Alert.info("Settings: " + App.settings.toJSON(), { modal: false });
        Alert.info("NOT IMPLEMENTED YET", { modal: false });
      })],
      ['bsjs-push-pull.clearSettings', vscode.commands.registerCommand('bsjs-push-pull.clearSettings', async () => {
        Alert.info("Reverting to default settings", { modal: false });
        App.clearMap();
      })],
      ['bsjs-push-pull.clearSessions', vscode.commands.registerCommand('bsjs-push-pull.clearSessions', async () => {
        Alert.info("Clearing all Sessions", { modal: false });
        SM.clearMap();
      })],
      ['bsjs-push-pull.clearAll', vscode.commands.registerCommand('bsjs-push-pull.clearAll', async () => {
        Alert.info("Clearing Sessions, Auth Managers, and Settings", { modal: false });
        App.clearMap(true);
        SM.clearMap();
        Auth.clearManagers();
      })],
      ['bsjs-push-pull.toggleDebug', vscode.commands.registerCommand('bsjs-push-pull.toggleDebug', async () => {
        App.toggleDebugMode();
      })]
    ]);
    constructor() { }
    forEach(callback: (disposable: vscode.Disposable, key: string, map: this) => void) {
      this.#map.forEach((disposable, key) => callback(disposable, key, this));
    }
    get(key: string): vscode.Disposable | undefined {
      return this.#map.get(key);
    }
    has(key: string): boolean {
      return this.#map.has(key);
    }
  }();

  /**
   * //TODO remove if unneccessary
   * 
   * Checks if the app is initialized
   * @returns true if the app is initialized, false otherwise.
   */
  public isInitialized(): boolean {
    return this.#_context !== null;
  }

  public get context(): vscode.ExtensionContext {
    if (!this.isInitialized()) {
      throw new Error('Extension context is not set');
    }
    return this.#_context!;
  }

  protected map() {
    return this.settings;
  }

  public get settings() {
    if (this.#_settings === null) {
      throw new Error('Settings map is not set');
    }
    return this.#_settings!;
  }

  /**
   * the output channel for logging. logs to a channel named "B6P" in the vscode output pane.
   */
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
    this.#_settings = new SettingsMap(vscode.workspace.getConfiguration().get<Settings>(this.appKey));
    console.log(this.settings.toJSON());
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        readOnlyCheck();
      } else {
        //TODO figure out why this is triggering multiple times
        // console.log('No active editor.');
      }
    }, this, this.context.subscriptions);
    this.#debugMode = this.settings.get('isDebugMode') as boolean ?? false;
    vscode.commands.executeCommand('setContext', 'bsjs-push-pull.isDebugMode', this.#debugMode);
    readOnlyCheck(); // run it once on startup

    // Initialize dependancies
    SM.init(this);
    UM.init(this);

    return this;
  }

  public clearMap(alreadyAlerted: boolean = false) {
    this.settings.clear();
    !alreadyAlerted && Alert.info("Cleared all Settings", { modal: false });
    this.#debugMode = false;
    vscode.commands.executeCommand('setContext', 'bsjs-push-pull.isDebugMode', this.#debugMode);
  }

  public isDebugMode() {
    return this.#debugMode;
  }

  public toggleDebugMode() {
    this.#debugMode = !this.#debugMode;
    vscode.commands.executeCommand('setContext', 'bsjs-push-pull.isDebugMode', this.#debugMode);
    Alert.info(`Debug mode ${this.#debugMode ? "enabled" : "disabled"}`, { modal: false });
    this.settings.set('isDebugMode', this.#debugMode);
  }
}();
