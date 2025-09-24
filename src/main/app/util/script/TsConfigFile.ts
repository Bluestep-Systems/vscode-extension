import * as vscode from "vscode";
import { RemoteScriptFile } from "./RemoteScriptFile";
import { TerminalElement } from "./TerminalElement";

/**
 * A specialized RemoteScriptFile representing a tsconfig.json file.
 */
export class TsConfigFile implements TerminalElement {
  static NAME = "tsconfig.json";
  constructor(private readonly sf: RemoteScriptFile) {
    if (!this.sf.path().endsWith(TsConfigFile.NAME)) {
      throw new Error("Provided RemoteScriptFile is not a tsconfig.json file: " + this.sf.path());
    }
  }
  static fromUri(uri: vscode.Uri): TsConfigFile {
    if (!uri.fsPath.endsWith(TsConfigFile.NAME)) {
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


  public path(): string {
    return this.sf.path();
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