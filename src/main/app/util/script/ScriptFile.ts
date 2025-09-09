import * as vscode from 'vscode';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { DownstairsUriParser } from './DownstairsUrIParser';
import { ScriptRoot } from './ScriptRoot';

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
  private parser: DownstairsUriParser;

  /**
   * The downstairs root object.
   */
  private _scriptRoot: ScriptRoot;

  constructor({ downstairsUri }: { downstairsUri: vscode.Uri }) {
    this.parser = new DownstairsUriParser(downstairsUri);
    this._scriptRoot = new ScriptRoot({ childUri: downstairsUri });
  }

  /**
   * Returns the URL for the proper upstairs file.
   * @returns Returns the URL for the proper upstairs file.
   */
  public toUpstairsURL(): URL {
    console.log('this.parser', this.parser);
    if (this.parser.type === "metadata") {
      console.trace();
      throw new Error("Cannot determine the type of this file");
    }
    const upstairsBaseUrl = this.getScriptRoot().toBaseUpstairsUrl();
    const newUrl = new URL(upstairsBaseUrl);
    newUrl.pathname = upstairsBaseUrl.pathname + this.parser.type + "/" + this.parser.rest;
    return newUrl;
  }

  public toDownstairsUri() {
    return vscode.Uri.joinPath(this.getScriptRoot().getDownstairsRootUri(), this.parser.type, this.parser.rest);
  }

  /**
   * determines if the local file has been modified since last push
   * 
   * @returns 
   */
  public async hasBeenModified(): Promise<boolean> {
    const stat = await this.fileStat();
    if (!stat) {
      // file doesn't exist, so it has been "modified" in the sense that we need to push it
      return true;
    }
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
      const stat = await vscode.workspace.fs.stat(this.toDownstairsUri());
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
      return await vscode.workspace.fs.stat(this.toDownstairsUri());
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

  /**
   * Gets the last pulled time for the script file.
   * @returns The last pulled time as a string, or null if not found.
   */
  public async getLastPulledTime(): Promise<string | null> {
    const md = await this.getScriptRoot().getMetaData();
    return md.pushPullRecords.find(record => record.downstairsPath === this.toDownstairsUri().fsPath)?.lastPulled || null;
  }

  /**
   * Gets the last pushed time for the script file.
   * @returns The last pushed time as a string, or null if not found.
   */
  public async getLastPushedTime(): Promise<string | null> {
    const md = await this.getScriptRoot().getMetaData();
    return md.pushPullRecords.find(record => record.downstairsPath === this.toDownstairsUri().fsPath)?.lastPushed || null;
  }

  /**
   * overwrites the script root for this file
   * 
   * be mindful, because it becomes easy to create inconsistencies
   * @param root 
   * @returns 
   */
  withScriptRoot(root: ScriptRoot) {
    this._scriptRoot = root;
    if (this.parser.type === "metadata") {
      throw new Error("Cannot overwrite script root of a metadata file");
    }
    return this;
  }

}


