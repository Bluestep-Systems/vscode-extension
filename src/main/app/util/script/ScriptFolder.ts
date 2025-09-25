import * as vscode from 'vscode';
import { flattenDirectory } from '../data/flattenDirectory';
import { PathElement } from './PathElement';
import { ScriptFile } from './ScriptFile';
import { TsConfigFile } from './TsConfigFile';
export class ScriptFolder implements PathElement {
  constructor(private readonly folderUri: vscode.Uri) { }
  public static async fromUri(uri: vscode.Uri): Promise<ScriptFolder> {
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
    return new ScriptFolder(uri);
  }
  public async findAllTsConfigFiles(): Promise<TsConfigFile[]> {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(this.uri(), '**/tsconfig.json'));
    return files.map(file => TsConfigFile.fromUri(file));
  }
  public equals(other: ScriptFolder): boolean {
    if (!(other instanceof ScriptFolder)) {
      return false;
    }
    return this.uri().fsPath === other.uri().fsPath;
  }
  public path(): string {
    return this.uri().fsPath;
  }
  public uri(): vscode.Uri {
    return this.folderUri;
  }

  public getChildFolder(folderName: string): ScriptFolder {
    return new ScriptFolder(vscode.Uri.joinPath(this.uri(), folderName));
  }

  public contains(other: PathElement): boolean {
    if (!(other instanceof ScriptFolder)) {
      return false;
    }
    return other.path().includes(this.path());
  }

  public async flatten(): Promise<ScriptFile[]> {
    return (await this.flattenRaw()).map(uri => ScriptFile.fromUri(uri));
  }
  public async flattenRaw(): Promise<vscode.Uri[]> {
    return flattenDirectory(this);
  }

}