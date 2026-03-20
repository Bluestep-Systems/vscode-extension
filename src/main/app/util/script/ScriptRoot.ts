import path from 'path';
import * as vscode from 'vscode';
import { Util } from '..';
import { ScriptMetaData } from '../../../../../types';
import { FileExtensions, FolderNames, SpecialFiles } from '../../../resources/constants';
import { App } from '../../App';
import { ORG_CACHE as OC } from '../../cache/OrgCache';
import { SCRIPT_METADATA_STORE as MDS } from '../../cache/ScriptMetaDataStore';
import pushCurrent from '../../ctrl-p-commands/pushCurrent';
import { DownstairsUriParser } from '../data/DownstairsUrIParser';
import { OrgWorker } from '../data/OrgWorker';
import { ScriptUrlParser } from '../data/ScriptUrlParser';
import { Err } from '../Err';
import { FileSystem } from '../fs/FileSystem';
import { ScriptFactory } from './ScriptFactory';
import { ScriptFile } from './ScriptFile';
import type { ScriptFolder } from './ScriptFolder';
import { ScriptNode } from './ScriptNode';
import { ScriptTranspiler } from './ScriptTranspiler';
import { TsConfig } from './TsConfig';
const fs = FileSystem.getInstance;

/**
 * Object representing the root of an individual script on the filesystem.
 * 
 * This originally was the webdavid root file.
 * @lastreviewed 2025-09-15
 */
export class ScriptRoot {
  public static readonly GITIGNORE_FILENAME = SpecialFiles.GITIGNORE;
  private _orgWorker: OrgWorker | null;
  public readonly rootUri: vscode.Uri;
  private parser: DownstairsUriParser;
  private scriptParser: ScriptUrlParser | null;
  /**
   * Creates a script root utilizing any of the children in said script.
   * 
   * The objective here is to use literally any file within the script's downstairs
   * folder to extrapolate the root of the script.
   * 
   * @param childUri Any file within the downstairs root folder
   * @lastreviewed 2025-09-15
   */
  constructor(public readonly uri: vscode.Uri) {
    this.parser = new DownstairsUriParser(uri);
    const shavedName = this.parser.getShavedName();
    this.rootUri = vscode.Uri.joinPath(vscode.Uri.file(shavedName), "/");
    this._orgWorker = null;
    this.scriptParser = null;
  }

  public orgWorker(): OrgWorker {
    if (this._orgWorker === null) {
      if (this.scriptParser !== null) {
        this._orgWorker = this.scriptParser.orgWorker();
        return this._orgWorker;
      }
      throw new Err.InvalidStateError("OrgWorker not initialized");
    }
    return this._orgWorker;
  }

  /**
   * Gets where the .gitignore file *should* be located.
   * @lastreviewed 2025-09-15
   */
  private getGitIgnoreFileUri() {
    const downstairsRoot = this.getRootUri();
    return vscode.Uri.joinPath(downstairsRoot, SpecialFiles.GITIGNORE);
  }

  /**
   * Derives the U value from the folder structure (parent folder name, e.g. "U100001").
   */
  private getUFromPath(): string {
    return path.basename(this.getOrgUri().fsPath);
  }

  /**
   * Derives the script folder name from the folder structure.
   */
  private getScriptNameFromPath(): string {
    return path.basename(this.rootUri.fsPath);
  }

  /**
   * Modifies the metadata for the script root via the persistent store.
   * Creates a new entry with default values if none exists (requires a scriptParser for initial download).
   *
   * @param callBack Optional callback function to modify the metadata object
   * @returns The current or modified metadata object
   */
  public async modifyMetaData(callBack?: (meta: ScriptMetaData) => void): Promise<ScriptMetaData> {
    const pathU = this.getUFromPath();
    const pathScriptName = this.getScriptNameFromPath();

    let entry = MDS.findByScriptName(pathU, pathScriptName);

    if (!entry) {
      if (this.scriptParser !== null) {
        const scriptName = await this.scriptParser.getScriptName() || (() => { throw new Err.FileReadError("Missing script name"); })();
        const U = await this.scriptParser.getU() || (() => { throw new Err.FileReadError("Missing U"); })();
        const webdavId = this.scriptParser.webDavId || (() => { throw new Err.FileReadError("Missing webdavId"); })();
        const scriptKey = await this.scriptParser.getScriptBaseKey() || (() => { throw new Err.FileReadError("Missing scriptKey"); })();

        entry = { scriptName, U, webdavId, pushPullRecords: [], scriptKey };
      } else {
        throw new Err.InvalidStateError(
          `No metadata found for script "${pathScriptName}" in org "${pathU}" and no parser available to create it.`
        );
      }
    }

    if (callBack) {
      callBack(entry);
    }

    await MDS.upsert(entry);
    return entry;
  }

  withParser(parser: ScriptUrlParser) {
    this.scriptParser = parser;
  }

  /**
   * Gets the metadata for the script root, or null if none exists.
   */
  public async getMetaData(): Promise<ScriptMetaData | null> {
    const pathU = this.getUFromPath();
    const pathScriptName = this.getScriptNameFromPath();
    return MDS.findByScriptName(pathU, pathScriptName) || null;
  }

  /**
   * Modifies the .gitignore file, and creates a default if it does not exist.
   * Default .gitignore includes common patterns like .DS_Store files.
   * 
   * @param callBack Optional callback function to modify the current contents
   * @returns The modified contents of the .gitignore file as an array of strings
   * @lastreviewed 2025-09-15
   */
  public async modifyGitIgnore(callBack?: (currentContents: string[]) => void): Promise<string[]> {
    const gitIgnoreUri = this.getGitIgnoreFileUri();
    let currentContents: string[] = [];
    let modified = false;
    try {
      try {
        await fs().stat(gitIgnoreUri);
      } catch (e) {
        throw new Err.FileNotFoundError("Gitignore file does not exist at: `" + gitIgnoreUri.fsPath + "`");
      }
      const fileContents = await fs().readFile(gitIgnoreUri);
      const fileString = Buffer.from(fileContents).toString('utf-8');
      currentContents = fileString.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    } catch (e) {
      App.logger.error("Error reading .gitignore file: " + e);
      if (!(e instanceof Err.FileNotFoundError)) {
        throw e;
      }
      App.logger.warn(".gitignore file does not exist; creating a new one.");
      // set a default .gitignore
      currentContents = [
        "**/.DS_Store",
      ];
      modified = true;
    }
    const preModified = JSON.parse(JSON.stringify(currentContents));
    if (callBack) {
      callBack(currentContents);
      Util.isDeepEqual(preModified, currentContents) || (modified = true);
    }
    if (modified) {
      await fs().writeFile(this.getGitIgnoreFileUri(), Buffer.from(currentContents.join("\n") + "\n"));
    }
    return currentContents;
  }

  /**
   * Gets the contents of the .gitignore file for this script root as an array of strings.
   * @lastreviewed 2025-09-15
   */
  public async getGitIgnore(): Promise<string[]> {
    return await this.modifyGitIgnore();
  }

  /**
   * Gets the {@link vscode.Uri} for the downstairs root folder.
   * @lastreviewed 2025-09-15
   */
  public getRootUri() {
    return this.rootUri;
  }

  /**
   * Gets the {@link vscode.Uri Uri} for the downstairs U folder.
   *
   * @lastreviewed 2025-10-09
   */
  public getOrgUri() {
    return vscode.Uri.joinPath(this.getRootUri(), "..");
  }

  /**
   * Gets the script name from the metadata file.
   * @throws an {@link Err.InvalidStateError} if the metadata is missing or has no scriptName
   */
  public async getScriptName(): Promise<string> {
    const metadata = await this.getMetaData();
    if (!metadata) {
      throw new Err.InvalidStateError("Missing metadata");
    }
    return metadata.scriptName || (() => { throw new Err.InvalidStateError("Missing scriptName in metadata"); })();
  }

  /**
   * The WebDAV ID extracted from the metadata file.
   * @throws an {@link Err.FileNotFoundError} if the metadata file is missing or malformed.
   * @lastreviewed 2025-10-09
   */
  async getWebdavId() {
    if (this.scriptParser !== null) {
      return this.scriptParser.webDavId;
    }
    const metadata = await this.getMetaData();
    if (!metadata) {
      throw new Err.InvalidStateError("Missing metadata");
    }
    return metadata.webdavId || (() => { throw new Err.InvalidStateError("Missing webdavId in metadata"); })();
  }

  /**
   * Gets the script key from 
   * - the script parser (if available)
   * - the metadata file (if available)
   * - by instantiating a script parser from the upstairs URL (if a webdavId is available)
   */
  async getScriptKey() {
    if (this.scriptParser !== null) {
      return this.scriptParser.getScriptBaseKey();
    }
    const metadata = await this.getMetaData();
    if (!metadata) {
      throw new Err.InvalidStateError("Missing metadata");
    }
    const potentialKey = metadata.scriptKey;
    if (potentialKey) {
      return potentialKey;
    }
    try {
      // this will fail if there is no webdavId.
      this.scriptParser = new ScriptUrlParser((await this.getBaseWebDavUrl()).toString());
      const key = await this.scriptParser.getScriptBaseKey();
      await this.modifyMetaData(meta => {
        meta.scriptKey = key;
      });
      return key;
    } catch (e) {
      throw new Err.FileReadError("Can't obtain scriptKey in metadata, even after trying to instantiate a scriptParser.");
    }
  }

  /**
   * The WebDAV ID extracted from the metadata file.
   * @throws an {@link Err.FileNotFoundError} if the metadata file is missing or malformed.
   * @lastreviewed 2025-10-09
   */
  async getU() {
    const metadata = await this.getMetaData();
    if (!metadata) {
      return await this.orgWorker().getU();
    }
    return metadata.U || (() => { throw new Err.InvalidStateError("Missing origin in metadata"); })();
  }

  /**
   * The domain extracted from the file path.
   *
   * @lastreviewed 2025-10-15
   */
  public async anyOrigin() {
    return await OC.getAnyBaseUrl(await this.getU());
  }

  public getAsFolder(): ScriptFolder {
    return ScriptFactory.createFolder(vscode.Uri.joinPath(this.getRootUri(), "/"), this);
  }

  /**
   * Returns a base URL string suitable for pull and push operations to the appropriate org.
   * @lastreviewed 2025-09-15
   */
  public async getBaseWebDavUrlString() {
    const origin = await this.anyOrigin();
    const webdavId = await this.getWebdavId();
    return `${origin.toString()}files/${webdavId}/`;
  }

  /**
   * Returns a base {@link URL} suitable for pull and push operations.
   * @lastreviewed 2025-09-15
   */
  public async getBaseWebDavUrl(): Promise<URL> {
    const urlString = await this.getBaseWebDavUrlString();
    return new URL(urlString);
  }

  /**
   * Creates a ScriptRoot from a root {@link vscode.Uri}.
   * @param rootUri The root {@link vscode.Uri} to create the ScriptRoot from
   * @lastreviewed 2025-09-15
   */
  static fromRootUri(rootUri: vscode.Uri) {
    return ScriptFactory.createScriptRoot(vscode.Uri.joinPath(rootUri, "/"));
  }


  /**
   * Gets the scripts {@link ScriptFolder} in the draft directory.
   * @lastreviewed 2025-10-01
   */
  public async getDraftScriptsFolder() {
    return this.getDraftFolder().getChildFolder("scripts");
  }

  /**
   * Checks if this {@link ScriptRoot} is morally equivalent to another {@link ScriptRoot}.
   * Compares origin, WebDAV ID, downstairs root path, and upstairs URL.
   * 
   * @param b The other ScriptRoot to compare against
   * @lastreviewed 2025-09-15
   */
  equals(b: ScriptRoot) {
    return this.rootUri.fsPath === b.rootUri.fsPath;
  }

  /**
   * Performs the "snapshot" operation by compiling the draft folder and pushing
   * its contents to the server.
   * 
   * @lastreviewed 2025-10-13
   */
  public async snapshot() {
    await this.compileDraftFolder();
    await pushCurrent({ isSnapshot: true, sr: this });
  }

  /**
   * Deletes the relevant build folder (e.g. ".build") within the draft directory and its subcomponents.
   * Ignores FileNotFound errors if the folder doesn't exist.
   * 
   * @lastreviewed 2025-10-01
   */
  public async deleteBuildFolder() {
    try {
      return await fs().delete(await this.getDraftBuildFolder(), { recursive: true });
    } catch (error) {
      // Ignore FileNotFound errors - the folder doesn't exist, which is fine
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        console.log("Build folder doesn't exist (this is fine)");
        return;
      }
      // Re-throw other unknown errors (like permission issues)
      throw error;
    }
  }

  /**
   * Compiles all TypeScript files in the draft folder and copies non-TypeScript files to its 
   * respective build folder.
   * 
   * Deletes the existing build folder first, then compiles TypeScript files using {@link ScriptTranspiler},
   * copies other relevant files, and cleans up any orphaned files in the build directory.
   * 
   * @lastreviewed 2025-09-15
   */
  public async compileDraftFolder(): Promise<void> {
    //TODO see if we can optimize this to only compile changed files
    await this.deleteBuildFolder();
    const draftFolder = this.getDraftFolder();
    const allDraftFiles = await draftFolder.flatten();
    const transpiler = new ScriptTranspiler();
    for (const file of allDraftFiles) {
      if (await file.isFile() && (file as ScriptFile).isMarkdown() ||
        await file.isInItsRespectiveBuildFolder() ||
        await file.isFolder()) {
        continue;
      }

      if ([FileExtensions.TYPESCRIPT, FileExtensions.TYPESCRIPT_JSX].some(ext => file.path().endsWith(ext))) {
        await transpiler.addFile(file);
      }
    }
    const emittedEntries = await transpiler.transpile(this);
    App.logger.info(`Transpiled ${emittedEntries.length} TypeScript files.`);
    App.logger.info(`Emitted Files: \n${emittedEntries.join("\n")}`);
    const emittedScriptNodes = emittedEntries.map(e => ScriptFactory.createNode(vscode.Uri.file(e), this));
    App.logger.info(`Emitted ScriptNodes: \n${emittedScriptNodes.map(n => n.path()).join("\n")}`);
    await this.tidyMetadataFile();
  }

  /**
   * Removes stale push/pull records from metadata that reference files no longer in the draft folder.
   * This ensures the metadata stays synchronized with the actual file system state.
   * 
   * @lastreviewed 2025-10-01
   */
  private async tidyMetadataFile() {
    const draftFolder = this.getDraftFolder();
    const draftFiles = (await draftFolder.flattenRaw()).map(uri => uri.fsPath);
    await this.modifyMetaData((meta) => {
      meta.pushPullRecords = meta.pushPullRecords.filter(record => {
        return draftFiles.includes(record.downstairsPath);
      });
    });
  }

  /**
   * Gets the draft {@link ScriptFolder} within the script root.
   * @lastreviewed 2025-10-01
   */
  public getDraftFolder() {
    return ScriptFactory.createFolder(vscode.Uri.joinPath(this.rootUri, FolderNames.DRAFT), this);
  }

  /**
   * Gets the build {@link ScriptFolder} within the draft folder.
   * @lastreviewed 2025-10-01
   */
  public async getDraftBuildFolder() {
    const tsConfig = await this.getDraftTsConfig();

    return tsConfig.getBuildFolder();
  }

  /**
   * Gets the declarations {@link ScriptFolder} within the script root.
   * @lastreviewed 2025-10-01
   */
  public getDeclarationsFolder() {
    return ScriptFactory.createFolder(vscode.Uri.joinPath(this.rootUri, FolderNames.DECLARATIONS), this);
  }

  /**
   * Finds all tsconfig.json files within the draft folder and its subdirectories.
   * 
   * @returns A Promise that resolves to an array of {@link TsConfig} instances
   * @lastreviewed 2025-10-01
   */
  public async findTsConfigFiles(): Promise<TsConfig[]> {
    const tsConfigFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(this.getDraftFolder().uri(), '**/' + TsConfig.NAME));
    return tsConfigFiles.map(f => ScriptFactory.createTsConfig(f, this));
  }

  /**
   * Identifies TypeScript configuration files that are not in a copacetic (valid) state.
   * 
   * @returns A Promise that resolves to an array of file paths for invalid tsconfig.json files
   * @lastreviewed 2025-10-01
   */
  public async getBadTsFiles(): Promise<string[]> {

    const tsConfigFiles = this.findTsConfigFiles();
    const badFiles: string[] = [];
    for (const tsConfig of await tsConfigFiles) {
      if (!(await tsConfig.isCopacetic())) {
        badFiles.push(tsConfig.path());
      }
    }
    return badFiles;
  }

  /**
   * Gets all draft folder nodes that are eligible for pushing (excludes build folder contents when not snapshot).
   * 
   * @lastreviewed 2025-10-01
   */
  public async getPushableNodes(snapshot: boolean = false): Promise<ScriptNode[]> {
    const flattenedDraft = await this.getDraftFolder().flatten();
    const pushableNodes: ScriptNode[] = [];
    for (const f of flattenedDraft) {
      const reason = await f.getReasonToNotPush();
      if (reason) {
        App.logger.info(`Excluding draft file from push: ${f.path()} (${reason})`);
        continue;
      }
      // reasoning: if it's a snapshot, we push every "standard" file.
      // if it's not a snapshot push, we exclude anything in a build folder
      // and we exclude anything that has a reason to not push (like being the root folder, etc).
      const isSnapshotOrNotInBuild = snapshot || !(await f.isInItsRespectiveBuildFolder());

      const fileName = f.path();
      if (isSnapshotOrNotInBuild) {
        pushableNodes.push(f);
      } else {
        App.logger.info(`Excluding file in build folder from push: ${fileName}`);
      }
    }

    return pushableNodes;
  }

  /**
   * Performs pre-deployment validation checks on the script root.
   * Verifies the script is copacetic and all TypeScript configuration files are valid.
   * 
   * @returns A Promise that resolves to an empty string if all checks pass, or an error message describing issues
   * @throws {Err.ScriptNotCopaceticError} When the script root is not in a copacetic state
   * @lastreviewed 2025-10-01
   */
  public async preflightCheck(): Promise<string> {
    const badTsFiles = await this.getBadTsFiles();
    if (badTsFiles.length > 0) {
      return `The following tsconfig files are invalid:\n\n${badTsFiles.join("\n")}\n\n
      SPECIFICALLY: ensure that there are no trailing commas in the JSON files; the IDE does not flag this with
      red squigglies, but it renders the JSON invalid and the webapp cannot parse it properly.`;
    }
    return "";
  }

  /**
   * Gets the root-level tsconfig.json file if it exists and is valid.
   * 
   * @returns A Promise that resolves to the root TsConfig instance
   * @throws an {@link Err.ScriptOperationError} When the root tsconfig.json file is missing or invalid
   * @lastreviewed 2025-10-13
   */
  public async getDraftTsConfig(): Promise<TsConfig> {
    const draftFolderUri = this.getDraftFolder().uri();
    const uri = vscode.Uri.joinPath(draftFolderUri, TsConfig.NAME);
    const tsConfig = ScriptFactory.createTsConfig(uri);
    if (!(await tsConfig.isCopacetic())) {
      throw new Err.ScriptOperationError(`No ${TsConfig.NAME} file found in script root.`);
    }
    return tsConfig;
  }
}
