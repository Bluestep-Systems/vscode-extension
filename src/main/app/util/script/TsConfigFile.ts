import * as vscode from "vscode";
import { PathElement } from "./PathElement";
import { RemoteScriptFile } from "./RemoteScriptFile";
import { TerminalElement } from "./TerminalElement";

/**
 * A specialized RemoteScriptFile representing a tsconfig.json file.
 */
export class TsConfigFile extends PathElement implements TerminalElement {
  constructor(private readonly sf: RemoteScriptFile) {
    super();
    if (!this.sf.fsPath().endsWith(PathElement.TS_CONFIG_JSON)) {
      throw new Error("Provided RemoteScriptFile is not a tsconfig.json file: " + this.sf.fsPath());
    }
  }
  static fromUri(uri: vscode.Uri): TsConfigFile {
    if (!uri.fsPath.endsWith(PathElement.TS_CONFIG_JSON)) {
      throw new Error("Provided URI does not point to a tsconfig.json file.");
    }
    return new TsConfigFile(RemoteScriptFile.fromUri(uri));
  }
  static fromPath(fsPath: string): TsConfigFile {
    return TsConfigFile.fromUri(vscode.Uri.file(fsPath));
  }

  public equals(other: TsConfigFile): boolean {
    if (!(other instanceof TsConfigFile)) {
      return false;
    }
    return this.sf.equals(other.sf);
  }


  public fsPath(): string {
    return this.sf.fsPath();
  }

  public uri(): vscode.Uri {
    return this.sf.uri();
  }

  public folder() {
    return this.sf.folder();
  }

  public async isCopacetic(): Promise<boolean> {
    return this.sf.isCopacetic();
  }
  public async getClosestTsConfigFile(): Promise<TsConfigFile> {
    return this;
  }
  public getScriptRoot() {
    return this.sf.getScriptRoot();
  }
}