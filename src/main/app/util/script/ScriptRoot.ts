import * as path from 'path';
import * as vscode from 'vscode';
import { Util } from '..';
import { ScriptMetaData } from '../../../../../types';
import { App } from '../../App';
import { FileSystem } from '../fs/FileSystem';
import { DownstairsUriParser } from '../data/DownstairsUrIParser';
import { FileDoesNotExistError, FileReadError } from './Errors';
import { Folder } from './Folder';
import { ScriptFile } from './ScriptFile';
import { ScriptCompiler } from './ScriptCompiler';
import { PathElement } from './PathElement';
const fs = FileSystem.getInstance;

/**
 * Object representing the root of an individual script on the filesystem.
 * 
 * We originally wanted this to extend Folder, however there were some Typescript circular
 * dependency issues in that were difficult to resolve. If at some point in the future
 * Folder is refactored such that it isn't an issue, we can revisit this.
 *
 * This originally was the webdavid root file.
 * @lastreviewed null
 */
export class ScriptRoot implements PathElement {
  private folder: Folder;
  private static readonly ScriptContentFolders = ["info", "scripts", "objects"] as const;
  public static readonly METADATA_FILENAME = ".b6p_metadata.json";
  public static readonly GITIGNORE_FILENAME = ".gitignore";
  readonly downstairsRootPath: path.ParsedPath;
  readonly downstairsRootOrgPath: path.ParsedPath;

  /**
   * Creates a script root utilizing any of the children in said script.
   * 
   * The objective here is to use literally any file within the script's downstairs
   * folder to extrapolate the root of the script.
   * 
   * @param childUri Any file within the downstairs root folder
   * @lastreviewed 2025-09-15
   */
  constructor({ childUri }: { childUri: vscode.Uri; }) {

    const parser = new DownstairsUriParser(childUri);
    const shavedName = parser.getShavedName();
    const scriptPath = path.parse(shavedName);                  // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase = path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this.folder = new Folder(vscode.Uri.file(scriptPath.dir + path.sep + scriptPath.base));
    this.downstairsRootPath = scriptPath;
    this.downstairsRootOrgPath = parentDirBase;
  }
  path(): string {
    throw new Error('Method not implemented.');
  }
  uri(): vscode.Uri {
    throw new Error('Method not implemented.');
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
    return vscode.Uri.joinPath(downstairsRoot, ".gitignore");
  }

  /**
   * Touches a file by updating its last pulled or pushed timestamp.
   * Updates the metadata to track when the file was last synchronized and its hash.
   * 
   * @param file The file to touch
   * @param touchType The type of touch to perform - either "lastPulled" or "lastPushed"
   * @lastreviewed 2025-09-15
   */
  async touchFile(file: ScriptFile, touchType: "lastPulled" | "lastPushed"): Promise<void> {
    const lastHash = await file.getHash();
    const metaData = await this.modifyMetaData(md => {
      const downstairsPath = file.uri().fsPath;
      const existingEntryIndex = md.pushPullRecords.findIndex(entry => entry.downstairsPath === downstairsPath);
      if (existingEntryIndex !== -1) {
        const newDateString = new Date().toUTCString();

        md.pushPullRecords[existingEntryIndex][touchType] = newDateString;
        md.pushPullRecords[existingEntryIndex].lastVerifiedHash = lastHash;
      } else {

        const now = new Date().toUTCString();
        md.pushPullRecords.push({
          downstairsPath,
          lastPushed: touchType === "lastPushed" ? now : null,
          lastPulled: touchType === "lastPulled" ? now : null,
          lastVerifiedHash: lastHash
        });
      }
    });
    App.isDebugMode() && console.log("Updated metadata:", metaData);
    return void 0;
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
        throw new FileDoesNotExistError("Metadata file does not exist");
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
                throw new FileReadError("Malformed JSON in metadata file");
              }
            } else {
              // Empty string content - treat as malformed file
              App.logger.warn("Empty content in metadata file, creating new metadata");
              throw new FileReadError("Empty content in metadata file");
            }
          } else {
            // Empty file - treat as malformed file 
            App.logger.warn("Empty metadata file, creating new metadata");
            throw new FileReadError("Empty metadata file");
          }
        } catch (readError) {
          // Check if this is a JSON parsing error or file content error
          if (readError instanceof FileReadError) {
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
        throw new FileReadError("Failed to read file after multiple attempts");
      }

    } catch (e) {
      App.logger.error("Error reading metadata file: " + e);
      if (!(e instanceof FileDoesNotExistError) && !(e instanceof FileReadError)) {
        throw e;
      }
      App.logger.warn("Metadata file does not exist or is invalid; creating a new one.");
      contentObj = {
        scriptName: "",
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
        throw new FileDoesNotExistError("Gitignore file does not exist at: `" + gitIgnoreUri.fsPath + "`");
      }
      const fileContents = await fs().readFile(gitIgnoreUri);
      const fileString = Buffer.from(fileContents).toString('utf-8');
      currentContents = fileString.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    } catch (e) {
      App.logger.error("Error reading .gitignore file: " + e);
      if (!(e instanceof FileDoesNotExistError)) {
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
    return this.folder.uri();
  }

  /**
   * Gets the URI for the downstairs organization folder.
   *
   * @todo This will be replaced when we update the org file to use a metadata file
   * @lastreviewed null
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
  public toBaseUpstairsString() {
    return `https://${this.origin}/files/${this.webDavId}/`;
  }

  /**
   * Returns a base {@link URL} suitable for pull and push operations.
   * @lastreviewed 2025-09-15
   */
  public toBaseUpstairsUrl(): URL {
    return new URL(this.toBaseUpstairsString());
  }

  /**
   * Creates a ScriptRoot from a root {@link vscode.Uri}.
   * @param rootUri The root {@link vscode.Uri} to create the ScriptRoot from
   * @lastreviewed 2025-09-15
   */
  static fromRootUri(rootUri: vscode.Uri) {
    return new ScriptRoot({ childUri: vscode.Uri.joinPath(rootUri, "/") });
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
   * Gets the contents of the info folder.
   * @lastreviewed 2025-09-15
   */
  public async getInfoFolderContents() {
    return this.getDraftFolderContents("info");
  }

  /**
   * Gets the contents of the scripts folder.
   * @lastreviewed 2025-09-15
   */
  public async getScriptsFolderContents() {
    return this.getDraftFolderContents("scripts");
  }

  /**
   * Gets the contents of the objects folder.
   * @lastreviewed 2025-09-15
   */
  public async getObjectsFolderContents() {
    return this.getDraftFolderContents("objects");
  }

  /**
   * Determines if this script root is for a file that is in good condition.
   * Validates that the info folder contains exactly 3 required files (metadata.json, permissions.json, config.json)
   * and that the objects folder contains exactly one file (imports.ts).
   * @lastreviewed 2025-09-15
   */
  public async isCopacetic(): Promise<boolean> {
    const infoContent = await this.getInfoFolderContents();
    const objectsContent = await this.getObjectsFolderContents();
    const reasonsWhyBad: string[] = [];
    if (infoContent.length !== 3) {
      reasonsWhyBad.push("`info` folder must have 3 elements");
    }
    ["metadata.json", "permissions.json", "config.json"].forEach(expectedFile => {
      if (!infoContent.some(file => file.path.endsWith(expectedFile))) {
        reasonsWhyBad.push(`Info folder is missing expected file: ${expectedFile}`);
      }
    });
    if (objectsContent.length !== 1) {
      reasonsWhyBad.push("`objects` folder must have exactly one file");
    }
    if (!objectsContent[0]?.path.endsWith("imports.ts")) {
      reasonsWhyBad.push("`objects` folder must contain an imports.ts file");
    }
    if (reasonsWhyBad.length > 0) {
      App.logger.warn(`Script at ${this.getRootUri().fsPath} is not copacetic:`);
      reasonsWhyBad.forEach(reason => App.logger.warn(` - ${reason}`));
    }
    return reasonsWhyBad.length === 0;
  }

  /**
   * Checks if this ScriptRoot is morally equivalent to another ScriptRoot.
   * Compares origin, WebDAV ID, downstairs root path, and upstairs URL.
   * 
   * @param b The other ScriptRoot to compare against
   * @lastreviewed 2025-09-15
   */
  equals(b: ScriptRoot) {
    return (
      this.folder.equals(b.folder) &&
      this.origin === b.origin &&
      this.webDavId === b.webDavId &&
      this.toBaseUpstairsString() === b.toBaseUpstairsString()
    );
  }

  public async snapshot() {
    //TODO do a safety check on the hash to prevent deleted files needlessly
    await this.deleteBuildFolder();
    await this.compileTypeScriptInScriptsFolder();
  }

  private async deleteBuildFolder() {
    try {
      return await fs().delete(this.getDraftBuildFolder(), { recursive: true });
    } catch (error) {
      // Ignore FileNotFound errors - the folder doesn't exist, which is fine
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        console.log("Build folder doesn't exist (this is fine)");
        return;
      }
      // Re-throw other errors (like permission issues)
      throw error;
    }
  }

  public async compileTypeScriptInScriptsFolder(): Promise<void> {
    
    const draftFolder = this.getDraftFolder();
    const allFiles = await draftFolder.flatten();
    const compiler = new ScriptCompiler();
    for (const file of allFiles) {
      if (file.path().endsWith(".ts") || file.path().endsWith(".tsx")) {
        await compiler.addFile(file);
      }
    }
    await compiler.compile();
  }

  public getDraftFolder() {
    return this.folder.getChildFolder("draft");
  }

  public getDraftBuildFolder() {
    return this.getDraftFolder().getChildFolder(".build");
  }

  public getSnapshotFolder() {
    return this.folder.getChildFolder("snapshot");
  }
  
  public getDeclarationsFolder() {
    return this.folder.getChildFolder("declarations");
  }
}
