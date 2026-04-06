import * as vscode from 'vscode';
import { type ReadOnlyMap } from '../../../types';
import { BasicAuthProvider } from '../../core/auth/BasicAuthProvider';
import { SessionManager } from '../../core/session/SessionManager';
import { OutputChannels, SettingsKeys } from '../../core/constants';
import ctrlPCommands from './ctrl-p-commands';
import readOnlyCheck from './services/ReadOnlyChecker';
import { UpdateManager } from './services/UpdateManager';
import { SettingsWrapper } from './util/PseudoMaps';
import { Err } from '../../core/Err';
import { HttpClient } from '../../core/network/HttpClient';
import { Alert } from './util/ui/Alert';
import { OrgCache } from './cache/OrgCache';
import { ScriptMetaDataStore } from './cache/ScriptMetaDataStore';
import { McpServerProvider } from './mcp/McpServerProvider';
import { PULL_SCRIPT_TOOL } from './mcp/PullScriptTool';
import { DisposableRegistry } from './util/Disposable';
import { B6PCore } from '../../core/B6PCore';
import { ScriptFactory } from '../../core/script/ScriptFactory';
import { VscodeFileSystem, VscodePersistence, VscodePrompt, VscodeLogger, VscodeProgress } from '../providers';
import { migrateLegacyMetadataFiles } from './cache/ScriptMetaDataStore';


export const App = new class {
  private _context: vscode.ExtensionContext | null = null;
  private _persistence: VscodePersistence | null = null;
  private _settings: SettingsWrapper | null = null;
  private _outputChannel: vscode.LogOutputChannel | null = null;
  private _core: B6PCore | null = null;
  public readonly appKey = SettingsKeys.APP_KEY;

  // Manager instances (those still owned by App; the rest live on B6PCore)
  private _updateManager: UpdateManager | null = null;
  private _mcpServerProvider: McpServerProvider | null = null;

  private readonly _disposables = new DisposableRegistry();

  /**
   * a read-only map interceptor for command registrations.
   * Commands reference App instance properties that are populated during init().
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
      ['bsjs-push-pull.snapshot', vscode.commands.registerCommand('bsjs-push-pull.snapshot', ctrlPCommands.snapshot)],
      ['bsjs-push-pull.report', vscode.commands.registerCommand('bsjs-push-pull.report', async () => {
        const entries = App.scriptMetadataStore.all();
        const summary = entries.length === 0
          ? "No script metadata entries stored."
          : entries.map(e => `${e.U}/${e.scriptName} (webdavId: ${e.webdavId}, records: ${e.pushPullRecords.length}, classid: ${e.scriptKey.classid}, seqnum: ${e.scriptKey.seqnum})`).join("\n");
        App.logger.info("=== Script Metadata Store ===\n" + summary);

        const orgEntries = [...App.orgCache.map()];
        const orgSummary = orgEntries.length === 0
          ? "No org cache entries."
          : orgEntries.map(([u, elements]) => `${u}: ${elements.map(e => `${e.host} (lastAccess: ${new Date(e.lastAccess).toISOString()})`).join(", ")}`).join("\n");
        App.logger.info("=== Org Cache ===\n" + orgSummary);

        Alert.info(`${entries.length} metadata ${entries.length === 1 ? "entry" : "entries"}, ${orgEntries.length} org cache ${orgEntries.length === 1 ? "entry" : "entries"} stored. See output channel for details.`);
      })],
      ['bsjs-push-pull.clearSettings', vscode.commands.registerCommand('bsjs-push-pull.clearSettings', async () => {
        Alert.info("Reverting to default settings");
        App.clearMap();
      })],
      ['bsjs-push-pull.clearSessions', vscode.commands.registerCommand('bsjs-push-pull.clearSessions', async () => {
        Alert.info("Clearing all Sessions");
        App.orgCache.clearCache();
      })],
      ['bsjs-push-pull.clearAll', vscode.commands.registerCommand('bsjs-push-pull.clearAll', async () => {
        Alert.info("Clearing Sessions, Auth Managers, and Settings");
        App.clearMap(true);
        App.orgCache.clearCache();
        App.authManager.clear();
      })],
      ['bsjs-push-pull.toggleAdvanced', vscode.commands.registerCommand('bsjs-push-pull.toggleAdvanced', async () => {
        App.toggleAdvancedMode();
      })],
      ['bsjs-push-pull.toggleDebug', vscode.commands.registerCommand('bsjs-push-pull.toggleDebug', async () => {
        App.toggleDebugMode();
      })],
      ['bsjs-push-pull.openSettings', vscode.commands.registerCommand('bsjs-push-pull.openSettings', async () => {
        vscode.commands.executeCommand('workbench.action.openSettings', "@ext:bluestep-systems.bsjs-push-pull");
      })],
      ['bsjs-push-pull.audit', vscode.commands.registerCommand('bsjs-push-pull.audit', ctrlPCommands.audit)],
      ['bsjs-push-pull.auditPull', vscode.commands.registerCommand('bsjs-push-pull.auditPull', ctrlPCommands.auditPull)],
      ['bsjs-push-pull.goToSetup', vscode.commands.registerCommand('bsjs-push-pull.goToSetup', ctrlPCommands.goToSetup)],
      ['bsjs-push-pull.browseScriptRoot', vscode.commands.registerCommand('bsjs-push-pull.browseScriptRoot', async () => {
        const result = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Select Script Root Folder',
        });
        if (result && result[0]) {
          await vscode.workspace.getConfiguration('bsjs-push-pull').update('scriptRoot.path', result[0].fsPath, vscode.ConfigurationTarget.Global);
          Alert.info(`Script root set to: ${result[0].fsPath}`);
        }
      })]
    ]);
    constructor() {}
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

  public isInitialized(): boolean {
    return this._context !== null;
  }

  public get context(): vscode.ExtensionContext {
    if (!this.isInitialized()) {
      throw new Err.ContextNotSetError('Extension context');
    }
    return this._context!;
  }

  get persistence(): VscodePersistence {
    if (this._persistence === null) {
      throw new Err.ContextNotSetError('Persistence');
    }
    return this._persistence;
  }

  public get settings() {
    if (this._settings === null) {
      throw new Err.ContextNotSetError('Settings map');
    }
    return this._settings!;
  }

  public get logger() {
    if (this._outputChannel === null) {
      throw new Err.ContextNotSetError('Output channel');
    }
    return this._outputChannel;
  }

  public get core() {
    if (this._core === null) {
      throw new Err.ContextNotSetError('B6PCore');
    }
    return this._core;
  }

  // Manager accessors — delegate to B6PCore so there's a single instance per service.
  public get sessionManager(): SessionManager {
    return this.core.session;
  }

  public get orgCache(): OrgCache {
    return this.core.orgCache;
  }

  public get authManager(): BasicAuthProvider {
    return this.core.auth;
  }

  public get scriptMetadataStore(): ScriptMetaDataStore {
    return this.core.scriptMetadataStore;
  }

  public get updateManager(): UpdateManager {
    if (!this._updateManager) {
      throw new Err.ManagerNotInitializedError('UpdateManager');
    }
    return this._updateManager;
  }

  public init(context: vscode.ExtensionContext) {
    if (this._context !== null) {
      throw new Err.ContextAlreadySetError('Extension context');
    }
    this._context = context;
    this._persistence = new VscodePersistence(this._context);

    this.disposables.forEach(disposable => this.context.subscriptions.push(disposable));
    this._outputChannel = vscode.window.createOutputChannel(OutputChannels.B6P, {
      log: true,
    });
    this.context.subscriptions.push(this._outputChannel);
    this._settings = new SettingsWrapper();

    // Initialize B6PCore with VSCode providers (shares the same persistence instance)
    this._core = new B6PCore({
      fs: new VscodeFileSystem(),
      persistence: this._persistence,
      prompt: new VscodePrompt(),
      logger: new VscodeLogger(this._outputChannel),
      progress: new VscodeProgress(),
      isDebugMode: () => this.isDebugMode(),
      orgCacheSettings: this._settings,
      fetchFn: (url, options) => HttpClient.getInstance().fetch(url, options),
    });

    // Wire the script factory's default context to B6PCore so that the
    // ScriptFactory.* static helpers (used by older callers and tests) work.
    ScriptFactory.setDefaultContext(this._core);

    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        readOnlyCheck();
      }
    }, this, this.context.subscriptions);

    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(App.appKey)) {
        this.isDebugMode() && console.log("Configuration changed, updating settings map");
        this.settings.sync();
      }
    });
    this.settings.sync();
    readOnlyCheck();

    // Register URI handler
    this.context.subscriptions.push(vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        if (uri.path === '/pull') {
          const params = new URLSearchParams(uri.query);
          const formulaUrl = params.get('url');
          if (formulaUrl) {
            ctrlPCommands.pullScript(formulaUrl);
          } else {
            Alert.error('Missing "url" parameter in URI');
          }
        } else if (uri.path === '/audit-pull') {
          ctrlPCommands.auditPull();
        }
      }
    }));

    // ---- Wire up additional services on top of B6PCore ----

    const vscodeLogger: VscodeLogger = new VscodeLogger(this._outputChannel);
    this._disposables.add(this._core);

    // MCP server provider (depends on orgCache, auth, logger, context)
    this._mcpServerProvider = new McpServerProvider(
      this._core.orgCache,
      this._core.auth,
      vscodeLogger,
      context
    );
    this._disposables.add(this._mcpServerProvider);

    // Wire up cross-cutting events
    //    - SessionManager notifies OrgCache on login
    this._core.session.onLogin = (url: URL) => {
      this._core!.orgCache.findU(url).catch((e: unknown) => {
        this.logger.warn('Failed to cache org during login:', e instanceof Error ? e.message : String(e));
      });
    };
    //    - OrgCache notifies McpServerProvider on changes
    this._core.orgCache.onChanged = () => {
      this._mcpServerProvider!.fireChanged();
    };

    // Migrate any legacy `.b6p_metadata.json` files into the persistent store.
    void migrateLegacyMetadataFiles(this._core.scriptMetadataStore);

    // Update manager
    this._updateManager = new UpdateManager(
      this._persistence,
      vscodeLogger,
      this._settings,
      this.getVersion(),
      context.extensionUri,
      context.globalStorageUri,
      this.appKey
    );
    this._disposables.add(this._updateManager);

    // Register LM tools
    this.context.subscriptions.push(
      vscode.lm.registerTool('bluestep-systems_bsjs-push-pull_pull-script', PULL_SCRIPT_TOOL),
    );

    return this;
  }

  public clearMap(alreadyAlerted: boolean = false) {
    this.settings.clear();
    !alreadyAlerted && Alert.info("Cleared all Settings");
    this.settings.set('debugMode', SettingsWrapper.DEFAULT.debugMode);
    this.settings.set('advancedMode', SettingsWrapper.DEFAULT.advancedMode);
  }

  public isDebugMode() {
    if (this._settings === null) {
      return false;
    }
    return this.settings.get('debugMode').enabled;
  }

  public toggleAdvancedMode() {
    console.log("Toggling advanced mode");
    this.settings.set('advancedMode', {
      enabled: !this.settings.get('advancedMode').enabled
    });
    Alert.info(`Advanced mode ${this.settings.get('advancedMode').enabled ? "enabled" : "disabled"}`);
  }

  public toggleDebugMode() {
    console.log("Toggling debug mode");
    this.settings.set('debugMode', {
      enabled: !this.settings.get('debugMode').enabled,
      anyDomainOverrideUrl: this.settings.get('debugMode').anyDomainOverrideUrl,
      versionOverride: this.settings.get('debugMode').versionOverride
    });
    Alert.info(`Debug mode ${this.settings.get('debugMode').enabled ? "enabled" : "disabled"}`);
  }

  public getVersion(): string {
    try {
      const extension = vscode.extensions.getExtension('bluestep-systems.bsjs-push-pull');
      if (extension && extension.packageJSON && extension.packageJSON.version) {
        return extension.packageJSON.version;
      }
      throw new Err.PackageJsonNotFoundError();
    } catch (error) {
      throw error;
    }
  }

  public runConverts() {
    Alert.info("Not implemented yet");
  }

  /**
   * Dispose all managed resources.
   */
  public dispose() {
    this._disposables.dispose();
  }
}();
