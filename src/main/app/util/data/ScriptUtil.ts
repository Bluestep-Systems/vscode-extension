import * as vscode from 'vscode';
import * as path from 'path';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { ScriptMetaData } from '../../../../../types';
import { App } from '../../App';
import { Util } from '..';

/**
 * A class representing metadata extracted from a file path.
 * 
 * Specifically, we use a local URI from any file within a formula's draft folder
 * to extract the WebDAV ID and domain associated with that formula.
 */
export class ScriptFile {
  /**
   * The downstairs URI (local file system path).
   */
  public downstairsUri: vscode.Uri;

  /**
   * The script root information.
   */
  private _scriptRoot: ScriptRoot;

  constructor({ downstairsUri }: { downstairsUri: vscode.Uri }) {
    this.downstairsUri = downstairsUri;
    this._scriptRoot = new ScriptRoot({ childUri: downstairsUri });
  }



  /**
   * Returns the URL for the proper upstairs file.
   * @returns Returns the URL for the proper upstairs file.
   */
  public toUpstairsURL(): URL {
    const cUriString = this.downstairsUri.toString();
    const { index, type } = subType(this.downstairsUri);
    if (type === "unknown") {
      throw new Error("Cannot determine the type of this file");
    }
    const upstairsBaseUrl = this.getScriptRoot().toBasePullPushUrl();
    const newUrl = new URL(upstairsBaseUrl);
    newUrl.pathname = upstairsBaseUrl.pathname + cUriString.substring(index + 1);
    return newUrl;
  }



  /**
   * determines if the local file has been modified since the last push
   * 
   * @returns 
   */
  public async hasBeenModified(): Promise<boolean> {
    const stat = await vscode.workspace.fs.stat(this.downstairsUri);
    if (stat.type === vscode.FileType.Directory) {
      throw new Error("Cannot push a directory; please select a file.");
    }
    const response = await SM.fetch(this.toUpstairsURL(), {
      method: "HEAD",
      headers: {
        "Accept": "*/*",
        "If-Modified-Since": new Date(stat.mtime).toUTCString()
      }
    });
    if (response.status === 304) {
      return false;
    }
    return true;
  }

  /**
   * inverse of {@link hasBeenModified}, for readability
   * @returns 
   */
  public async hasNotBeenModified(): Promise<boolean> {
    return !(await this.hasBeenModified());
  }

  /**
   * determines if the file exists or not
   * @returns 
   */
  public async fileExists(): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(this.downstairsUri);
      if (stat.type === vscode.FileType.Directory) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * inverse of {@link fileExists}, for readability
   * @returns 
   */
  public async fileDoesNotExist(): Promise<boolean> {
    return !(await this.fileExists());
  }

  /**
   * produces the file stat, or null if it doesn't exist
   * @returns 
   */
  public async fileStat(): Promise<vscode.FileStat | null> {
    try {
      return await vscode.workspace.fs.stat(this.downstairsUri);
    } catch (e) {
      return null;
    }
  }

  /**
   * the last modified time of the local file
   */
  public async lastModifiedTime(): Promise<number> {
    const stat = await this.fileStat();
    if (!stat) {
      throw new Error("File does not exist");
    }
    return stat.mtime;
  }

  /**
   * get the script root object
   */
  public getScriptRoot() {
    return this._scriptRoot;
  }
}

class ScriptRoot {
  downstairsRootPath: path.ParsedPath;
  downstairsRootOrgPath: path.ParsedPath;



  /**
   * we create the script root utilizing any of the children in said script
   * @param param0 
   */
  constructor({ childUri }: { childUri: vscode.Uri }) {
    const { index } = subType(childUri);
    const curUriString = childUri.toString(); // file:///home/brendan/test/extensiontest/configbeh.bluestep.net/1466960/draft/scripts/app.ts
    const shavedName =
      curUriString.substring(`file://`.length, index);
    const scriptPath =
      path.parse(shavedName);               // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase =
      path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this.downstairsRootPath = scriptPath;
    this.downstairsRootOrgPath = parentDirBase;
  }

  async modifyMetaData(callBack: ((meta: ScriptMetaData) => void)): Promise<ScriptMetaData> {
    const downstairsRoot = this.getOrgUri();
    const metadataFileUri = vscode.Uri.file(downstairsRoot.fsPath + "/.b6p_metadata.json");
    let contentObj: ScriptMetaData;
    let modified = false;
    try {
      await vscode.workspace.fs.stat(metadataFileUri);
      const fileContents = await vscode.workspace.fs.readFile(metadataFileUri);
      const fileString = Buffer.from(fileContents).toString('utf-8');
      contentObj = JSON.parse(fileString) as ScriptMetaData;
    } catch (e) {
      App.logger.warn("Metadata file does not exist; creating a new one.");
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
      await vscode.workspace.fs.writeFile(vscode.Uri.file(downstairsRoot.fsPath + "/.b6p_metadata.json"), Buffer.from(JSON.stringify(contentObj, null, 2)));
    }
    return contentObj;
  }

  public getDownstairsUri() {
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
  public toBasePullPushUrlString() {
    return `https://${this.origin}/files/${this.webDavId}/`;
  }

  /**
   * Returns a base URL suitable for pull and push operations.
   * @returns A base URL suitable for pull and push operations.
   */
  public toBasePullPushUrl(): URL {
    return new URL(this.toBasePullPushUrlString());
  }
}

function subType(downstairsUri: vscode.Uri): { index: number; type: string } {
  const cUriString = downstairsUri.toString();
  const retValue = { index: 0, type: "unknown" };
  if (cUriString.indexOf("/draft/") !== -1) {
    retValue.index = cUriString.indexOf("/draft/");
    retValue.type = "draft";
    return retValue;
  }
  if (cUriString.indexOf("/declarations/") !== -1) {
    retValue.index = cUriString.indexOf("/declarations/");
    retValue.type = "declarations";
    return retValue;
  }
  return retValue;
}