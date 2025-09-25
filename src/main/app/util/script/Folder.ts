import * as vscode from 'vscode';
import { flattenDirectory } from '../data/flattenDirectory';
import { PathElement } from './PathElement';
import { ScriptFile } from './ScriptFile';
import { TsConfig } from './TsConfig';
export class Folder implements PathElement {
  constructor(private readonly folderUri: vscode.Uri) { }
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
  public async findAllTsConfigFiles(): Promise<TsConfig[]> {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(this.uri(), '**/tsconfig.json'));
    return files.map(file => TsConfig.fromUri(file));
  }
  public equals(other: Folder): boolean {
    if (!(other instanceof Folder)) {
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

  public getChildFolder(folderName: string): Folder {
    return new Folder(vscode.Uri.joinPath(this.uri(), folderName));
  }

  public contains(other: PathElement): boolean {
    if (!(other instanceof Folder)) {
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