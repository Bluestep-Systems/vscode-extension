import * as vscode from 'vscode';
import type { ScriptContext } from '@bluestep-systems/b6p-core';
import type { IFileSystem, ILogger, IPrompt } from '@bluestep-systems/b6p-core';
import { BasicAuthProvider } from '@bluestep-systems/b6p-core';
import { SessionManager } from '@bluestep-systems/b6p-core';
import { OutputChannels, SettingsKeys } from '@bluestep-systems/b6p-core';
import ctrlPCommands from './ctrl-p-commands';
import readOnlyCheck from './services/ReadOnlyChecker';
import { UpdateUI } from './services/UpdateUI';
import { VsCodeSettingsWrapper } from './settings/VsCodeSettingsWrapper';
import { Err } from '@bluestep-systems/b6p-core';
import { HttpClient } from '@bluestep-systems/b6p-core';
import { OrgCache } from '@bluestep-systems/b6p-core';
import { ScriptMetaDataStore } from '@bluestep-systems/b6p-core';
import { McpServerProvider } from './mcp/McpServerProvider';
import { PULL_SCRIPT_TOOL } from './mcp/PullScriptTool';
import { B6PCore } from '@bluestep-systems/b6p-core';
import { ScriptFactory } from '@bluestep-systems/b6p-core';
import { VscodeFileSystem, VscodePrompt, VscodeLogger, VscodeProgress } from '../providers';
import { SharedFilePersistence } from '@bluestep-systems/b6p-core';
import { PrivateKeys, PublicKeys } from '@bluestep-systems/b6p-core';

export const App = new class AppImpl implements ScriptContext {
  private _core: B6PCore | null = null;
  private _settings: VsCodeSettingsWrapper | null = null;
  private _updateUI: UpdateUI | null = null;

  public readonly appKey = SettingsKeys.APP_KEY;

  public isInitialized(): boolean {
    return this._core !== null;
  }

  public get core(): B6PCore {
    if (this._core === null) {throw new Err.ContextNotSetError('App');}
    return this._core;
  }
  public get settings(): VsCodeSettingsWrapper {
    if (this._settings === null) {throw new Err.ContextNotSetError('App');}
    return this._settings;
  }
  public get logger(): ILogger {
    if (this.core.logger === null) {throw new Err.ContextNotSetError('App');}
    return this.core.logger;
  }
  public get updateUI(): UpdateUI {
    if (this._updateUI === null) {throw new Err.ManagerNotInitializedError('UpdateUI');}
    return this._updateUI;
  }

  // ScriptContext members (delegated to B6PCore)
  public get sessionManager(): SessionManager { return this.core.sessionManager; }
  public get orgCache(): OrgCache { return this.core.orgCache; }
  public get scriptMetadataStore(): ScriptMetaDataStore { return this.core.scriptMetadataStore; }
  public get fs(): IFileSystem { return this.core.fs; }
  public get prompt(): IPrompt { return this.core.prompt; }
  public get auth(): BasicAuthProvider { return this.core.auth; }
  public getScriptFactory() { return this.core.getScriptFactory(); }

  public init(context: vscode.ExtensionContext) {
    if (this._core !== null) {
      throw new Err.ContextAlreadySetError('Extension context');
    }

    const outputChannel = vscode.window.createOutputChannel(OutputChannels.B6P, { log: true });
    context.subscriptions.push(outputChannel);

    const settings = new VsCodeSettingsWrapper();
    const vscodeLogger = new VscodeLogger(outputChannel);

    const persistence = new SharedFilePersistence();
    persistence.setPendingBootstrap(() => migrateFromVscodeStores(persistence, context));

    const core = new B6PCore({
      fs: new VscodeFileSystem(),
      persistence,
      prompt: new VscodePrompt(),
      logger: vscodeLogger,
      progress: new VscodeProgress(),
      isDebugMode: () => settings.get('debugMode').enabled,
      orgCacheSettings: settings,
      fetchFn: (url, options) => HttpClient.getInstance().fetch(url, options),
      updateServiceConfig: {
        currentVersion: this.getVersion(),
        repoOwner: 'bluestep-systems',
        repoName: 'vscode-extension',
        enabled: settings.get('updateCheck').enabled,
        versionOverride: settings.get('debugMode').versionOverride
      }
    });
    context.subscriptions.push(core);

    ScriptFactory.setDefaultContext(core);

    this._settings = settings;
    this._core = core;
    this._updateUI = this.buildUpdateUI(context, core, vscodeLogger);

    this.buildMcp(context, core, vscodeLogger);
    this.registerCommands(context);
    this.wireEvents(context);
    this.registerUriHandler(context);
    this.registerLanguageModelTools(context);

    settings.sync();
    readOnlyCheck();

    return this;
  }

  private registerCommands(context: vscode.ExtensionContext) {
    const reg = (id: string, handler: (...args: never[]) => unknown) => {
      context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    };

    reg('bsjs-push-pull.pushScript', ctrlPCommands.pushScript);
    reg('bsjs-push-pull.pullScript', ctrlPCommands.pullScript);
    reg('bsjs-push-pull.pullCurrent', ctrlPCommands.pullCurrent);
    reg('bsjs-push-pull.pushCurrent', ctrlPCommands.pushCurrent);
    reg('bsjs-push-pull.updateCredentials', ctrlPCommands.updateCredentials);
    reg('bsjs-push-pull.runTask', ctrlPCommands.runTask);
    reg('bsjs-push-pull.checkForUpdates', ctrlPCommands.checkForUpdates);
    reg('bsjs-push-pull.notify', ctrlPCommands.notify);
    reg('bsjs-push-pull.quickDeploy', ctrlPCommands.quickDeploy);
    reg('bsjs-push-pull.testTask', ctrlPCommands.testTask);
    reg('bsjs-push-pull.snapshot', ctrlPCommands.snapshot);
    reg('bsjs-push-pull.audit', ctrlPCommands.audit);
    reg('bsjs-push-pull.auditPull', ctrlPCommands.auditPull);
    reg('bsjs-push-pull.goToSetup', ctrlPCommands.goToSetup);

    reg('bsjs-push-pull.report', () => ctrlPCommands.report(this));
    reg('bsjs-push-pull.clearSettings', () => ctrlPCommands.clearSettings(this));
    reg('bsjs-push-pull.clearSessions', () => ctrlPCommands.clearSessions(this));
    reg('bsjs-push-pull.clearAll', () => ctrlPCommands.clearAll(this));
    reg('bsjs-push-pull.toggleAdvanced', () => ctrlPCommands.toggleAdvanced(this));
    reg('bsjs-push-pull.toggleDebug', () => ctrlPCommands.toggleDebug(this));
    reg('bsjs-push-pull.openSettings', ctrlPCommands.openSettings);
    reg('bsjs-push-pull.browseScriptRoot', () => ctrlPCommands.browseScriptRoot(this));
  }

  private wireEvents(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {readOnlyCheck();}
      }),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(this.appKey)) {
          this.logger.debug('Configuration changed, updating settings map');
          this.settings.sync();
        }
      }),
    );

    // Cross-cutting wiring on B6PCore. Single-slot callbacks are fine here
    // because App is the only owner; we null them out in dispose().
    this.core.sessionManager.onLogin = (url: URL) => {
      this.core.orgCache.findU(url).catch((e: unknown) => {
        this.logger.warn('Failed to cache org during login:', e instanceof Error ? e.message : String(e));
      });
    };
  }

  private registerLanguageModelTools(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.lm.registerTool('bluestep-systems_bsjs-push-pull_pull-script', PULL_SCRIPT_TOOL),
    );
  }

  private registerUriHandler(context: vscode.ExtensionContext) {
    const core = this.core;
    context.subscriptions.push(vscode.window.registerUriHandler({
      handleUri: (uri: vscode.Uri) => {
        if (uri.path === '/pull') {
          const formulaUrl = new URLSearchParams(uri.query).get('url');
          if (formulaUrl) {
            ctrlPCommands.pullScript(formulaUrl);
          } else {
            core.prompt.error('Missing "url" parameter in URI');
          }
        } else if (uri.path === '/audit-pull') {
          ctrlPCommands.auditPull();
        }
      }
    }));
  }

  private buildMcp(
    context: vscode.ExtensionContext,
    core: B6PCore,
    logger: VscodeLogger,
  ): void {
    const provider = new McpServerProvider(core.orgCache, core.auth, logger, context);
    context.subscriptions.push(provider);
    core.orgCache.onChanged = () => provider.fireChanged();
  }

  private buildUpdateUI(
    context: vscode.ExtensionContext,
    core: B6PCore,
    logger: VscodeLogger,
  ): UpdateUI | null {
    if (!core.updateService) {return null;}
    const updateUI = new UpdateUI(
      core.updateService,
      core.fs,
      logger,
      context.extensionUri,
      context.globalStorageUri,
      this.appKey,
    );
    context.subscriptions.push(updateUI);
    return updateUI;
  }

  public clearMap(alreadyAlerted: boolean = false) {
    this.settings.clear();
    if (!alreadyAlerted) {
      this.core.prompt.info('Cleared all Settings');
    }
    this.settings.set('debugMode', VsCodeSettingsWrapper.DEFAULT.debugMode);
    this.settings.set('advancedMode', VsCodeSettingsWrapper.DEFAULT.advancedMode);
  }

  public isDebugMode(): boolean {
    // Tolerant pre-init: many call sites run during early startup before
    // settings are wired. Treat "not yet initialized" as "debug off".
    if (this._settings === null) {return false;}
    return this._settings.get('debugMode').enabled;
  }

  public toggleAdvancedMode() {
    const current = this.settings.get('advancedMode');
    const next = { ...current, enabled: !current.enabled };
    this.settings.set('advancedMode', next);
    this.logger.debug('Toggling advanced mode');
    this.core.prompt.info(`Advanced mode ${next.enabled ? 'enabled' : 'disabled'}`);
  }

  public toggleDebugMode() {
    const current = this.settings.get('debugMode');
    const next = { ...current, enabled: !current.enabled };
    this.settings.set('debugMode', next);
    this.logger.debug('Toggling debug mode');
    this.core.prompt.info(`Debug mode ${next.enabled ? 'enabled' : 'disabled'}`);
  }

  public getVersion(): string {
    const extension = vscode.extensions.getExtension('bluestep-systems.bsjs-push-pull');
    if (extension && extension.packageJSON && extension.packageJSON.version) {
      return extension.packageJSON.version;
    }
    throw new Err.PackageJsonNotFoundError();
  }

  /**
   * Best-effort teardown. VS Code disposes everything in
   * `context.subscriptions` automatically; this just clears the
   * cross-cutting callback slots we set on B6PCore.
   */
  public dispose() {
    if (this._core !== null) {
      this._core.sessionManager.onLogin = null;
      this._core.orgCache.onChanged = null;
    }
  }
}();

/**
 * One-shot migration from VS Code's `workspaceState` and `SecretStorage`
 * into the shared file-backed persistence. Only runs when the corresponding
 * shared files do not yet exist, so subsequent activations are a no-op.
 *
 * VS Code's `SecretStorage` has no enumeration API, so secret migration is
 * limited to the keys we know about (the `PrivateKeys` enum).
 */
async function migrateFromVscodeStores(
  persistence: SharedFilePersistence,
  context: vscode.ExtensionContext,
): Promise<void> {
  await persistence.seedIfMissing({
    publicEntries: async () => {
      const out: Record<string, unknown> = {};
      for (const key of context.workspaceState.keys()) {
        const value = context.workspaceState.get(key);
        if (value !== undefined) {
          out[key] = value;
        }
      }
      // Also pull values stored under the public-key enum that might predate
      // workspaceState.keys() reporting them.
      for (const key of Object.values(PublicKeys)) {
        if (!(key in out)) {
          const value = context.workspaceState.get(key);
          if (value !== undefined) {
            out[key] = value;
          }
        }
      }
      return out;
    },
    secretEntries: async () => {
      const out: Record<string, string> = {};
      for (const key of Object.values(PrivateKeys)) {
        const value = await context.secrets.get(key);
        if (value !== undefined) {
          out[key] = value;
        }
      }
      return out;
    },
  });
}
