import * as path from 'path';
import * as vscode from 'vscode';
import { FolderNames, Http } from '../../../resources/constants';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { DownstairsUriParser } from '../data/DownstairsUrIParser';
import { GlobMatcher } from '../data/GlobMatcher';
import { Err } from '../Err';
import { FileSystem } from '../fs/FileSystem';
import { ResponseCodes } from '../network/StatusCodes';
import { ScriptPathElement } from './PathElement';
import { ScriptFactory } from './ScriptFactory';
import { ScriptFolder } from './ScriptFolder';
import { ScriptRoot } from './ScriptRoot';
import { TsConfig } from './TsConfig';
import { App } from '../../App';
import { ScriptUrlParser } from '../data/ScriptUrlParser';
const fs = FileSystem.getInstance;

/**
 * A class representing a file or folder element of a script.
 *
 * @lastreviewed 2025-09-15
 */
export abstract class ScriptNode implements ScriptPathElement {

  /**
   * The parser for the downstairs URI of this file.
   */
  protected parser: DownstairsUriParser;

  /**
   * The downstairs root object.
   */
  protected scriptRoot: ScriptRoot;

  /**
   * Caches the existence check result to avoid redundant filesystem calls.
   */
  private _exists: boolean | undefined;

  /**
   * Creates a {@link ScriptNode} instance in addition to its associated {@link ScriptRoot} object.
   * 
   * @param param0 Object containing the downstairs URI (local file system path)
   * @param param0.downstairsUri The local file system URI for this script file
   * @lastreviewed 2025-09-15
   */
  constructor(public readonly downstairsUri: vscode.Uri, scriptRoot?: ScriptRoot) {
    this.parser = new DownstairsUriParser(downstairsUri);
    this.scriptRoot = scriptRoot || new ScriptRoot(downstairsUri);
  }

  /**
   * Meant to convert the current node to a matching upstairs {@link URL}.
   * @lastreviewed 2025-09-29
   */
  abstract upstairsUrl(): Promise<URL>;

  /**
   * Creates a familial node with the given downstairs {@link vscode.Uri} after verifying that it indeed has a familial relation.
   */
  abstract createFamilial(downstairsUri: vscode.Uri): ScriptNode;

  /**
   * Gets the downstairs (local) {@link vscode.Uri} for this file
   * @lastreviewed 2025-09-29
   */
  public uri() {
    return this.parser.rawUri;
  }

  /**
   * Gets the file system path of this script file.
   * @returns The file system path as a string
   * @lastreviewed 2025-09-29
   */
  public path() {
    return this.uri().fsPath;
  }

  /**
   * Produces the last modified {@link Date} of the upstairs object
   * @lastreviewed 2025-09-29
   */
  public async getUpstairsLastModified(): Promise<Date> {

    const response = await SM.fetch(await this.upstairsUrl(), {
      method: Http.Methods.HEAD
    });
    const lastModifiedHeaderValue = response.headers.get("Last-Modified");
    if (!lastModifiedHeaderValue) {
      throw new Err.ModificationTimeError();
    }
    return new Date(lastModifiedHeaderValue);
  }


  /**
   * Gets the content of the upstairs file as text.
   * @throws an {@link Err.HttpResponseError} When the upstairs file returns a 400+ status code
   * @lastreviewed 2025-09-15
   */
  public async getUpstairsContent(): Promise<string> {
    const response = await SM.fetch(await this.upstairsUrl(), {
      method: Http.Methods.GET,
      headers: {
        [Http.Headers.ACCEPT]: Http.Headers.ACCEPT_ALL,
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
   * @lastreviewed 2025-09-29
   */
  public async writeContent(buffer: ArrayBuffer) {
    await fs().writeFile(this.uri(), Buffer.from(buffer));
  }

  /**
   * Determines if the node exists and corresponds to an actual, real file/folder on disk.
   * @lastreviewed 2025-09-29
   */
  public async exists(): Promise<boolean> {
    if (this._exists) {
      return this._exists;
    }
    try {
      await fs().stat(this.uri());
      this._exists = true;
      return true;
    } catch (e) {
      this._exists = false;
      return false;
    }
  }

  /**
   * Produces the {@link vscode.FileStat} of the underlaying file, or `null` if it doesn't exist.
   * @lastreviewed 2025-09-29
   */
  public async stat(): Promise<vscode.FileStat | null> {
    try {
      return await fs().stat(this.uri());
    } catch (e) {
      return null;
    }
  }

  /**
   * The last modified {@link Date} of the local file.
   * @throws an {@link Err.NodeNotFoundError} When the file does not exist
   * @lastreviewed 2025-09-29
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
   * @lastreviewed 2025-09-29
   */
  public getScriptRoot(parser?: ScriptUrlParser): ScriptRoot {
    if (parser) {
      this.scriptRoot.withParser(parser);
    }
    return this.scriptRoot;
  }

  /**
   * Overwrites the script root for this file.
   *
   * Be mindful, because it becomes easy to create inconsistencies since the underlying file may not even exist.
   * @param root The new script root
   * @returns The updated script file
   * @throws an {@link Err.MetadataFileOperationError} When attempting to overwrite script root of a metadata file
   * @lastreviewed 2025-09-29
   */
  withScriptRoot(root: ScriptRoot): ScriptNode {
    this.scriptRoot = root;
    if (this.parser.type === "metadata") {
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
    this.parser = parser;
    return this;
  }

  /**
   * Compares this script node to another for equality.
   * @param other The other element to compare against
   * @lastreviewed 2025-09-29
   */
  public equals(other: ScriptPathElement): boolean {
    return this.path() === other.path();
  }

  /**
   * Checks if the script file is in the declarations folder.
   * @lastreviewed 2025-09-15
   */
  public isInDeclarations(): boolean {
    return this.parser.type === "declarations";
  }

  public isInSnapshot(): boolean {
    return this.parser.type === "snapshot";
  }

  /**
   * Checks if the script node is in the draft folder.
   * @lastreviewed 2025-09-15
   */
  public isInDraft(): boolean {
    return this.parser.type === "draft";
  }

  /**
   * Checks if the script node is in a valid state.
   * Currently only checks if the node exists.
   * @lastreviewed 2025-09-15
   */
  public async isCopacetic(): Promise<boolean> {
    return await this.exists();
  }

  /**
   * Determines if the node is listed in the .gitignore file.
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
  public async getRest(): Promise<string> {
    return (await this.upstairsUrl()).pathname;
  }



  /**
   * Gets the {@link vscode.Uri Uri} of the folder containing this file.
   * @lastreviewed 2025-10-01
   */
  public folder(): ScriptFolder {
    const fileUri = this.uri();
    return ScriptFactory.createFolder(() => vscode.Uri.joinPath(fileUri, '..'), this.scriptRoot);
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
   * @throws an {@link Err.ConfigFileError} When no tsconfig.json file is found
   * @lastreviewed 2025-10-01
   */
  public async getClosestTsConfigFile() {
    const tsConfigUri = await this.getClosestTsConfigUri();
    if (!tsConfigUri) {
      throw new Err.ConfigFileError(TsConfig.NAME, 0);
    }
    return ScriptFactory.createTsConfig(tsConfigUri);
  }

  /**
   * @returns The {@link vscode.Uri} of the closest tsconfig.json file
   */
  private async getClosestTsConfigUri() {
    return await fs().closest(this.uri(), TsConfig.NAME);
  }

  /**
   * Gets the closest uri with the given name in the current folder or any parent folder.
   */
  public closest(name: string) {
    return fs().closest(this.uri(), name);
  }

  /**
   * @returns Whether the current node is in its respective build folder
   */
  public async isInItsRespectiveBuildFolder() {
    const buildFolder = await this.getBuildFolder();
    //TODO there are cases where the build-folder is legitimately the same folder as the original file.
    // this needs to be accounted for.
    return buildFolder.contains(this);
  }

  /**
   * Gets the build folder associated with the current node.
   */
  public async getBuildFolder() {
    const tsConfig = await this.getMatchingTsConfigFile();
    return await tsConfig.getBuildFolder();
  }

  /**
   * Gets the path of the current node relative to the draft root folder
   */
  public pathWithRespectToDraftRoot() {
    return path.relative(vscode.Uri.joinPath(this.getScriptRoot().getRootUri(), FolderNames.DRAFT).fsPath, this.uri().fsPath);
  }

  /**
   * Gets the path of the current node relative to the closest tsconfig.json file
   * @throws an {@link Err.ConfigFileError} When no tsconfig.json file is found
   * @lastreviewed 2025-10-10
   */
  public async pathWithRespectToTsConfigFolder() {
    const closestTsConfigFile = await this.getClosestTsConfigFile();
    if (!closestTsConfigFile) {
      throw new Err.ConfigFileError(TsConfig.NAME, 0);
    }
    const closestTsConfigFolderUri = closestTsConfigFile.folder().uri();
    return path.relative(closestTsConfigFolderUri.fsPath, this.uri().fsPath);
  }

  /**
   * Attempts to upload the current node to its upstairs location.
   * If an upstairs URL override string is provided, it will be used instead of the default upstairs location.
   * 
   * @param upstairsUrlOverrideString An optional upstairs URL override string
   * @returns A {@link Response} object if the upload was successful, or `void` if no upload was necessary
   * @throws an {@link Err.FileSendError} when there is an error sending the file to the upstairs location
   * @throws an {@link Err.DestinationPathError} When the upstairs URL (or override) is invalid
   * @throws an {@link Err.UserCancelledError} When the user cancels the upload due to some issue that required user intervention
   * @lastreviewed 2025-10-01
   */
  abstract upload(arg?: { upstairsUrlOverrideString?: string, isSnapshot?: boolean; }): Promise<Response | void>;

  /**
   * Downloads the upstairs node and writes it to the local file system.
   * @returns A {@link Response} object if the download was successful
   */
  abstract download(): Promise<Response>;

  /**
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

  /**
   * Alias for the inverse of {@link isFolder}
   */
  public async isFile() {
    return !(await this.isFolder());
  }

  abstract getReasonToNotPush(arg?: { upstairsOverride?: URL; }): Promise<string | null>;

  /**
   * Copies the current draft file to its respective build folder.
   * @throws an {@link Err.BuildFolderOperationError} When the current node is already in its respective build folder
   * @throws an {@link Err.ScriptNotCopaceticError} When the current node is not in a copacetic state
   * @lastreviewed 2025-10-07
   */
  public async copyDraftFileToBuild() {
    if (await this.isInItsRespectiveBuildFolder()) {
      throw new Err.BuildFolderOperationError("copy", this.path());
    }
    if (!(await this.isCopacetic())) {
      throw new Err.ScriptNotCopaceticError();
    }
    const tsConfig = await this.getClosestTsConfigFile();
    const buildUri = vscode.Uri.joinPath(
      tsConfig.folder().uri(),
      await tsConfig.relativePathToBuildFolder(),
      await this.pathWithRespectToTsConfigFolder()
    );
    await this.copyTo(buildUri);
  }

  /**
   * Gets the contents of the current node as a byte array.
   */
  public async readContents(): Promise<Uint8Array<ArrayBufferLike>> {
    return await fs().readFile(this.uri());
  }

  /**
   * copies the current node to the given uri.
   */
  public async copyTo(uri: vscode.Uri): Promise<void> {
    if (await this.isInItsRespectiveBuildFolder()) {
      throw new Err.BuildFolderOperationError("copy", this.path());
    }
    if (!(await this.isCopacetic())) {
      throw new Err.ScriptNotCopaceticError();
    }
    await fs().copy(this.uri(), uri, { overwrite: true });
  }

  /**
   * Deletes the current node if it is in a copacetic state.
   * @throws an {@link Err.ScriptNotCopaceticError} When the current node is not in a copacetic state
   * @lastreviewed 2025-10-07
   */
  public async delete(): Promise<void> {
    if (await this.isCopacetic()) {
      await fs().delete(this, { recursive: true });
    } else {
      throw new Err.ScriptNotCopaceticError();
    }
  }

  /**
   * Gets the name of this node. For files, this is the file name. For folders, this is the folder name.
   */
  abstract name(): string;

  /**
   * Renames the current node to something new; operation is aborted if the new name is the same as the current name.
   * @throws an {@link Err.ScriptOperationError} if the node is the script root folder, as renaming it
   * would break the metadata store lookup.
   */
  public async rename(newName: string): Promise<void> {
    await this.isCopacetic();
    if (this.uri().fsPath === this.scriptRoot.getRootUri().fsPath) {
      throw new Err.ScriptOperationError("Cannot rename the script root folder; the folder name is used as a metadata lookup key.");
    }
    if (this.name() === newName) {
      App.logger.info("Ignoring rename operation; new name is the same as the current name.");
      return;
    }
    const parent = vscode.Uri.joinPath(this.uri(), "..");
    const newUri = vscode.Uri.joinPath(parent, newName);
    await fs().rename(this.uri(), newUri);
  }
}


