import * as vscode from 'vscode';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { ScriptRoot } from './ScriptRoot';
import { DownstairsUrIParser } from './DownstairsUrIParser';

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
    const parser = new DownstairsUrIParser(this.downstairsUri);
    if (parser.type === "metadata") {
      throw new Error("Cannot determine the type of this file");
    }
    const upstairsBaseUrl = this.getScriptRoot().toBasePullPushUrl();
    const newUrl = new URL(upstairsBaseUrl);
    newUrl.pathname = upstairsBaseUrl.pathname + parser.type + "/" +parser.rest;
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


