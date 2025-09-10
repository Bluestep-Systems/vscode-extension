import * as vscode from 'vscode';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { DownstairsUriParser } from './DownstairsUrIParser';
import { RemoteScriptRoot } from './RemoteScriptRoot';
import { App } from '../../App';
import * as fs from 'fs/promises';

/**
 * A class representing metadata extracted from a file path.
 * 
 * Specifically, we use a local URI from any file within a formula's draft folder
 * to extract the WebDAV ID and domain associated with that formula.
 */
export class RemoteScriptFile {
  /**
   * The downstairs URI (local file system path).
   */
  private parser: DownstairsUriParser;

  /**
   * The downstairs root object.
   */
  private _scriptRoot: RemoteScriptRoot;

  /**
   * Creates a ScriptFile instance.
   * 
   * @param param0 The downstairs URI (local file system path).
   */
  constructor({ downstairsUri }: { downstairsUri: vscode.Uri }) {
    this.parser = new DownstairsUriParser(downstairsUri);
    this._scriptRoot = new RemoteScriptRoot({ childUri: downstairsUri });
  }

  /**
   * Returns the URL for the proper upstairs file.
   * @returns Returns the URL for the proper upstairs file.
   */
  public toUpstairsURL(): URL {
    if (this.parser.type === "metadata") {
      console.trace();
      throw new Error("Cannot determine the type of this file");
    }
    const upstairsBaseUrl = this.getScriptRoot().toBaseUpstairsUrl();
    const newUrl = new URL(upstairsBaseUrl);
    newUrl.pathname = upstairsBaseUrl.pathname + this.parser.type + "/" + this.parser.rest;
    return newUrl;
  }

  /**
   * gets the downstairs (local) URI for this file
   * @returns 
   */
  public toDownstairsUri() {
    return vscode.Uri.joinPath(this.getScriptRoot().getDownstairsRootUri(), this.parser.type, this.parser.rest);
  }

  /**
   * determines if the local file has been modified since last push
   * 
   * @returns 
   */
  public async getUpstairsLastModified(): Promise<Date> {

    const response = await SM.fetch(this.toUpstairsURL(), {
      method: "HEAD",
      headers: {
        "Accept": "*/*",
      }
    });
    const lastModifiedHeaderValue = response.headers.get("Last-Modified");
    if (!lastModifiedHeaderValue) {
      throw new Error("Could not determine last modified time");
    }
    return new Date(lastModifiedHeaderValue);
  }

  public async shouldPush(): Promise<boolean> {
    return !(await this.integrityMatches());
  }
  public async getHash(): Promise<string> {
    const bufferSource = await fs.readFile(this.toDownstairsUri().fsPath);
    const localHashBuffer = await crypto.subtle.digest('SHA-512', bufferSource);
    const hexArray = Array.from(new Uint8Array(localHashBuffer));
    if (hexArray.length !== 64) {
      throw new Error("Could not compute hash of local file");
    }
    return hexArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  public async integrityMatches(): Promise<boolean> {
    const hashHex = await this.getHash();
    return hashHex === await this.getUpstairsHash();
  }

  public async getUpstairsHash(): Promise<string> {
    const response = await SM.fetch(this.toUpstairsURL(), {
      method: "GET",
      headers: {
        "Accept": "*/*",
      }
    });
    return response.headers.get("etag")?.toLowerCase() || (() => { throw new Error("Could not determine etag"); })();
  }

  public async getDownstairsContent(): Promise<string> {
    const downstairsUri = this.toDownstairsUri();
    try {
      const fileData = await vscode.workspace.fs.readFile(downstairsUri);
      return Buffer.from(fileData).toString('utf8');
    } catch (e) {
      if (e instanceof Error || typeof e === 'string') {
        App.logger.error(e);
      } else {
        App.logger.error(`Error reading downstairs file: ${e}`);
      }
      throw new Error(`Error reading downstairs file: ${e}`);
    }
  }

  public async getUpstairsContent(): Promise<string> {
    const response = await SM.fetch(this.toUpstairsURL(), {
      method: "GET",
      headers: {
        "Accept": "*/*",
      }
    });
    if (response.status >= 400) {
      throw new Error(`Error fetching upstairs file: ${response.status} ${response.statusText}`);
    }
    return await response.text();
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
 * Downloads the file from the upstairs location. If the download is successful, it writes the content to the local file system.
 * @returns 
 */
  public async download(): Promise<Response> {
    const lookupUri = this.toUpstairsURL();
    App.logger.info("downloading from:" + lookupUri);
    const response = await SM.fetch(lookupUri, {
      method: "GET",
      headers: {
        "Accept": "*/*",
      }
    });
    if (response.status >= 400) {
      App.logger.error(`Error fetching file ${lookupUri.toString()}: ${response.status} ${response.statusText}`);
      throw new Error(`Error fetching file ${lookupUri.toString()}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await this.writeContent(buffer);
    //uncomment when etag code is changed
    // if (!(await this.getHash() === response.headers.get("etag")?.toLowerCase())) {
    //   console.log(await this.getHash(), response.headers.get("etag")?.toLowerCase());
    //   throw new Error("Downloaded file hash does not match upstairs hash, disk corruption detected");
    // }
    await this.getScriptRoot().touchFile(this, "lastPulled");
    return response;
  }

  public async writeContent(buffer: ArrayBuffer) {
    await vscode.workspace.fs.writeFile(this.toDownstairsUri(), Buffer.from(buffer));
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
  public async lastModifiedTime(): Promise<Date> {
    const stat = await this.fileStat();
    if (!stat) {
      throw new Error("File does not exist");
    }
    return new Date(stat.mtime);
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
  public async getLastPushedTimeStr(): Promise<string | null> {
    const md = await this.getScriptRoot().getMetaData();
    return md.pushPullRecords.find(record => record.downstairsPath === this.toDownstairsUri().fsPath)?.lastPushed || null;
  }

  public async getLastPushedTime(): Promise<Date | null> {
    const lastPushedStr = await this.getLastPushedTimeStr();
    if (!lastPushedStr) {
      return null;
    }
    return new Date(lastPushedStr);
  }

  /**
   * overwrites the script root for this file
   * 
   * be mindful, because it becomes easy to create inconsistencies
   * @param root 
   * @returns 
   */
  withScriptRoot(root: RemoteScriptRoot) {
    this._scriptRoot = root;
    if (this.parser.type === "metadata") {
      throw new Error("Cannot overwrite script root of a metadata file");
    }
    return this;
  }

}


