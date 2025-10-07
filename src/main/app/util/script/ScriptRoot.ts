import * as path from 'path';
import * as vscode from 'vscode';
import { Util } from '..';
import { ScriptMetaData } from '../../../../../types';
import { App } from '../../App';
import { FolderNames, SpecialFiles } from '../../../resources/constants';
import { DownstairsUriParser } from '../data/DownstairsUrIParser';
import { Err } from '../Err';
import { FileSystem } from '../fs/FileSystem';
import { ScriptCompiler } from './ScriptCompiler';
import { ScriptFactory } from './ScriptFactory';
import { ScriptFile } from './ScriptFile';
import { ScriptNode } from './ScriptNode';
import { TsConfig } from './TsConfig';
import type { ScriptFolder } from './ScriptFolder';
const fs = FileSystem.getInstance;

/**
 * Object representing the root of an individual script on the filesystem.
 * 
 * This originally was the webdavid root file.
 * @lastreviewed 2025-09-15
 */
export class ScriptRoot {
  private static readonly ScriptContentFolders = [FolderNames.INFO, FolderNames.SCRIPTS, FolderNames.OBJECTS] as const;
  public static readonly METADATA_FILENAME = SpecialFiles.B6P_METADATA;
  public static readonly GITIGNORE_FILENAME = SpecialFiles.GITIGNORE;
  readonly downstairsRootPath: path.ParsedPath;
  readonly downstairsRootOrgPath: path.ParsedPath;
  public readonly rootUri: vscode.Uri;
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
    const parser = new DownstairsUriParser(uri);
    const shavedName = parser.getShavedName();
    const scriptPath = path.parse(shavedName);                  // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase = path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this.rootUri = vscode.Uri.file(shavedName);
    this.downstairsRootPath = scriptPath;
    this.downstairsRootOrgPath = parentDirBase;
  }

  /**
   * Gets where the metadata file *should* be located.
   * @lastreviewed 2025-09-15
   */
  private getMetadataFileUri() {
    const downstairsRoot = this.getRootUri();
    return vscode.Uri.joinPath(downstairsRoot, ScriptRoot.METADATA_FILENAME);
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
   * Modifies the metadata for the script root.
   * It will also save any changes you make to the object passed to the callback function.
   * Creates a new metadata file with default values if it doesn't exist or is malformed.
   * Includes retry logic for file system operations.
   * 
   * @param callBack Optional callback function to modify the metadata object
   * @returns The current or modified metadata object
   * @throws {Error} When file system operations fail after retries or for unexpected errors
   * @lastreviewed 2025-09-15
   */
  public async modifyMetaData(callBack?: ((meta: ScriptMetaData) => void)): Promise<ScriptMetaData> {
    const metadataFileUri = this.getMetadataFileUri();
    let contentObj: ScriptMetaData | undefined;
    let modified = false;
    try {
      try {
        await fs().stat(metadataFileUri);
      } catch (e) {
        throw new Err.FileNotFoundError("Metadata file does not exist");
      }
      // Retry mechanism for file reading
      let fileContents: Uint8Array;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          fileContents = await fs().readFile(metadataFileUri);

          // Check if we got valid contents
          if (fileContents && fileContents.length > 0) {
            const fileString = Buffer.from(fileContents).toString('utf-8');

            // Ensure we have a valid JSON string
            if (fileString.trim()) {
              try {
                contentObj = JSON.parse(fileString) as ScriptMetaData;
                break; // Successfully read and parsed
              } catch (jsonError) {
                // JSON parsing error - don't retry, treat as malformed file
                App.logger.warn("Malformed JSON in metadata file, creating new metadata");
                throw new Err.FileReadError("Malformed JSON in metadata file");
              }
            } else {
              // Empty string content - treat as malformed file
              App.logger.warn("Empty content in metadata file, creating new metadata");
              throw new Err.FileReadError("Empty content in metadata file");
            }
          } else {
            // Empty file - treat as malformed file 
            App.logger.warn("Empty metadata file, creating new metadata");
            throw new Err.FileReadError("Empty metadata file");
          }
        } catch (readError) {
          // Check if this is a JSON parsing error or file content error
          if (readError instanceof Err.FileReadError) {
            // Don't retry content/parsing errors, fall through to create new metadata
            throw readError;
          }

          // For other file system errors, retry
          attempts++;
          if (attempts >= maxAttempts) {
            throw readError; // Re-throw if we've exhausted retries
          }
          console.error(`File read error, retrying... (attempt ${attempts}/${maxAttempts}):`, readError);
          await Util.sleep(1_000); // Wait 1000ms before retry
        }
      }

      // If we get here without contentObj, we exhausted retries on file system errors
      if (!contentObj) {
        throw new Err.FileReadError("Failed to read file after multiple attempts");
      }

    } catch (e) {
      App.logger.error("Error reading metadata file: " + e);
      if (!(e instanceof Err.FileNotFoundError) && !(e instanceof Err.FileReadError)) {
        throw e;
      }
      App.logger.warn("Metadata file does not exist or is invalid; creating a new one.");
      contentObj = {
        scriptName: "",
        U: "",
        webdavId: this.webDavId,
        pushPullRecords: []
      };
      modified = true;
    }
    if (callBack) {
      const preModified = JSON.parse(JSON.stringify(contentObj));
      callBack(contentObj);
      Util.isDeepEqual(preModified, contentObj) || (modified = true);
    }
    if (modified) {
      await fs().writeFile(this.getMetadataFileUri(), Buffer.from(JSON.stringify(contentObj, null, 2)));
    }
    return contentObj;
  }

  /**
   * Gets the metadata for the script root.
   * @lastreviewed 2025-09-15
   */
  public async getMetaData(): Promise<ScriptMetaData> {
    return await this.modifyMetaData();
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
        console.trace("downstairs root path:", this.downstairsRootPath);
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
   * Gets the {@link vscode.Uri Uri} for the downstairs organization folder.
   *
   * @todo This will be replaced when we update the org file to use a metadata file
   * @lastreviewed 2025-09-15
   */
  public getOrgUri() {
    return vscode.Uri.file(this.downstairsRootOrgPath.dir + path.sep + this.downstairsRootOrgPath.base);
  }

  /**
   * The WebDAV ID extracted from the file path.
   *
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   * @lastreviewed 2025-09-15
   */
  get webDavId() {
    return this.downstairsRootPath.base;
  }

  /**
   * The domain extracted from the file path.
   *
   * Eventually when this structure is refactored to use a metadata file, so this will
   * not be so trivial.
   * @lastreviewed 2025-09-15
   */
  public get origin() {
    return this.downstairsRootOrgPath.base;
  }


  /**
   * Returns a base URL string suitable for pull and push operations.
   * @lastreviewed 2025-09-15
   */
  public toScriptBaseUpstairsString() {
    return `https://${this.origin}/files/${this.webDavId}/`;
  }

  /**
   * Returns a base {@link URL} suitable for pull and push operations.
   * @lastreviewed 2025-09-15
   */
  public toScriptBaseUpstairsUrl(): URL {
    return new URL(this.toScriptBaseUpstairsString());
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
   * Generic helper to get the contents of a folder.
   * @param folderName The name of the folder to read contents from
   * @returns Array of URIs for files and folders within the specified folder
   * @lastreviewed 2025-09-15
   */
  private async getDraftFolderContents(folderName: typeof ScriptRoot.ScriptContentFolders[number]): Promise<vscode.Uri[]> {
    const folder = this.getDraftFolder().getChildFolder(folderName);
    const dirContents = await fs().readDirectory(folder);
    return dirContents.map(([name, _type]) => vscode.Uri.joinPath(folder.uri(), name));
  }

  /**
   * Gets the info {@link ScriptFolder} in the draft directory.
   */
  public async getInfoFolder() {
    return this.getDraftFolder().getChildFolder("info");
  }

  /**
   * Gets the contents of the info  in the draft directory.
   * @lastreviewed 2025-09-15
   */
  public async getInfoFolderContents() {
    return this.getDraftFolderContents("info");
  }

  /**
   * Gets the scripts {@link ScriptFolder} in the draft directory.
   * @lastreviewed 2025-10-01
   */
  public async getScriptsFolder() {
    return this.getDraftFolder().getChildFolder("scripts");
  }


  /**
   * Gets the {@link vscode.Uri}s of the scripts folder.
   * @lastreviewed 2025-10-01
   */
  public async getScriptsFolderContents() {
    return this.getDraftFolderContents("scripts");
  }

  public async getObjectsFolder() {
    return this.getDraftFolder().getChildFolder("objects");
  }

  /**
   * Gets the {@link vscode.Uri}s of the objects folder.
   * @lastreviewed 2025-10-01
   */
  public async getObjectsFolderContents() {
    return this.getDraftFolderContents("objects");
  }

  /**
   * Determines if this script root is for a file that is in good condition.
   * Validates that the info folder contains exactly 3 required files (metadata.json, permissions.json, config.json)
   * and that the objects folder contains exactly one file (imports.ts).
   * @lastreviewed 2025-10-01
   */
  public async isCopacetic(): Promise<boolean> {
    const infoContent = await this.getInfoFolderContents();
    const objectsContent = await this.getObjectsFolderContents();
    const reasonsWhyBad: string[] = [];
    if (infoContent.length !== 3) {
      reasonsWhyBad.push("`info` folder must have 3 elements");
    }
    SpecialFiles.SCRIPT_FILES.forEach(expectedFile => {
      if (!infoContent.some(file => file.path.endsWith(expectedFile))) {
        reasonsWhyBad.push(`Info folder is missing expected file: ${expectedFile}`);
      }
    });
    if (objectsContent.length !== 1) {
      reasonsWhyBad.push("`objects` folder must have exactly one file");
    }
    if (!objectsContent.map(v => v.path).some(path => path.endsWith("imports.ts"))) {
      reasonsWhyBad.push("`objects` folder must contain an imports.ts file");
    }
    if (reasonsWhyBad.length > 0) {
      App.logger.warn(`Script at ${this.getRootUri().fsPath} is not copacetic:`);
      reasonsWhyBad.forEach(reason => App.logger.warn(` - ${reason}`));
    }
    if (reasonsWhyBad.length === 0) {
      return true;
    }
    App.logger.warn("Script is not copacetic" + reasonsWhyBad.join("; "));
    return false;
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
   * // TODO this is not complete
   */
  public async snapshot() {
    //TODO do a safety check on the hash to prevent deleted files needlessly
    //await this.deleteBuildFolder();
    await this.compileDraftFolder();
  }

  /**
   * Deletes the relevant build folder (e.g. ".build") within the draft directory and its subcomponents.
   * Ignores FileNotFound errors if the folder doesn't exist.
   * 
   * @lastreviewed 2025-10-01
   */
  public async deleteBuildFolder() {
    try {
      return await fs().delete(this.getDraftBuildFolder(), { recursive: true });
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
   * Deletes the existing build folder first, then compiles TypeScript files using {@link ScriptCompiler},
   * copies other relevant files, and cleans up any orphaned files in the build directory.
   * 
   * @lastreviewed 2025-09-15
   */
  public async compileDraftFolder(): Promise<void> {
    //TODO see if we can optimize this to only compile changed files
    await this.deleteBuildFolder();
    const draftFolder = this.getDraftFolder();
    const allDraftFiles = await draftFolder.flatten();
    const compiler = new ScriptCompiler();
    const copiedFiles: string[] = [];
    for (const file of allDraftFiles) {
      if (await file.isFile() && (file as ScriptFile).isMarkdown() ||
        await file.isInItsRespectiveBuildFolder() ||
        await file.isInInfoOrObjects() || // TODO delete this after these folders are obviated
        await file.isFolder()) {
        continue;
      }

      if (file.path().endsWith(".ts") || file.path().endsWith(".tsx")) {
        await compiler.addFile(file);
      } else if (!(file as ScriptFile).isTsConfig()) {
        copiedFiles.push(file.path());
        await file.copyDraftFileToBuild();
      }
    }
    const emittedEntries = await compiler.compile();
    const emittedScriptNodes = emittedEntries.map(e => ScriptFactory.createNode(() => vscode.Uri.file(e)));

    // now we need to delete any files in the build folder(s) that were not emitted by the compiler
    // or copied (like JSON files, js files, etc).
    //TODO at this time (2024-10-01) this is really only serving as a safety check until
    // we stop starting by wholesale deleting the build folder.
    for (const buildNode of emittedScriptNodes) {
      if (await buildNode.isFolder()) {
        continue;
      }
      if (
        !emittedEntries.includes(buildNode.path()) &&
        !copiedFiles.includes(buildNode.path()
          .replace(path.sep + (await buildNode.getBuildFolder()).folderName() + path.sep, path.sep))) {
        App.logger.warn("file detected for deletion" + buildNode.path());
        await buildNode.delete();
      }
    }
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
    return ScriptFactory.createFolder(() => vscode.Uri.joinPath(this.rootUri, "draft"));
  }

  /**
   * Gets the build {@link ScriptFolder} within the draft folder.
   * @lastreviewed 2025-10-01
   */
  public getDraftBuildFolder() {
    return this.getDraftFolder().getChildFolder(".build");
  }

  /**
   * Gets the snapshot {@link ScriptFolder} within the script root.
   * @lastreviewed 2025-10-01
   */
  public getSnapshotFolder() {
    return ScriptFactory.createFolder(() => vscode.Uri.joinPath(this.rootUri, "snapshot"));
  }

  /**
   * Gets the declarations {@link ScriptFolder} within the script root.
   * @lastreviewed 2025-10-01
   */
  public getDeclarationsFolder() {
    return ScriptFactory.createFolder(() => vscode.Uri.joinPath(this.rootUri, "declarations"));
  }

  /**
   * Finds all tsconfig.json files within the draft folder and its subdirectories.
   * 
   * @returns A Promise that resolves to an array of {@link TsConfig} instances
   * @lastreviewed 2025-10-01
   */
  public async findTsConfigFiles(): Promise<TsConfig[]> {
    const tsConfigFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(this.getDraftFolder().uri(), '**/' + TsConfig.NAME));
    return tsConfigFiles.map(f => ScriptFactory.createTsConfig(() => f));
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
        badFiles.push(`${tsConfig.path()}`);
      }
    }
    return badFiles;
  }

  /**
   * Gets all draft folder nodes that are eligible for pushing (excludes build folder contents).
   * 
   * @returns A {@link Promise} that resolves to an array of {@link ScriptNode} instances that can be pushed
   * @lastreviewed 2025-10-01
   */
  public async getPushableDraftNodes(): Promise<ScriptNode[]> {
    const flattened = await this.getDraftFolder().flatten();
    const filtered = [];
    for (const f of flattened) {
      if (!(await f.isInItsRespectiveBuildFolder())) {
        filtered.push(f);
      }
    }
    return filtered;
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
    if (!(await this.isCopacetic())) {
      throw new Err.ScriptNotCopaceticError();
    }
    const badTsFiles = await this.getBadTsFiles();
    if (badTsFiles.length > 0) {
      return `The following tsconfig files are invalid:\n\n${badTsFiles.join("\n")}\n\n
      SPECIFICALLY: ensure that there are no trailing commas in the JSON files; the IDE does not flag this with
      red squigglies, but it renders the JSON invalid and the webapp cannot parse it properly.`;
    }
    return "";
  }
}
