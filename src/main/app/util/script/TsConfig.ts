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
  
  /**
   * Creates a new TsConfig instance wrapping a ScriptFile.
   * @param sf The ScriptFile representing the tsconfig.json file
   * @throws {Error} When the ScriptFile does not point to a tsconfig.json file
   * @lastreviewed null
   */
  constructor(private readonly sf: ScriptFile) {
    if (!this.sf.path().endsWith(TsConfig.NAME)) {
      throw new Error("Provided ScriptFile is not a tsconfig.json file: " + this.sf.path());
    }
  }
  
  /**
   * Creates a TsConfig instance from a VS Code URI.
   * @param uri The URI pointing to a tsconfig.json file
   * @returns A new TsConfig instance
   * @throws {Error} When the URI does not point to a tsconfig.json file
   * @lastreviewed null
   */
  static fromUri(uri: vscode.Uri): TsConfig {
    if (!uri.fsPath.endsWith(TsConfig.NAME)) {
      throw new Error("Provided URI does not point to a tsconfig.json file.");
    }
    return new TsConfig(ScriptFile.fromUri(uri));
  }
  
  /**
   * Creates a TsConfig instance from a file system path.
   * @param fsPath The file system path to a tsconfig.json file
   * @returns A new TsConfig instance
   * @lastreviewed null
   */
  static fromPath(fsPath: string): TsConfig {
    return TsConfig.fromUri(vscode.Uri.file(fsPath));
  }

  /**
   * Checks if this TsConfig is equal to another TsConfig by comparing their underlying ScriptFiles.
   * @param other The TsConfig to compare with
   * @returns True if the TsConfigs are equal, false otherwise
   * @lastreviewed null
   */
  public equals(other: TsConfig): boolean {
    if (!(other instanceof TsConfig)) {
      return false;
    }
    return this.sf.equals(other.sf);
  }

  /**
   * Gets the file system path of this tsconfig.json file.
   * @returns The file system path as a string
   * @lastreviewed null
   */
  public path(): string {
    return this.sf.path();
  }

  /**
   * Gets the URI of this tsconfig.json file.
   * @returns The VS Code URI
   * @lastreviewed null
   */
  public uri(): vscode.Uri {
    return this.sf.uri();
  }

  /**
   * Gets the folder containing this tsconfig.json file.
   * @returns The parent Folder instance
   * @lastreviewed null
   */
  public folder() {
    return this.sf.folder();
  }

  /**
   * Checks if this tsconfig.json file is in a valid/copacetic state.
   * @returns A Promise that resolves to true if the file is copacetic, false otherwise
   * @lastreviewed null
   */
  public async isCopacetic(): Promise<boolean> {
    return this.sf.isCopacetic();
  }
  
  /**
   * Returns this TsConfig instance as it is already the closest tsconfig.json file to itself.
   * @returns A Promise that resolves to this TsConfig instance
   * @lastreviewed null
   */
  public async getClosestTsConfigFile(): Promise<TsConfig> {
    return this;
  }
  
  /**
   * Gets the ScriptRoot for this tsconfig.json file.
   * @returns The ScriptRoot instance
   * @lastreviewed null
   */
  public getScriptRoot() {
    return this.sf.getScriptRoot();
  }
}