import * as vscode from 'vscode';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { DownstairsUriParser } from './DownstairsUrIParser';
import { RemoteScriptRoot } from './RemoteScriptRoot';
import { App } from '../../App';
import { readFileText } from '../data/readFile';
import * as path from 'path';
import { ConfigJsonContent, MetaDataJsonFileContent } from '../../../../../types';
import { FileSystem } from '../fs/FileSystemFactory';
import { GlobMatcher } from '../data/GlobMatcher';
const fs = FileSystem.getInstance;

/**
 * A class representing metadata extracted from a file path.
 *
 * Specifically, we use a local {@link vscode.Uri} from any file within a formula's draft folder
 * to extract the WebDAV ID and domain associated with that formula.
 * @lastreviewed 2025-09-15
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
   * Regex specifically for myassn document key patterns:
   */
  private static ComplexEtagPattern = /^"?\d{10,13}-\{.*?"class":\s*"myassn\.document\.(Proxy|LibraryServlet)MemoryDocumentKey".*?"classId":\s*\d+.*?\}"?$/;

  /**
   * Regex for standard etags (SHA-512 hashes).
   */
  private static EtagPattern = /^"[a-f0-9]{128}"$/;

  /**
   * Regex for "weak" etags (SHA-512 hashes).
   */
  private static WeakEtagPattern = /^W\/"[a-f0-9]{128}"$/;

  /**
   * Creates a {@link RemoteScriptFile} instance in addition to its associated {@link RemoteScriptRoot} object.
   * 
   * @param param0 Object containing the downstairs URI (local file system path)
   * @param param0.downstairsUri The local file system URI for this script file
   * @lastreviewed 2025-09-15
   */
  constructor({ downstairsUri }: { downstairsUri: vscode.Uri }) {
    this.parser = new DownstairsUriParser(downstairsUri);
    this._scriptRoot = new RemoteScriptRoot({ childUri: downstairsUri });
  }

  /**
   * Returns the {@link URL} for the proper upstairs file.
   * Constructs the appropriate WebDAV {@link URL} based on the file type (root, metadata, declarations, or draft).
   * @lastreviewed 2025-09-15
   */
  public toUpstairsURL(): URL {

    const upstairsBaseUrl = this.getScriptRoot().toBaseUpstairsUrl();
    const newUrl = new URL(upstairsBaseUrl);
    if (this.parser.type === "root") {
      return newUrl;
    } else if (this.parser.type === "metadata") {
      const fileName = this.getFileName();
      if (fileName === RemoteScriptRoot.METADATA_FILE) {
        throw new Error(`should never try to convert ${RemoteScriptRoot.METADATA_FILE} file to upstairs URL. Review logic on how you got here.`);
      }
      newUrl.pathname = upstairsBaseUrl.pathname + fileName;
    } else if (this.parser.isDeclarationsOrDraft()) {
      newUrl.pathname = upstairsBaseUrl.pathname + this.parser.type + "/" + this.parser.rest;
    } else {
      throw new Error(`unexpected type: \`${this.parser.type}\`, cannot convert to upstairs URL`);
    }

    return newUrl;
  }

  /**
   * Gets the downstairs (local) {@link vscode.Uri} for this file
   * @lastreviewed 2025-09-15
   */
  public toDownstairsUri() {
    return this.parser.rawUri;
  }

  /**
   * Produces the last modified {@link Date} of the upstairs object
   * @lastreviewed 2025-09-15
   */
  public async getUpstairsLastModified(): Promise<Date> {

    const response = await SM.fetch(this.toUpstairsURL(), {
      method: "HEAD"
    });
    const lastModifiedHeaderValue = response.headers.get("Last-Modified");
    if (!lastModifiedHeaderValue) {
      throw new Error("Could not determine last modified time");
    }
    return new Date(lastModifiedHeaderValue);
  }

  /**
   * Determines a reason to not push this file upstairs.
   * Checks various conditions including metadata files, declarations, external models, 
   * .gitignore patterns, info/objects folders, and integrity matching.
   * 
   * @param ops.upstairsOverride Optional override URL to check against instead of the default upstairs URL
   * @returns Empty string if the file can be pushed, otherwise a descriptive reason why not
   * @lastreviewed 2025-09-15
   */
  public async getReasonToNotPush(ops?: { upstairsOverride?: URL }): Promise<string> {

    if (this.parser.type === "root") {
      return "File is the root folder";
    }
    if (this.getFileName() === RemoteScriptRoot.METADATA_FILE) {
      return "File is a metadata file";
    }
    if (this.isInDeclarations()) {
      return "File is in declarations";
    }
    if (await this.isExternalModel()) {
      return "File is an external model";
    }
    if (await this.isInGitIgnore()) {
      return "File is ignored by .gitignore";
    }
    if (await this.isInInfoOrObjects()) {
      return "File is in info or objects";
    }
    if (await this.integrityMatches(ops)) {
      return "File integrity matches";
    }
    return "";
  }

  /**
   * Gets the lowercased SHA-512 hash of the local file.
   * @lastreviewed 2025-09-15
   */
  public async getHash(): Promise<string> {
    const bufferSource = await fs().readFile(this.toDownstairsUri());
    const localHashBuffer = await crypto.subtle.digest('SHA-512', bufferSource);
    const hexArray = Array.from(new Uint8Array(localHashBuffer));
    if (hexArray.length !== 64) {
      throw new Error("Could not compute hash of local file");
    }
    return hexArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }

  /**
   * Checks if the local file's integrity matches the upstairs file.
   * Compares SHA-512 hashes between local and remote versions.
   * 
   * @param ops.upstairsOverride Optional override {@link URL} to check against instead of the default upstairs {@link URL}
   * @lastreviewed 2025-09-15
   */
  public async integrityMatches(ops?: { upstairsOverride?: URL }): Promise<boolean> {
    const localHash = await this.getHash();
    const upstairsHash = await this.getUpstairsHash(ops);
    const matches = localHash === upstairsHash;
    App.isDebugMode() && console.log("matches:", matches, "local:", localHash, "upstairs:", upstairsHash);
    return matches;
  }

  /**
   * Gets the hash of the upstairs file, or `null` if it doesn't exist.
   * Extracts SHA-512 hash from the ETag header, handling both standard and weak ETags.
   * Complex ETags (from memory documents) are not supported and return null.
   * 
   * @param ops.required If true, throws an error when upstairs hash cannot be determined
   * @param ops.upstairsOverride Optional override URL to check instead of the default upstairs URL
   * @returns The SHA-512 hash string in lowercase, or `null` if file doesn't exist or has complex ETag
   * @lastreviewed 2025-09-15
   */
  public async getUpstairsHash(ops?: { required?: boolean, upstairsOverride?: URL }): Promise<string | null> {
    const response = await SM.fetch(ops?.upstairsOverride || this.toUpstairsURL(), {
      method: "HEAD"
    });
    const etagHeader = response.headers.get("etag");

    //some etags will come back with a complex pattern (the memory documents) and so we skip the etag check on them
    let etag: string | null = null;
    if (RemoteScriptFile.EtagPattern.test(etagHeader || "")) {
      etag = JSON.parse(etagHeader?.toLowerCase() || "null");
    } else if (RemoteScriptFile.WeakEtagPattern.test(etagHeader || "")) {
      // weak etags are prefixed with W/ and we ignore the weakness for our purposes
      App.isDebugMode() && console.log("weak etagHeader:", etagHeader);
      etag = JSON.parse(etagHeader?.substring(2).toLowerCase() || "null");
    } else {
      App.isDebugMode() && console.log("complex etagHeader:", etagHeader);
    }
    if (!etag) {
      if (ops?.required) {
        throw new Error("Could not determine required upstairs hash");
      }
      //TODO determine if there is a legitimate reason that this could be undefined and we should throw an error instead
      // otherwise we can only assume it just doesn't exist upstairs
      return null;
    }
    return etag.toLowerCase();
  }

  /**
   * Gets the content of the local file as UTF-8 text.
   * @lastreviewed 2025-09-15
   */
  public async getDownstairsContent(): Promise<string> {
    const downstairsUri = this.toDownstairsUri();
    try {
      const fileData = await fs().readFile(downstairsUri);
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

  /**
   * Gets the content of the upstairs file as text.
   * @throws {Error} When the upstairs file returns a 400+ status code
   * @lastreviewed 2025-09-15
   */
  public async getUpstairsContent(): Promise<string> {
    const response = await SM.fetch(this.toUpstairsURL(), {
      method: "GET",
      headers: {
        "Accept": "*/*",
      }
    });
    if (response.status >= 400) {
      throw new Error(`Error fetching upstairs file. Status: ${response.status}.\n ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Removes this file's record from the metadata push/pull tracking.
   * @lastreviewed 2025-09-15
   */
  private async deleteFromMetadata() {
    await this.getScriptRoot().modifyMetaData((md) => {
      const index = md.pushPullRecords.findIndex(record => record.downstairsPath === this.toDownstairsUri().fsPath);
      if (index !== -1) {
        md.pushPullRecords.splice(index, 1);
      }
    });
  }

  /**
   * Downloads the file from the upstairs location and writes it to the local file system.
   * Performs integrity verification using ETag headers and updates the lastPulled timestamp.
   * Skips download if the file is in .gitignore and removes it from metadata instead.
   * 
   * @returns Response object with status 418 if file is in .gitignore, otherwise the actual HTTP response
   * @throws {Error} When the download fails, integrity verification fails, or ETag parsing fails
   * @lastreviewed 2025-09-15
   */
  public async download(): Promise<Response> {
    const ignore = await this.isInGitIgnore();
    if (ignore) {
      App.logger.info(`not downloading \`${this.getFileName()}\` because in .gitignore`);
      await this.deleteFromMetadata();
      return new Response("", { status: 418 });
    }
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
    const etagHeader = response.headers.get("etag");

    //TODO merge this with the other etag parsing code elsewhere in this class
    //some etags will come back with a complex pattern (the memory documents) and so we skip the etag check on them
    if (RemoteScriptFile.EtagPattern.test(etagHeader || "")) {
      const etag = JSON.parse(etagHeader?.toLowerCase() || "null");
      const hash = await this.getHash();
      if (hash !== etag) {
        throw new Error("Downloaded file hash does not match upstairs hash, disk corruption detected");
      }
    } else if (RemoteScriptFile.WeakEtagPattern.test(etagHeader || "")) {
      // weak etags are prefixed with W/ and we ignore the weakness for our purposes
      App.isDebugMode() && console.log("weak etagHeader:", etagHeader);
      const etag = JSON.parse(etagHeader?.substring(2).toLowerCase() || "null");
      const hash = await this.getHash();
      if (hash !== etag) {
        throw new Error("Downloaded file hash does not match upstairs hash, disk corruption detected");
      }
    } else if (RemoteScriptFile.ComplexEtagPattern.test(etagHeader || "")) {
      App.isDebugMode() && console.log("complex etagHeader:", etagHeader);
      // complex etags are from the illusory document files and we skip the integrity check on them
    } else {
      throw new Error(`Could not parse upstairs etag; \`${etagHeader}\`,\n cannot verify integrity`);
    }

    // touch the lastPulled time
    await this.getScriptRoot().touchFile(this, "lastPulled");
    return response;
  }

  /**
   * Writes binary content to the local file.
   * @param buffer The binary content to write to the file
   * @lastreviewed 2025-09-15
   */
  public async writeContent(buffer: ArrayBuffer) {
    await fs().writeFile(this.toDownstairsUri(), Buffer.from(buffer));
  }

  /**
   * Determines if the file exists and corresponds to an actual file (not a directory).
   * Metadata files are considered to always exist.
   * @lastreviewed 2025-09-15
   */
  public async exists(): Promise<boolean> {
    try {
      if (this.parser.type === "metadata") {
        return true;
      }
      const stat = await fs().stat(this.toDownstairsUri());
      if (stat.type === vscode.FileType.Directory) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Inverse of {@link exists}, for readability.
   * @lastreviewed 2025-09-15
   */
  public async fileDoesNotExist(): Promise<boolean> {
    return !(await this.exists());
  }

  /**
   * Produces the file stat, or `null` if it doesn't exist.
   * @lastreviewed 2025-09-15
   */
  public async fileStat(): Promise<vscode.FileStat | null> {
    try {
      return await fs().stat(this.toDownstairsUri());
    } catch (e) {
      return null;
    }
  }

  /**
   * The last modified time of the local file.
   * @throws {Error} When the file does not exist
   * @lastreviewed 2025-09-15
   */
  public async lastModifiedTime(): Promise<Date> {
    const stat = await this.fileStat();
    if (!stat) {
      throw new Error("File does not exist");
    }
    return new Date(stat.mtime);
  }

  /**
   * Get the {@link RemoteScriptRoot} object for this file.
   * @lastreviewed 2025-09-15
   */
  public getScriptRoot() {
    return this._scriptRoot;
  }

  /**
   * Gets the last pulled time for the script file as a string in UTC format, or `null` if not found
   * in the metadata object.
   * @lastreviewed 2025-09-15
   */
  public async getLastPulledTimeStr(): Promise<string | null> {
    const md = await this.getScriptRoot().getMetaData();
    return md.pushPullRecords.find(record => record.downstairsPath === this.toDownstairsUri().fsPath)?.lastPulled || null;
  }

  /**
   * Gets the last pulled time for the script file as a {@link Date}, or `null` if not found in the
   * metadata object.
   * @lastreviewed 2025-09-15
   */
  public async getLastPulledTime(): Promise<Date | null> {
    const lastPulledStr = await this.getLastPulledTimeStr();
    if (!lastPulledStr) {
      return null;
    }
    return new Date(lastPulledStr);
  }

  /**
   * Gets the last pushed time for the script file in UTC format, or `null` if not found
   * in the metadata object.
   * @lastreviewed 2025-09-15
   */
  public async getLastPushedTimeStr(): Promise<string | null> {
    const md = await this.getScriptRoot().getMetaData();
    return md.pushPullRecords.find(record => record.downstairsPath === this.toDownstairsUri().fsPath)?.lastPushed || null;
  }

  /**
   * Gets the last pushed time for the script file as a {@link Date}, or `null` if not
   * found in the metadata object.
   * @lastreviewed 2025-09-15
   */
  public async getLastPushedTime(): Promise<Date | null> {
    const lastPushedStr = await this.getLastPushedTimeStr();
    if (!lastPushedStr) {
      return null;
    }
    return new Date(lastPushedStr);
  }

  /**
   * Overwrites the script root for this file.
   *
   * Be mindful, because it becomes easy to create inconsistencies since the underlying file may not even exist.
   * @param root The new script root
   * @returns The updated script file
   * @throws {Error} When attempting to overwrite script root of a metadata file
   * @lastreviewed 2025-09-15
   */
  withScriptRoot(root: RemoteScriptRoot): RemoteScriptFile {
    this._scriptRoot = root;
    //TODO determine if this if-check is even neccessary
    if (this.parser.type === "metadata") {
      throw new Error("Cannot overwrite script root of a metadata file");
    }
    return this;
  }

  /**
   * Overwrites the parser for the script file.
   *
   * Be mindful, because it becomes easy to create inconsistencies since the underlying file may not even exist.
   * @param parser The parser to set
   * @returns The updated script file
   * @lastreviewed 2025-09-15
   */
  withParser(parser: DownstairsUriParser): RemoteScriptFile {
    this.parser = parser;
    return this;
  }

  /**
   * Compares this script file to another for equality.
   * @param other The other script file to compare against
   * @lastreviewed 2025-09-15
   */
  public equals(other: RemoteScriptFile): boolean {
    return this._scriptRoot.equals(other._scriptRoot) &&
      this.parser.equals(other.parser);
  }

  /**
   * Generic method to find and parse a JSON configuration file.
   * @param fileName The name of the file to search for
   * @returns The parsed JSON content
   * @throws {Error} When the file is not found or multiple files are found
   * @lastreviewed 2025-09-15
   */
  private async getConfigurationFile<T>(fileName: string): Promise<T> {
    const files = await fs().findFiles(new vscode.RelativePattern(this._scriptRoot.getDownstairsRootUri(), `**/${fileName}`));
    if (!files || files.length !== 1) {
      throw new Error(`Could not find ${fileName} file, found: ${files ? files.length : 'none'}`);
    }
    const configFileUri = files[0];
    const configFileContent = await readFileText(configFileUri);
    const config = JSON.parse(configFileContent) as T;
    return config;
  }

  /**
   * Gets the configuration file for the script.
   * @lastreviewed 2025-09-15
   */
  public async getConfigFile(): Promise<ConfigJsonContent> {
    return this.getConfigurationFile<ConfigJsonContent>('config.json');
  }

  /**
   * Determines if the file is an external model.
   * 
   * External models are defined in the config.json file, and are not to be pushed or pulled.
   * @lastreviewed 2025-09-15
   */
  public async isExternalModel(): Promise<boolean> {
    const config = await this.getConfigFile();
    if (config.models?.map(m => m.name).includes(this.getFileName())) {
      return true;
    }
    return false;
  }

  /**
   * Gets the metadata file for the script.
   * @lastreviewed 2025-09-15
   */
  public async getMetadataFile(): Promise<MetaDataJsonFileContent> {
    return this.getConfigurationFile<MetaDataJsonFileContent>('metadata.json');
  }

  /**
   * Gets the file name from the downstairs URI.
   * @lastreviewed 2025-09-15
   */
  public getFileName(): string {
    return path.parse(this.toDownstairsUri().fsPath).base;
  }

  /**
   * Checks if the script file is in the declarations folder.
   * @lastreviewed 2025-09-15
   */
  public isInDeclarations(): boolean {
    return this.parser.type === "declarations";
  }

  /**
   * Checks if the script file is in the info folder.
   * @lastreviewed 2025-09-15
   */
  public async isInInfo(): Promise<boolean> {
    const infoFolder = await this.getScriptRoot().getInfoFolder();
    return infoFolder.some(file => file.fsPath === this.toDownstairsUri().fsPath);
  }

  /**
   * Checks if the script file is in the objects folder.
   * @lastreviewed 2025-09-15
   */
  public async isInObjects(): Promise<boolean> {
    const objectsFolder = await this.getScriptRoot().getObjectsFolder();
    return objectsFolder.some(file => file.fsPath === this.toDownstairsUri().fsPath);
  }

  /**
   * Checks if the script file is in the info or objects folder.
   * @lastreviewed 2025-09-15
   */
  public async isInInfoOrObjects(): Promise<boolean> {
    return await this.isInInfo() || await this.isInObjects();
  }

  /**
   * Checks if the script file is in the draft folder.
   * @lastreviewed 2025-09-15
   */
  public isInDraft(): boolean {
    return this.parser.type === "draft";
  }

  /**
   * Determines if the script file is in the info folder.
   * @lastreviewed 2025-09-15
   */
  public async isInInfoFolder(): Promise<boolean> {
    const infoFolder = await this.getScriptRoot().getInfoFolder();
    return infoFolder.some(file => file.fsPath === this.toDownstairsUri().fsPath);
  }

  /**
   * Checks if the script file is in a valid state.
   * Currently only checks if the file exists.
   * @lastreviewed 2025-09-15
   */
  public async isCopacetic(): Promise<boolean> {
    return await this.exists();
  }

  /**
   * Determines if the file is listed in the .gitignore file.
   * @lastreviewed 2025-09-15
   */
  public async isInGitIgnore(): Promise<boolean> {
    const scriptRoot = this.getScriptRoot();
    const gitIgnorePatterns = await scriptRoot.getGitIgnore();
    const globMatcher = new GlobMatcher(scriptRoot.getDownstairsRootUri(), gitIgnorePatterns);
    return globMatcher.matches(this.toDownstairsUri());
  }

  /**
   * Gets the URL pathname for the upstairs file.
   * @lastreviewed 2025-09-15
   */
  public getRest(): string {
    return this.toUpstairsURL().pathname;
  }
}


