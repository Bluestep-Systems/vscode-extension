import * as vscode from 'vscode';
import * as path from 'path';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';

/**
 * A class representing metadata extracted from a file path.
 * 
 * Specifically, we use a local URI from any file within a formula's draft folder
 * to extract the WebDAV ID and domain associated with that formula.
 */
export class ScriptMetaData {

  /**
   * The parsed path of the WebDAV ID folder. This will eventually be replaced/renamed
   * when we refactor to use a metadata file.
   */
  private _webdavId_folderPath: path.ParsedPath;

  /**
   * The parsed path of the domain folder. This will eventually be replaced/renamed
   * when we refactor to use a metadata file.
   */
  private _domain_folderPath: path.ParsedPath;

  private _draft_downstairsUri: vscode.Uri;

  constructor({ downstairsUri }: { downstairsUri: vscode.Uri }) {

    const curUriString = downstairsUri.toString(); // file:///home/brendan/test/extensiontest/configbeh.bluestep.net/1466960/draft/scripts/app.ts
    const shavedName =
      curUriString.substring(`file://`.length, curUriString.indexOf("/draft/"));
    const scriptPath =
      path.parse(shavedName);               // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase =
      path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this._draft_downstairsUri = downstairsUri;
    this._webdavId_folderPath = scriptPath;
    this._domain_folderPath = parentDirBase;
  }

  /**
   * The WebDAV ID extracted from the file path.
   * 
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   */
  private get webDavId() {
    return this._webdavId_folderPath.base;
  }

  /**
   * The domain extracted from the file path.
   * 
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   */
  private get origin() {
    return this._domain_folderPath.base;
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


  /**
   * Returns the local URI of the domain folder.
   * @returns The URI of the domain folder.
   */

  public get_webdavId_folderUri() {
    return vscode.Uri.file(this._webdavId_folderPath.dir + "/" + this._webdavId_folderPath.base);
  }

  /**
   * Returns the URL for the proper upstairs file.
   * @returns Returns the URL for the proper upstairs file.
   */
  public toUpstairsURL(): URL {
    const cUriString = this._draft_downstairsUri.toString();
    const rest = cUriString.substring(cUriString.indexOf("/draft/"));
    const upstairsUrl = new URL(this.toBasePullPushUrl());
    upstairsUrl.pathname = upstairsUrl.pathname + "/draft/" + rest;
    return upstairsUrl;
  }

  /**
   * determines if the local file has been modified since the last push
   * 
   * @returns 
   */
  public async hasBeenModified(): Promise<boolean> {
    //TODO we need to read a metadata file rather than using stat
    return true;
    const stat = await vscode.workspace.fs.stat(this._draft_downstairsUri);
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
}