import * as vscode from 'vscode';
import * as path from 'path';


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

  constructor({ curUri }: { curUri: vscode.Uri }) {

    const curUriString = curUri.toString(); // file:///home/brendan/test/extensiontest/configbeh.bluestep.net/1466960/draft/scripts/app.ts
    const shavedName = 
      curUriString.substring(`file://`.length, curUriString.indexOf("/draft/"));
    const scriptPath = 
      path.parse(shavedName);               // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase = 
      path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }

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
  
}