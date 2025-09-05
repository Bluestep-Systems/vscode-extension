import * as vscode from 'vscode';
import * as path from 'path';

//file:///home/brendan/test/extensiontest/bst3.bluestep.net/1433413/draft/scripts/app.ts
//file:///home/brendan/test/extensiontest


/**
 * A class representing metadata extracted from a file path.
 * 
 * Specifically, we use a local URI from any file within a formula's draft folder
 * to extract the WebDAV ID and domain associated with that formula.
 */
export class FileMetaData {

  private _webdavIdFolder: path.ParsedPath;
  private _domainfolder: path.ParsedPath;

  constructor({ curUri }: { curUri: vscode.Uri }) {

    const curUriString = curUri.toString(); // file:///home/brendan/test/extensiontest/configbeh.bluestep.net/1466960/draft/scripts/app.ts
    const shavedName = 
      curUriString.substring(`file://`.length, curUriString.indexOf("/draft/"));
    const scriptPath = 
      path.parse(shavedName);               // { root: '/', dir: '/home/brendan/test/extensiontest/configbeh.bluestep.net', base: '1466960', ext: '', name: '1466960'}
    const parentDirBase = 
      path.parse(path.dirname(shavedName)); // { root: '/', dir: '/home/brendan/test/extensiontest', base: 'configbeh.bluestep.net', ext: '.net', name: 'configbeh.bluestep' }
    this._webdavIdFolder = scriptPath;
    this._domainfolder = parentDirBase;
  }

  /**
   * The WebDAV ID extracted from the file path.
   * 
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   */
  private get webDavId() {
    return this._webdavIdFolder.base;
  }

  /**
   * The domain extracted from the file path.
   * 
   * Eventually when this structure is refactored to use a metadata file, this will
   * not be so trivial.
   */
  private get origin() {
    return this._domainfolder.base;
  }

  /**
   * Returns a base URL suitable for pull and push operations.
   * @returns A base URL suitable for pull and push operations.
   */
  public toBasePullPushUrlString() {
    return `https://${this.origin}/files/${this.webDavId}/`;
  }

  public toBasePullPushUrl(): URL {
    return new URL(this.toBasePullPushUrlString());
  }
}