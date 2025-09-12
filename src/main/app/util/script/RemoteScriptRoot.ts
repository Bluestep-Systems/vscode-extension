import * as path from 'path';
import * as vscode from 'vscode';
import { Util } from '..';
import { ScriptMetaData } from '../../../../../types';
import { App } from '../../App';
import { FileDoesNotExistError, FileReadError } from './Errors';
import { DownstairsUriParser } from './DownstairsUrIParser';
import { RemoteScriptFile } from './RemoteScriptFile';
import { FileSystem } from '../fs/FileSystemFactory';
const fs = FileSystem.getInstance;
/**
 * object representing the root of an individual script on the filesystem.
 *
 * this originally was the webdavid root file.
 */
export class RemoteScriptRoot {
  private static specialFolders = ["info", "scripts", "objects"] as const;
  static readonly METADATA_FILE = ".b6p_metadata.json";
  downstairsRootPath: path.ParsedPath;
  downstairsRootOrgPath: path.ParsedPath;

  /**
   * we create the script root utilizing any of the children in said script
   * 
   * The objective here is to use literally any file within the script's downstairs
   * folder to extrapolate the root of the script.
   * 
   * @param childUri any file within the downstairs root folder.
   */
  constructor({ childUri }: { childUri: vscode.Uri; }) {
    const parser = new DownstairsUriParser(childUri);
    const shavedName = parser.getShavedName();
    const scriptPath = path.parse(shavedName);                  // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase = path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this.downstairsRootPath = scriptPath;
    this.downstairsRootOrgPath = parentDirBase;
  }

  /**
   * Gets where the metadata file *should* be located
   * @returns The URI for the metadata file.
   */
  private getMetadataFileUri() {
    const downstairsRoot = this.getDownstairsRootUri();
    return vscode.Uri.joinPath(downstairsRoot, RemoteScriptRoot.METADATA_FILE);
  }

  /**
   * Touches a file by updating its last pulled or pushed timestamp.
   * @param file The file to touch.
   * @param touchType The type of touch to perform.
   * @returns 
   */
  async touchFile(file: RemoteScriptFile, touchType: "lastPulled" | "lastPushed"): Promise<void> {
    const lastHash = await file.getHash();
    const metaData = await this.modifyMetaData(md => {
      const downstairsPath = file.toDownstairsUri().fsPath;
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
   * Gets the metadata for the script root.
   * @returns The metadata for the script root.
   */
  async getMetaData(): Promise<ScriptMetaData> {
    return await this.modifyMetaData();
  }

  /**
   * Modifies the metadata for the script root.
   * it will also save any changes you make to the object passed to the callBack function.
   * @param callBack 
   * @returns 
   */
  async modifyMetaData(callBack?: ((meta: ScriptMetaData) => void)): Promise<ScriptMetaData> {
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
   * Gets the URI for the downstairs root folder.
   * @returns The URI for the downstairs root folder.
   */
  public getDownstairsRootUri() {
    return vscode.Uri.file(this.downstairsRootPath.dir + path.sep + this.downstairsRootPath.base);
  }

  public getOrgUri() {
    return vscode.Uri.file(this.downstairsRootOrgPath.dir + path.sep + this.downstairsRootOrgPath.base);
  }

  /**
   * The WebDAV ID extracted from the file path.
   *
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   */
  get webDavId() {
    return this.downstairsRootPath.base;
  }

  /**
   * The domain extracted from the file path.
   *
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   */
  public get origin() {
    return this.downstairsRootOrgPath.base;
  }


  /**
   * Returns a base URL suitable for pull and push operations.
   * @returns A base URL suitable for pull and push operations.
   */
  public toBaseUpstairsString() {
    return `https://${this.origin}/files/${this.webDavId}/`;
  }

  /**
   * Returns a base URL suitable for pull and push operations.
   * @returns A base URL suitable for pull and push operations.
   */
  public toBaseUpstairsUrl(): URL {
    return new URL(this.toBaseUpstairsString());
  }

  /**
   * Creates a ScriptRoot from a root URI.
   * @param rootUri The root URI to create the ScriptRoot from.
   * @returns A new ScriptRoot instance.
   */
  static fromRootUri(rootUri: vscode.Uri) {
    return new RemoteScriptRoot({ childUri: vscode.Uri.joinPath(rootUri, RemoteScriptRoot.METADATA_FILE) });
  }

  /**
   * Generic helper to get a folder URI under the downstairs root.
   */
  private getFolderUri(folderName: typeof RemoteScriptRoot.specialFolders[number]) {
    return vscode.Uri.joinPath(this.getDownstairsRootUri(), "draft", folderName);
  }

  /**
   * Generic helper to get the contents of a folder.
   */
  private async getFolderContents(folderName: typeof RemoteScriptRoot.specialFolders[number]): Promise<vscode.Uri[]> {
    const folderUri = this.getFolderUri(folderName);
    const dirContents = await fs().readDirectory(folderUri);
    return dirContents.map(([name, _type]) => vscode.Uri.joinPath(folderUri, name));
  }

  
  /**
   * Gets the contents of the info folder.
   */
  public async getInfoFolder() {
    return this.getFolderContents("info");
  }
  
  /**
   * Gets the contents of the scripts folder.
   */
  public async getScriptsFolder() {
    return this.getFolderContents("scripts");
  }
  
  /**
   * Gets the contents of the objects folder.
   */
  public async getObjectsFolder() {
    return this.getFolderContents("objects");
  }

  /**
   * determines if this script root is for a file that is in good condition
   */
  public async isCopacetic(): Promise<boolean> {
    const infoContent = await this.getInfoFolder();
    const objectsContent = await this.getObjectsFolder();
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
      App.logger.warn(`Script at ${this.getDownstairsRootUri().fsPath} is not copacetic:`);
      reasonsWhyBad.forEach(reason => App.logger.warn(` - ${reason}`));
    }
    return reasonsWhyBad.length === 0;
  }

  /**
   * Checks if this ScriptRoot is morally equivalent to another ScriptRoot.
   * @param b The other ScriptRoot to compare against.
   * @returns True if the ScriptRoots are equal, false otherwise.
   */
  equals(b: RemoteScriptRoot) {
    return (
      this.origin === b.origin &&
      this.webDavId === b.webDavId &&
      this.getDownstairsRootUri().fsPath === b.getDownstairsRootUri().fsPath &&
      this.toBaseUpstairsString() === b.toBaseUpstairsString()
    );
  }
}
