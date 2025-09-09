import * as path from 'path';
import * as vscode from 'vscode';
import { Util } from '..';
import { ScriptMetaData } from '../../../../../types';
import { App } from '../../App';
import { FileDoesNotExistError, FileReadError } from './Errors';
import { DownstairsUrIParser } from './DownstairsUrIParser';

/**
 * object representing the root of an individual script on the filesystem.
 *
 * this originally was the webdavid root file.
 */
export class ScriptRoot {
  static readonly METADATA_FILE = ".b6p_metadata.json";
  downstairsRootPath: path.ParsedPath;
  downstairsRootOrgPath: path.ParsedPath;

  /**
   * we create the script root utilizing any of the children in said script
   * @param param0
   */
  constructor({ childUri }: { childUri: vscode.Uri; }) {
    const parser = new DownstairsUrIParser(childUri);
    const shavedName = parser.getShavedName();
    const scriptPath = path.parse(shavedName); // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase = path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this.downstairsRootPath = scriptPath;
    this.downstairsRootOrgPath = parentDirBase;
  }

  private getMetadataFileUri() {
    const downstairsRoot = this.getDownstairsRootUri();
    return vscode.Uri.joinPath(downstairsRoot, ScriptRoot.METADATA_FILE);
  }
  async touchFile(file: vscode.Uri, touchType: "lastPulled" | "lastPushed"): Promise<void> {
    const metaData = await this.modifyMetaData(md => {
      const existingEntryIndex = md.pushPullRecords.findIndex(entry => entry.downstairsPath === file.fsPath);
      if (existingEntryIndex !== -1) {
        const newDateString = new Date().toUTCString();
        if (file.fsPath.includes("tsconfig.json")) {
          console.log("index", existingEntryIndex);
          console.log("md.pushPullRecords[existingEntryIndex][touchType]", md.pushPullRecords[existingEntryIndex][touchType]);
          console.log("new Date().toUTCString()", newDateString);
        }
        
        md.pushPullRecords[existingEntryIndex][touchType] = newDateString;
        if (file.fsPath.includes("tsconfig.json")) {
          console.log("after", md.pushPullRecords[existingEntryIndex][touchType]);
        }
      } else {
        const now = new Date().toUTCString();
        md.pushPullRecords.push({
          downstairsPath: file.fsPath,
          lastPushed: now,
          lastPulled: now
        });
      }
    });
    if (file.fsPath.includes("tsconfig.json")) {
      console.log("touched metadata:", metaData);
    }
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
        await vscode.workspace.fs.stat(metadataFileUri);
      } catch (e) {
        throw new FileDoesNotExistError("Metadata file does not exist");
      }
      // Retry mechanism for file reading
      let fileContents: Uint8Array;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          fileContents = await vscode.workspace.fs.readFile(metadataFileUri);

          // Check if we got valid contents
          if (fileContents && fileContents.length > 0) {
            const fileString = Buffer.from(fileContents).toString('utf-8');

            // Ensure we have a valid JSON string
            if (fileString.trim()) {
              contentObj = JSON.parse(fileString) as ScriptMetaData;
              break; // Successfully read and parsed
            }
          }

          // If we get here, the file wasn't fully read, wait and retry
          attempts++;
          if (attempts < maxAttempts) {
            console.error(`File read incomplete, retrying... (attempt ${attempts}/${maxAttempts})`);
            await Util.sleep(1000); // Wait 1000ms before retry
          }
        } catch (readError) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw readError; // Re-throw if we've exhausted retries
          }
          console.error(`File read error, retrying... (attempt ${attempts}/${maxAttempts}):`, readError);
          await Util.sleep(1000); // Wait 1000ms before retry
        }
      }

      // If we exhausted all attempts without success, fall through to create new file
      if (attempts >= maxAttempts || !contentObj) {
        throw new FileReadError("Failed to read file after multiple attempts");
      }

    } catch (e) {
      App.logger.error("Error reading metadata file: " + e);
      if (!(e instanceof FileDoesNotExistError)) {
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
      await vscode.workspace.fs.writeFile(this.getMetadataFileUri(), Buffer.from(JSON.stringify(contentObj, null, 2)));
    }
    return contentObj;
  }

  /**
   * Gets the URI for the downstairs root folder.
   * @returns The URI for the downstairs root folder.
   */
  public getDownstairsRootUri() {
    return vscode.Uri.file(this.downstairsRootPath.dir + "/" + this.downstairsRootPath.base);
  }

  public getOrgUri() {
    return vscode.Uri.file(this.downstairsRootOrgPath.dir + "/" + this.downstairsRootOrgPath.base);
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
  public toBasePullPushUrl(): URL {
    return new URL(this.toBaseUpstairsString());
  }

  static fromRootUri(rootUri: vscode.Uri) {
    return new ScriptRoot({ childUri: vscode.Uri.joinPath(rootUri, ScriptRoot.METADATA_FILE) });
  }
}
