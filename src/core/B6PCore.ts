import * as crypto from 'crypto';
import * as path from 'path';
import { BasicAuthProvider } from './auth/BasicAuthProvider';
import { B6PUri } from './B6PUri';
import { CoreScriptUrlParser } from './data/CoreScriptUrlParser';
import { DownstairsPathParser } from './data/DownstairsPathParser';
import { CoreSessionManager } from './session/CoreSessionManager';
import type { B6PProviders, IFileSystem, ILogger, IPersistence, IProgress, IPrompt } from './providers';
import { executePush } from './push';

/**
 * Result returned by the audit command.
 */
export interface AuditResult {
  changedFiles: string[];
  baseUrl: string;
}

/**
 * Result returned by the report command.
 */
export interface ReportResult {
  metadataEntries: number;
  orgCacheEntries: number;
  details: string;
}

/**
 * Headless orchestrator for all B6P operations.
 *
 * Consumers (VS Code extension, CLI, tests) construct this with their own
 * {@link B6PProviders} implementations, then call the command methods.
 *
 * This class contains zero `vscode.*` imports — all platform-specific
 * behaviour is delegated to the providers.
 */
export class B6PCore {
  readonly fs: IFileSystem;
  readonly persistence: IPersistence;
  readonly prompt: IPrompt;
  readonly logger: ILogger;
  readonly progress: IProgress;

  readonly auth: BasicAuthProvider;
  readonly session: CoreSessionManager;

  constructor(providers: B6PProviders) {
    this.fs = providers.fs;
    this.persistence = providers.persistence;
    this.prompt = providers.prompt;
    this.logger = providers.logger;
    this.progress = providers.progress;

    this.auth = new BasicAuthProvider(this.persistence, this.prompt, this.logger);
    this.session = new CoreSessionManager(this.persistence, this.auth, this.logger, this.prompt);
  }

  /**
   * Create a CoreScriptUrlParser wired to this core's session and logger.
   */
  private createParser(url: string): CoreScriptUrlParser {
    return new CoreScriptUrlParser(url, this.session, this.logger, this.prompt);
  }

  /**
   * Derive the base WebDAV URL from a local file path by parsing the
   * downstairs path structure and looking up stored metadata.
   */
  private async deriveBaseUrl(filePath: string, _workspacePath: string): Promise<string | null> {
    try {
      const parser = new DownstairsPathParser(filePath);
      const metadataKey = `scriptMeta.${parser.scriptName}`;
      const meta = await this.persistence.get<{ webdavUrl: string }>(metadataKey);
      if (meta?.webdavUrl) {
        return meta.webdavUrl;
      }
      this.logger.warn(`No stored metadata for script "${parser.scriptName}". User must provide URL.`);
      return null;
    } catch {
      this.logger.warn(`Could not parse downstairs path: ${filePath}`);
      return null;
    }
  }

  // ── Push / Pull ───────────────────────────────────────────────────

  async push(opts: {
    targetUrl?: string;
    rootPath: string;
    snapshot?: boolean;
  }): Promise<void> {
    const targetUrl = opts.targetUrl ?? await this.prompt.inputBox({ prompt: 'Paste in the target formula URI' });
    if (targetUrl === undefined) {
      this.prompt.error('No target formula URI provided');
      return;
    }
    this.logger.info(`Pushing script from ${opts.rootPath} to ${targetUrl}${opts.snapshot ? ' (snapshot)' : ''}`);
    await executePush({
      targetUrl,
      rootPath: opts.rootPath,
      snapshot: opts.snapshot ?? false,
      session: this.session,
      fs: this.fs,
      prompt: this.prompt,
      logger: this.logger,
      progress: this.progress,
    });
  }

  async pushCurrent(opts: {
    filePath: string;
    snapshot?: boolean;
  }): Promise<void> {
    this.logger.info(`Push current for file: ${opts.filePath}`);
    const baseUrl = await this.deriveBaseUrl(opts.filePath, '');
    if (!baseUrl) {
      const url = await this.prompt.inputBox({ prompt: 'Could not determine script URL. Paste the target formula URI:' });
      if (!url) {return;}
      // Derive rootPath from the file's path structure
      const parser = new DownstairsPathParser(opts.filePath);
      await this.push({ targetUrl: url, rootPath: parser.getShavedName(), snapshot: opts.snapshot });
      return;
    }
    const parser = new DownstairsPathParser(opts.filePath);
    await this.push({ targetUrl: baseUrl, rootPath: parser.getShavedName(), snapshot: opts.snapshot });
  }

  async pull(opts: {
    formulaUrl?: string;
    workspacePath: string;
  }): Promise<void> {
    const formulaUrl = opts.formulaUrl ?? await this.prompt.inputBox({ prompt: 'Paste in the desired formula URL' });
    if (formulaUrl === undefined) {
      this.prompt.error('No formula URL provided');
      return;
    }
    this.logger.info(`Pulling script from ${formulaUrl} into ${opts.workspacePath}`);

    const parser = this.createParser(formulaUrl);
    const fetchedScriptObject = await parser.getScript();
    if (!fetchedScriptObject) {
      this.logger.warn('fetchedScriptObject is null');
      return;
    }

    const U = await parser.getU();

    const pullTasks = fetchedScriptObject.map(entry => ({
      execute: async () => {
        const ultimatePath = path.join(opts.workspacePath, U, entry.downstairsPath);
        const isDirectory = ultimatePath.endsWith('/') || entry.downstairsPath.endsWith('/');

        if (isDirectory) {
          const uri = B6PUri.fromFsPath(ultimatePath);
          if (!(await this.fs.exists(uri))) {
            await this.fs.createDirectory(uri);
          }
        } else {
          // Download the file
          const response = await this.session.fetch(entry.upstairsPath);
          const data = new Uint8Array(await response.arrayBuffer());
          const fileUri = B6PUri.fromFsPath(ultimatePath);
          await this.fs.writeFile(fileUri, data);
        }
        return ultimatePath;
      },
      description: 'scripts',
    }));

    await this.progress.withProgress(pullTasks, {
      title: 'Pulling Script...',
      cleanupMessage: 'Cleaning up the downstairs folder...',
    });

    this.prompt.info('Pull complete!');
  }

  async pullCurrent(opts: {
    filePath: string;
    workspacePath: string;
  }): Promise<void> {
    const baseUrl = await this.deriveBaseUrl(opts.filePath, opts.workspacePath);
    if (!baseUrl) {
      const url = await this.prompt.inputBox({ prompt: 'Could not determine script URL. Paste the formula URL:' });
      if (!url) {return;}
      await this.pull({ formulaUrl: url, workspacePath: opts.workspacePath });
      return;
    }
    await this.pull({ formulaUrl: baseUrl, workspacePath: opts.workspacePath });
  }

  // ── Audit ─────────────────────────────────────────────────────────

  async audit(opts: {
    filePath: string;
    workspacePath: string;
  }): Promise<AuditResult | null> {
    this.logger.info(`Auditing file: ${opts.filePath}`);

    const baseUrl = await this.deriveBaseUrl(opts.filePath, opts.workspacePath);
    if (!baseUrl) {
      const url = await this.prompt.inputBox({ prompt: 'Could not determine script URL. Paste the formula URL:' });
      if (!url) {return null;}
      return this.auditWithUrl(url, opts.workspacePath);
    }
    return this.auditWithUrl(baseUrl, opts.workspacePath);
  }

  private async auditWithUrl(baseUrl: string, workspacePath: string): Promise<AuditResult | null> {
    const parser = this.createParser(baseUrl);
    const fetchedScriptObject = await parser.getScript();
    if (!fetchedScriptObject) {
      this.logger.warn('fetchedScriptObject is null during audit');
      return null;
    }

    const U = await parser.getU();
    const changedFiles: string[] = [];

    for (const entry of fetchedScriptObject) {
      const ultimatePath = path.join(workspacePath, U, entry.downstairsPath);
      if (ultimatePath.endsWith('/') || entry.downstairsPath.endsWith('/')) {
        continue; // skip directories
      }
      const fileUri = B6PUri.fromFsPath(ultimatePath);
      if (!(await this.fs.exists(fileUri))) {
        changedFiles.push(entry.downstairsPath + ' (new)');
        continue;
      }
      // Compare file hash against server
      const localContent = await this.fs.readFile(fileUri);
      const localHash = crypto.createHash('sha512').update(localContent).digest('hex');
      const response = await this.session.fetch(entry.upstairsPath, { method: 'HEAD' });
      const etag = response.headers.get('etag');
      if (etag) {
        // ETag format is typically "hash" or W/"hash"
        const serverHash = etag.replace(/^W\//, '').replace(/"/g, '');
        if (localHash !== serverHash) {
          changedFiles.push(entry.downstairsPath);
        }
      } else {
        // No ETag — can't compare, mark as potentially changed
        changedFiles.push(entry.downstairsPath + ' (no etag)');
      }
    }

    if (changedFiles.length === 0) {
      this.prompt.info('No differences detected. Local script is in sync with the server.');
    } else {
      this.prompt.info(`Detected ${changedFiles.length} file(s) with differences:\n\n${changedFiles.join('\n')}`);
    }

    return { changedFiles, baseUrl };
  }

  async auditPull(opts: {
    filePath: string;
    workspacePath: string;
  }): Promise<void> {
    const result = await this.audit(opts);
    if (!result || result.changedFiles.length === 0) {
      return;
    }

    const YES = 'Sync';
    const NO = 'Cancel';
    const response = await this.prompt.confirm(
      `Detected ${result.changedFiles.length} file(s) with differences:\n\n${result.changedFiles.join('\n')}\n\nSync local copy with the server?`,
      [YES, NO]
    );

    if (response !== YES) {
      this.logger.info('User declined audit-pull sync');
      return;
    }

    await this.pull({ formulaUrl: result.baseUrl, workspacePath: opts.workspacePath });
  }

  // ── Deploy ────────────────────────────────────────────────────────

  async deploy(opts: {
    configPath: string;
  }): Promise<void> {
    this.logger.info(`Quick deploy from config: ${opts.configPath}`);

    // Read config file
    const configUri = B6PUri.fromFsPath(opts.configPath);
    if (!(await this.fs.exists(configUri))) {
      this.prompt.error(`Config file not found: ${opts.configPath}`);
      return;
    }

    const configContent = await this.fs.readFile(configUri);
    const configText = Buffer.from(configContent).toString('utf-8');

    interface DeployConfig {
      sourceRootPath: string;
      targets: Array<{
        url: string;
        snapshot?: boolean;
      }>;
    }

    let config: DeployConfig;
    try {
      config = JSON.parse(configText) as DeployConfig;
    } catch (error) {
      this.prompt.error(`Failed to parse config file: ${error instanceof Error ? error.message : error}`);
      return;
    }

    if (!config.sourceRootPath || !config.targets || config.targets.length === 0) {
      this.prompt.error('Invalid config file. Required fields: sourceRootPath, targets[]');
      return;
    }

    this.logger.info(`Deploying to ${config.targets.length} target(s)`);

    for (const target of config.targets) {
      this.logger.info(`Deploying to: ${target.url}`);
      try {
        await this.push({
          targetUrl: target.url,
          rootPath: config.sourceRootPath,
          snapshot: target.snapshot ?? false,
        });
      } catch (error) {
        this.logger.error(`Failed to deploy to ${target.url}: ${error instanceof Error ? error.message : error}`);
      }
    }

    this.prompt.info('Deploy complete!');
  }

  // ── Credentials ───────────────────────────────────────────────────

  async updateCredentials(): Promise<void> {
    await this.auth.update();
  }

  // ── Session Management ────────────────────────────────────────────

  async clearSessions(): Promise<void> {
    this.prompt.info('Clearing all sessions');
    await this.session.clearAll();
  }

  // ── Settings ──────────────────────────────────────────────────────

  async clearSettings(): Promise<void> {
    this.prompt.info('Reverting to default settings');
    await this.persistence.clearPublic();
  }

  async clearAll(): Promise<void> {
    this.prompt.info('Clearing sessions, auth, and settings');
    await this.persistence.clearPublic();
    await this.session.clearAll();
    await this.auth.clear();
  }

  // ── State ─────────────────────────────────────────────────────────

  async report(): Promise<ReportResult> {
    // Note: This is a basic implementation. Full functionality requires
    // IPersistence to support listing keys by prefix.
    this.logger.info('Generating state report...');

    const details = [
      'Script Metadata and Org Cache reporting requires persistence layer',
      'to support key enumeration. This feature is pending full implementation.',
      '',
      'In the CLI, persistence is stored in .b6p/ directory.',
      'Use file system tools to inspect the raw JSON files for now.',
    ].join('\n');

    this.prompt.info(details);

    return {
      metadataEntries: 0,
      orgCacheEntries: 0,
      details,
    };
  }

  // ── Updates ───────────────────────────────────────────────────────

  async checkForUpdates(): Promise<void> {
    this.logger.info('Checking for updates...');

    const REPO_OWNER = 'bluestep-systems';
    const REPO_NAME = 'vscode-extension';
    const CURRENT_VERSION = '1.2.1'; // Would ideally come from package.json

    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'B6P-CLI',
          'Accept': 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        this.prompt.error(`Failed to check for updates: HTTP ${response.status}`);
        return;
      }

      const release = await response.json() as { tag_name: string; html_url: string; body: string };
      const latestVersion = release.tag_name.replace(/^v/, '');

      if (this.isNewerVersion(latestVersion, CURRENT_VERSION)) {
        this.prompt.info(
          `A new version is available!\n` +
          `Current: v${CURRENT_VERSION}\n` +
          `Latest:  v${latestVersion}\n\n` +
          `Download from: ${release.html_url}`
        );
      } else {
        this.prompt.info(`You are running the latest version (v${CURRENT_VERSION})`);
      }
    } catch (error) {
      this.prompt.error(`Error checking for updates: ${error instanceof Error ? error.message : error}`);
    }
  }

  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string) => version.split('.').map(num => parseInt(num, 10));
    const newParts = parseVersion(newVersion);
    const currentParts = parseVersion(currentVersion);

    const maxLength = Math.max(newParts.length, currentParts.length);
    while (newParts.length < maxLength) {newParts.push(0);}
    while (currentParts.length < maxLength) {currentParts.push(0);}

    for (let i = 0; i < maxLength; i++) {
      if (newParts[i] > currentParts[i]) {return true;}
      else if (newParts[i] < currentParts[i]) {return false;}
    }
    return false;
  }

  // ── Config Toggles ────────────────────────────────────────────────

  async setConfig(key: string, value: unknown): Promise<void> {
    await this.persistence.set(`settings.${key}`, value);
    this.prompt.info(`Set ${key} = ${JSON.stringify(value)}`);
  }

  async getConfig<T>(key: string): Promise<T | undefined> {
    return this.persistence.get<T>(`settings.${key}`);
  }

  // ── Setup URL ─────────────────────────────────────────────────────

  async getSetupUrl(opts: { filePath: string }): Promise<string | null> {
    try {
      const parser = new DownstairsPathParser(opts.filePath);
      const metadataKey = `scriptMeta.${parser.scriptName}`;
      const meta = await this.persistence.get<{ webdavUrl: string; classid: string; seqnum: string }>(metadataKey);

      if (!meta?.webdavUrl || !meta.classid || !meta.seqnum) {
        this.prompt.error(`No stored metadata found for script "${parser.scriptName}". Pull the script first.`);
        return null;
      }

      const origin = new URL(meta.webdavUrl).origin;

      // Build setup URL using ScriptKey pattern from the main codebase
      // Format: {origin}/shared/admin/applications/relate/{setupPage}?_event=edit&_id={classid__seqnum}
      const SCRIPT_TYPE_REGISTRY: Record<string, { setupPage: string }> = {
        "654015": { setupPage: "editformuladetails.jsp" },
        "530024": { setupPage: "editdetailreport1.jsp" },
        "363769": { setupPage: "editendpoint.jsp" },
      };

      const registry = SCRIPT_TYPE_REGISTRY[meta.classid];
      if (!registry) {
        this.prompt.error(`Unknown script type (classid: ${meta.classid}). Cannot generate setup URL.`);
        return null;
      }

      const compoundId = `${meta.classid}___${meta.seqnum}`;
      const setupUrl = `${origin}/shared/admin/applications/relate/${registry.setupPage}?_event=edit&_id=${compoundId}`;

      return setupUrl;
    } catch (error) {
      this.logger.error(`Error generating setup URL: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Dispose resources (session cleanup timer, etc.).
   */
  dispose(): void {
    this.session.dispose();
  }
}
