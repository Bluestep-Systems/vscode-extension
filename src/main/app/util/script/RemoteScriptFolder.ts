import * as vscode from 'vscode';
import { flattenDirectory } from '../data/flattenDirectory';
import { PathElement } from './PathElement';
import { RemoteScriptFile } from './RemoteScriptFile';
import { TsConfigFile } from './TsConfigFile';
export class RemoteScriptFolder extends PathElement {
  uri: vscode.Uri;
  constructor(folderUri: vscode.Uri) {  
    super();
    this.uri = folderUri;
  }
  public static async fromUri(uri: vscode.Uri): Promise<RemoteScriptFolder> {
    let isFolder = false;
    try {
      const stat = await vscode.workspace.  fs.stat(uri);
      isFolder = stat.type === vscode.FileType.Directory;
    } catch (error) {
      // URI doesn't exist or can't be accessed
    }
    if (!isFolder) {
      throw new Error("Provided URI does not point to a folder.");
    }
    return new RemoteScriptFolder(uri);
  }
  public async findAllTsConfigFiles(): Promise<TsConfigFile[]> {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(this.uri, '**/metadata.json'));
    return files.map(file => TsConfigFile.fromUri(file));
  }
  public equals(other: RemoteScriptFolder): boolean {
    if (!(other instanceof RemoteScriptFolder)) {
      return false;
    }
    return this.uri.fsPath === other.uri.fsPath;
  }
  public fsPath(): string {
    return this.uri.fsPath;
  }
  public getUri(): vscode.Uri {
    return this.uri;
  }

  public getChildFolder(folderName: string): RemoteScriptFolder {
    return new RemoteScriptFolder(vscode.Uri.joinPath(this.uri, folderName));
  }

  public contains(other: PathElement): boolean {
    if (!(other instanceof RemoteScriptFolder)) {
      return false;
    }
    return other.fsPath().includes(this.fsPath());
  }

  public async flatten(): Promise<RemoteScriptFile[]> {
    return (await this.flattenToRaw()).map(uri => RemoteScriptFile.fromUri(uri));
  }
  public async flattenToRaw(): Promise<vscode.Uri[]> {
    return flattenDirectory(this);
  }
  public async getTsFiles(): Promise<TsConfigFile[]> {
    return (await flattenDirectory(this))
      .filter((downstairsUri) => downstairsUri.fsPath.endsWith(".ts") || downstairsUri.fsPath.endsWith(".tsx"))
      .map(TsConfigFile.fromUri);
  }

}