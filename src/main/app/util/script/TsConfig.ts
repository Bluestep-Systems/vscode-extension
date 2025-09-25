import * as vscode from "vscode";
import { ScriptFile } from "./ScriptFile";
import { File } from "./File";

/**
 * A specialized ScriptFile representing a tsconfig.json file.
 * 
 * I wanted this to extend ScriptFile for cleanliness (since they truly are the same thing),
 * but there were some circular dependency issues that were difficult to resolve. If at some point
 * in the future ScriptFile is refactored such that it isn't an issue, we can revisit this.
 * 
 * Instead, TsConfig merely wraps a ScriptFile and delegates relevant methods to it.
 */
export class TsConfig implements File {
  static NAME = "tsconfig.json";
  constructor(private readonly sf: ScriptFile) {
    if (!this.sf.path().endsWith(TsConfig.NAME)) {
      throw new Error("Provided ScriptFile is not a tsconfig.json file: " + this.sf.path());
    }
  }
  static fromUri(uri: vscode.Uri): TsConfig {
    if (!uri.fsPath.endsWith(TsConfig.NAME)) {
      throw new Error("Provided URI does not point to a tsconfig.json file.");
    }
    return new TsConfig(ScriptFile.fromUri(uri));
  }
  static fromPath(fsPath: string): TsConfig {
    return TsConfig.fromUri(vscode.Uri.file(fsPath));
  }

  public equals(other: TsConfig): boolean {
    if (!(other instanceof TsConfig)) {
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
  public async getClosestTsConfigFile(): Promise<TsConfig> {
    return this;
  }
  public getScriptRoot() {
    return this.sf.getScriptRoot();
  }
}