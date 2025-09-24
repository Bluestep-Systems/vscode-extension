import * as vscode from 'vscode';
import { RemoteTsConfigFile } from './RemoteTsConfigFile';
import { RemotePathElement } from './RemotePathElement';
export class RemoteScriptFolder extends RemotePathElement {
  uri: vscode.Uri;
  constructor(folderUri: vscode.Uri) {
    super();
    this.uri = folderUri;
  }
  public async findAllTsConfigFiles(): Promise<RemoteTsConfigFile[]> {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(this.uri, '**/metadata.json'));
    return files.map(file => RemoteTsConfigFile.fromUri(file));
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
}