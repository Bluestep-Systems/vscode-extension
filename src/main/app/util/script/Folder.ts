import * as vscode from 'vscode';
import { flattenDirectory } from '../data/flattenDirectory';
import { PathElement } from './PathElement';
import { ScriptNode } from './ScriptNode';
import { TsConfig } from './TsConfig';
export class Folder implements PathElement {
  /**
   * Creates a new Folder instance with the specified URI.
   * @param folderUri The URI of the folder
   * @lastreviewed null
   */
  constructor(private readonly folderUri: vscode.Uri) { }
  
  /**
   * Creates a Folder instance from a URI, verifying it points to a directory.
   * @param uri The URI to create a folder from
   * @returns A Promise that resolves to a new Folder instance
   * @throws {Error} When the URI does not point to a folder
   * @lastreviewed null
   */
  public static async fromUri(uri: vscode.Uri): Promise<Folder> {
    let isFolder = false;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      isFolder = stat.type === vscode.FileType.Directory;
    } catch (error) {
      // URI doesn't exist or can't be accessed
    }
    if (!isFolder) {
      throw new Error("Provided URI does not point to a folder.");
    }
    return new Folder(uri);
  }
  
  /**
   * Finds all tsconfig.json files within this folder and its subdirectories.
   * @returns A Promise that resolves to an array of TsConfig instances
   * @lastreviewed null
   */
  public async findAllTsConfigFiles(): Promise<TsConfig[]> {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(this.uri(), '**/tsconfig.json'));
    return files.map(file => TsConfig.fromUri(file));
  }
  
  /**
   * Checks if this folder is equal to another folder by comparing their file system paths.
   * @param other The folder to compare with
   * @returns True if the folders have the same path, false otherwise
   * @lastreviewed null
   */
  public equals(other: Folder): boolean {
    if (!(other instanceof Folder)) {
      return false;
    }
    return this.uri().fsPath === other.uri().fsPath;
  }
  
  /**
   * Gets the file system path of this folder.
   * @returns The file system path as a string
   * @lastreviewed null
   */
  public path(): string {
    return this.uri().fsPath;
  }
  
  /**
   * Gets the URI of this folder.
   * @returns The folder's URI
   * @lastreviewed null
   */
  public uri(): vscode.Uri {
    return this.folderUri;
  }

  /**
   * Creates a new Folder instance for a child folder within this folder.
   * @param folderName The name of the child folder
   * @returns A new Folder instance representing the child folder
   * @lastreviewed null
   */
  public getChildFolder(folderName: string): Folder {
    return new Folder(vscode.Uri.joinPath(this.uri(), folderName));
  }

  /**
   * Checks if this folder contains another PathElement by comparing their paths.
   * @param other The PathElement to check if it's contained within this folder
   * @returns True if the other element's path is within this folder's path, false otherwise
   * @lastreviewed null
   */
  public contains(other: PathElement): boolean {
    if (!(other instanceof Folder)) {
      return false;
    }
    return other.path().includes(this.path());
  }

  /**
   * Recursively flattens all files in this folder and returns them as ScriptFile instances.
   * @returns A Promise that resolves to an array of ScriptFile instances for all files in the folder tree
   * @lastreviewed null
   */
  public async flatten(): Promise<ScriptNode[]> {
    return (await this.flattenRaw()).map(uri => ScriptNode.fromUri(uri));
  }
  
  /**
   * Recursively flattens all files in this folder and returns their URIs.
   * @returns A Promise that resolves to an array of URIs for all files in the folder tree
   * @lastreviewed null
   */
  public async flattenRaw(): Promise<vscode.Uri[]> {
    return flattenDirectory(this);
  }

}