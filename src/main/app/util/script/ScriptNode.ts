import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigJsonContent, MetaDataJsonFileContent } from '../../../../../types';
import { App } from '../../App';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { DownstairsUriParser } from '../data/DownstairsUrIParser';
import { GlobMatcher } from '../data/GlobMatcher';
import { readFileText } from '../data/readFile';
import { UpstairsUrlParser } from '../data/UpstairsUrlParser';
import { Err } from '../Err';
import { FileSystem } from '../fs/FileSystem';
import { ResponseCodes } from '../network/StatusCodes';
import { PathElement } from './PathElement';
import { ScriptFolder } from './ScriptFolder';
import { ScriptRoot } from './ScriptRoot';
import { TsConfig } from './TsConfig';
const fs = FileSystem.getInstance;

/**
 * A class representing a file or folder element of a script.
 *
 * @lastreviewed 2025-09-15
 */
export class ScriptNode implements PathElement {

  /**
   * The downstairs URI (local file system path).
   */
  private _parser: DownstairsUriParser;

  /**
   * The downstairs root object.
   */
  private _scriptRoot: ScriptRoot;



  /**
   * Creates a {@link ScriptNode} instance in addition to its associated {@link ScriptRoot} object.
   * 
   * @param param0 Object containing the downstairs URI (local file system path)
   * @param param0.downstairsUri The local file system URI for this script file
   * @lastreviewed 2025-09-15
   */
  constructor(public readonly downstairsUri: vscode.Uri) {
    this._parser = new DownstairsUriParser(downstairsUri);
    this._scriptRoot = new ScriptRoot(this);
  }


  /**
   * Creates a ScriptNode instance from a file system path.
   * @param fsPath The file system path to create the ScriptNode from
   * @returns A new ScriptNode instance
   * @lastreviewed null
   */
  public static fromPath(fsPath: string): ScriptNode {
    const uri = vscode.Uri.file(fsPath);
    return new ScriptNode(uri);
  }

  /**
   * Returns the {@link URL} for the proper upstairs file.
   * Constructs the appropriate WebDAV {@link URL} based on the file type (root, metadata, declarations, or draft).
   * @lastreviewed 2025-09-15
   */
  public toUpstairsURL(): URL {

    const upstairsBaseUrl = this.getScriptRoot().toBaseUpstairsUrl();
    const newUrl = new URL(upstairsBaseUrl);
    if (this._parser.type === "root") {
      return newUrl;
    } else if (this._parser.type === "metadata") {
      const fileName = this.getFileName();
      if (fileName === ScriptRoot.METADATA_FILENAME) {
        throw new Err.MetadataFileOperationError("convert to upstairs URL");
      }
      newUrl.pathname = upstairsBaseUrl.pathname + fileName;
    } else if (this._parser.isDeclarationsOrDraft()) {
      newUrl.pathname = upstairsBaseUrl.pathname + this._parser.type + "/" + this._parser.rest;
    } else {
      throw new Err.InvalidFileTypeForUrlError(this._parser.type);
    }

    return newUrl;
  }

  /**
   * Gets the downstairs (local) {@link vscode.Uri} for this file
   * @lastreviewed 2025-09-15
   */
  /**
   * Gets the URI of this script file.
   * @returns The VS Code URI of this file
   * @lastreviewed null
   */
  public uri() {
    return this._parser.rawUri;
  }

  /**
   * Gets the file system path of this script file.
   * @returns The file system path as a string
   * @lastreviewed null
   */
  public path() {
    return this.uri().fsPath;
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
      throw new Err.ModificationTimeError();
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

    if (this._parser.type === "root") {
      return "Node is the root folder";
    }
    if (this.getFileName() === ScriptRoot.METADATA_FILENAME) {
      return "Node is a metadata file";
    }
    if (this.isInDeclarations()) {
      return "Node is in declarations";
    }
    if (await this.isExternalModel()) {
      return "Node is an external model";
    }
    if (await this.isInGitIgnore()) {
      return "Node is ignored by .gitignore";
    }
    if (await this.isInInfoOrObjects()) {
      return "Node is in info or objects";
    }
    if (await this.isFolder()) {
      return "Node is a folder";
    }
    if ((await this.isFile()) && await this.integrityMatches(ops)) {
      return "File integrity matches";
    }
    return "";
  }

  /**
   * default implementation always returns true since folders don't have integrity to match
   * @param _ops 
   * @returns 
   */
  public async integrityMatches(_ops?: { upstairsOverride?: URL }): Promise<boolean> {
    return true;
  }



  /**
   * Gets the content of the local file as UTF-8 text.
   * @lastreviewed 2025-09-15
   */
  public async getDownstairsContent(): Promise<string> {
    const downstairsUri = this.uri();
    try {
      const fileData = await fs().readFile(downstairsUri);
      return Buffer.from(fileData).toString('utf8');
    } catch (e) {
      if (e instanceof Error || typeof e === 'string') {
        App.logger.error(e);
      } else {
        App.logger.error(`Error reading downstairs file: ${e}`);
      }
      throw new Err.FileReadError(`Error reading downstairs file: ${e}`);
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
    if (response.status >= ResponseCodes.BAD_REQUEST) {
      throw new Err.HttpResponseError(`Error fetching upstairs file. Status: ${response.status}.\n ${response.statusText}`);
    }
    return await response.text();
  }





  /**
   * Writes binary content to the local file.
   * @param buffer The binary content to write to the file
   * @lastreviewed 2025-09-15
   */
  public async writeContent(buffer: ArrayBuffer) {
    await fs().writeFile(this.uri(), Buffer.from(buffer));
  }

  /**
   * Determines if the file exists and corresponds to an actual file (not a directory).
   * Metadata files are considered to always exist.
   * @lastreviewed 2025-09-15
   */
  public async exists(): Promise<boolean> {
    try {
      await fs().stat(this.uri());
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
    return !(await this.exists() && await this.isFile());
  }

  /**
   * Produces the file stat, or `null` if it doesn't exist.
   * @lastreviewed 2025-09-15
   */
  public async stat(): Promise<vscode.FileStat | null> {
    try {
      return await fs().stat(this.uri());
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
    const stat = await this.stat();
    if (!stat) {
      throw new Err.NodeNotFoundError();
    }
    return new Date(stat.mtime);
  }

  /**
   * Get the {@link ScriptRoot} object for this file.
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
    return md.pushPullRecords.find(record => record.downstairsPath === this.uri().fsPath)?.lastPulled || null;
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
    return md.pushPullRecords.find(record => record.downstairsPath === this.uri().fsPath)?.lastPushed || null;
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
  withScriptRoot(root: ScriptRoot): ScriptNode {
    this._scriptRoot = root;
    //TODO determine if this if-check is even neccessary
    if (this._parser.type === "metadata") {
      throw new Err.MetadataFileOperationError("overwrite script root");
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
  withParser(parser: DownstairsUriParser): ScriptNode {
    this._parser = parser;
    return this;
  }

  /**
   * Compares this script file to another for equality.
   * @param other The other script file to compare against
   * @lastreviewed 2025-09-15
   */
  public equals(other: PathElement): boolean {
    return this.path() === other.path();
  }

  /**
   * Generic method to find and parse a JSON configuration file.
   * @param fileName The name of the file to search for
   * @returns The parsed JSON content
   * @throws {Error} When the file is not found or multiple files are found
   * @lastreviewed 2025-09-15
   */
  private async getConfigurationFile<T>(fileName: string): Promise<T> {
    const files = await fs().findFiles(new vscode.RelativePattern(this._scriptRoot.getRootUri(), `**/${fileName}`));
    if (!files || files.length !== 1) {
      throw new Err.ConfigFileError(fileName, files ? files.length : 0);
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
    return path.parse(this.uri().fsPath).base;
  }

  /**
   * Checks if the script file is in the declarations folder.
   * @lastreviewed 2025-09-15
   */
  public isInDeclarations(): boolean {
    return this._parser.type === "declarations";
  }

  public isInSnapshot(): boolean {
    return this._parser.type === "snapshot";
  }

  /**
   * Checks if the script file is in the info folder.
   * @lastreviewed 2025-09-15
   */
  public async isInInfo(): Promise<boolean> {
    const infoFolder = await this.getScriptRoot().getInfoFolderContents();
    return infoFolder.some(file => file.fsPath === this.uri().fsPath);
  }

  /**
   * Checks if the script file is in the objects folder.
   * @lastreviewed 2025-09-15
   */
  public async isInObjects(): Promise<boolean> {
    const objectsFolder = await this.getScriptRoot().getObjectsFolderContents();
    return objectsFolder.some(file => file.fsPath === this.uri().fsPath);
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
    return this._parser.type === "draft";
  }

  /**
   * Determines if the script file is in the info folder.
   * @lastreviewed 2025-09-15
   */
  public async isInInfoFolder(): Promise<boolean> {
    const infoFolder = await this.getScriptRoot().getInfoFolderContents();
    return infoFolder.some(file => file.fsPath === this.uri().fsPath);
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
    const globMatcher = new GlobMatcher(scriptRoot.getRootUri(), gitIgnorePatterns);
    return globMatcher.matches(this.uri());
  }

  /**
   * Gets the URL pathname for the upstairs file.
   * @lastreviewed 2025-09-15
   */
  public getRest(): string {
    return this.toUpstairsURL().pathname;
  }



  /**
   * Gets the URI of the folder containing this file.
   * @returns The URI of the parent directory
   * @lastreviewed null
   */
  public folder(): ScriptFolder {
    const fileUri = this.uri();
    return ScriptFolder.fromUriNoCheck(vscode.Uri.joinPath(fileUri, '..'));
  }

  /**
   * We are essentially banking on the idea that the closest tsconfig.json file is
   * always the matching one for the current file (be it in the respective build folder or not).
   * 
   * This can definitely have issues if anyone intends to employ a non-normative build location
   * // ex: `"outDir": "../some-other-folder"`
   * @returns The matching tsconfig.json file as a TsConfig instance
   */
  public async getMatchingTsConfigFile() {
    return await this.getClosestTsConfigFile();
  }

  /**
   * 
   * @returns The matching tsconfig.json file as a TsConfigFile instance
   * @throws {Error} When no tsconfig.json file is found
   * @lastreviewed null
   */
  public async getClosestTsConfigFile() {
    const tsConfigUri = await this.getClosestTsConfigUri();
    if (!tsConfigUri) {
      throw new Err.ConfigFileError("tsconfig.json", 0);
    }
    return new TsConfig(new ScriptNode(tsConfigUri));
  }

  /**
   * 
   * @returns The {@link vscode.Uri} of the closest tsconfig.json file
   */
  private async getClosestTsConfigUri() {
    return await fs().closest(this.uri(), TsConfig.NAME);
  }


  public shouldCopyRaw() {
    return path.extname(this.getFileName()).toLowerCase() !== '.ts';
  }

  public copyToSnapshot() {
    console.log("copying file over", this.uri().fsPath);
  }

  public closest(fileName: string) {
    return fs().closest(this.uri(), fileName);
  }
  public async isInItsRespectiveBuildFolder() {
    const buildFolder = await this.getBuildFolder();
    return buildFolder.contains(this);
  }

  public async getBuildFolder() {
    const tsConfig = await this.getMatchingTsConfigFile();
    return await tsConfig.getBuildFolder();
  }

  public get extension() {
    return path.extname(this.getFileName()).toLowerCase();
  }

  public pathWithRespectToDraftRoot() {
    return path.relative(vscode.Uri.joinPath(this.getScriptRoot().getRootUri(), "draft").fsPath, this.uri().fsPath);
  }

  async upload(upstairsUrlOverrideString: string | null = null): Promise<Response | void> {
    App.logger.info("Preparing to send file:", this.uri().fsPath);
    App.logger.info("To target formula URI:", upstairsUrlOverrideString);
    const upstairsUrlParser = new UpstairsUrlParser(upstairsUrlOverrideString || this.toUpstairsURL().toString());
    const { webDavId, url: upstairsUrl } = upstairsUrlParser;
    const upstairsOverride = new URL(upstairsUrl);
    const downstairsUri = this.uri();
    const scriptNode = new ScriptNode(downstairsUri);

    const desto = downstairsUri.fsPath
      .split(upstairsUrl.host + "/" + webDavId)[1];
    if (typeof desto === 'undefined') {
      throw new Err.DestinationPathError(downstairsUri.fsPath);
    }
    upstairsOverride.pathname = `/files/${webDavId}${desto}`;
    const reason = await scriptNode.getReasonToNotPush({ upstairsOverride });
    if (reason) {
      App.logger.info(`${reason}; not pushing file:`, downstairsUri.fsPath);
      return;
    }
    App.logger.info("Destination:", upstairsUrl.toString());


    //TODO investigate if this can be done via streaming
    const fileContents = await fs().readFile(downstairsUri);
    const resp = await SM.fetch(upstairsOverride, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: fileContents
    });
    if (!resp.ok) {
      const details = await getDetails(resp);
      throw new Err.FileSendError(details);
    }
    await scriptNode.touch("lastPushed");
    App.logger.info("File sent successfully:", downstairsUri.fsPath);
    return resp;
    async function getDetails(resp: Response) {
      return `
========
========
status: ${resp.status}
statusText: ${resp.statusText}
========
========
text: ${await resp.text()}
========
========`;
    }
  }

  /**
   * 
   * @returns Whether the current node is a folder
   */
  public async isFolder() {
    try {
      await fs().readFile(this.uri());
      return false;
    } catch (e) {
      if (e instanceof vscode.FileSystemError && e.code === 'FileIsADirectory') {
        return true;
      } else {
        throw new Err.FileSystemError(`Error determining if path is folder: ${e}`);
      }
    }
  }

  public async isFile() {
    return !(await this.isFolder());
  }

  /**
   * Converts the current node to a Folder instance if can be represented by one
   * @returns 
   */
  public async toFolder(): Promise<ScriptFolder> {
    if (await this.isFolder()) {
      return ScriptFolder.fromUriNoCheck(this.uri());
    } else {
      throw new Err.InvalidResourceTypeError("folder");
    }
  }

  /**
   * Touches a file by updating its last pulled or pushed timestamp.
   * Updates the metadata to track when the file was last synchronized and its hash.
   * 
   * @param file The file to touch
   * @param touchType The type of touch to perform - either "lastPulled" or "lastPushed"
   * @lastreviewed 2025-09-15
   */
  async touch(touchType: "lastPulled" | "lastPushed"): Promise<void> {
    const lastHash = await this.getHash();
    const metaData = await this.getScriptRoot().modifyMetaData(md => {
      const downstairsPath = this.uri().fsPath;
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

  public async copyDraftFileToBuild() {
    if (await this.isInItsRespectiveBuildFolder()) {
      throw new Err.BuildFolderOperationError("copy");
    }
    if (!(await this.isCopacetic())) {
      throw new Err.ScriptNotCopaceticError();
    }
    const buildUri = vscode.Uri.joinPath(
      (await this.getClosestTsConfigFile()).folder().uri(),
      (await this.getBuildFolder()).folderName(),
      this.pathWithRespectToDraftRoot()
    );
    await this.copyTo(buildUri);
  }

  public async readContents(): Promise<Uint8Array<ArrayBufferLike>> {
    return await fs().readFile(this.uri());
  }

  public async copyTo(uri: vscode.Uri): Promise<void> {
    if (await this.isInItsRespectiveBuildFolder()) {
      throw new Err.BuildFolderOperationError("copy");
    }
    if (!(await this.isCopacetic())) {
      throw new Err.ScriptNotCopaceticError();
    }
    await fs().copy(this.uri(), uri, { overwrite: true });
  }

  public isTsConfig(): boolean {
    return this.getFileName() === TsConfig.NAME;
  }

  public isMarkdown(): boolean {
    return this.extension === '.md';
  }

  public async getHash(): Promise<string | null> {
    try {
      if (await this.isFolder()) {
        return null; // Folders don't have hashes
      }

      const fileContent = await fs().readFile(this.uri());
      const hashBuffer = await crypto.subtle.digest('SHA-512', fileContent);
      const hexArray = Array.from(new Uint8Array(hashBuffer));
      return hexArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    } catch (error) {
      throw new Error(`Error reading downstairs file: ${error}`);
    }
  }

  public async delete(): Promise<void> {
    if (await this.isCopacetic()) {
      await fs().delete(this, { useTrash: true, recursive: true });
    } else {
      throw new Err.ScriptNotCopaceticError();
    }
  }
}


