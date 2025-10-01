import * as vscode from "vscode";
import { readFileText } from "../data/readFile";
import { Err } from "../Err";
import { FileSystem } from "../fs/FileSystem";
import { ScriptPathElement } from "./PathElement";
import { ScriptFactory } from "./ScriptFactory";
import { ScriptFile } from "./ScriptFile";
import type { ScriptFolder } from "./ScriptFolder";
const fs = FileSystem.getInstance;

/**
 * A specialized {@link ScriptPathElement} representing a tsconfig.json file.
 * 
 * We want this to extend {@link ScriptFile} for cleanliness (since it truly is the same thing),
 * but there were some circular dependency issues that were difficult to resolve. If at some point
 * in the future ScriptFile is refactored such that it isn't an issue, we can revisit this.
 * 
 * Instead, TsConfig merely wraps a ScriptFile and delegates relevant methods to it.
 */
export class TsConfig implements ScriptPathElement {
  /**
   * The standard name for tsconfig files.
   */
  static NAME = "tsconfig.json";
  private sf: ScriptFile;
  /**
   * Creates a new TsConfig instance wrapping a ScriptFile.
   * @param sf The ScriptFile representing the tsconfig.json file
   * @throws an {@link Error} When the ScriptFile does not point to a tsconfig.json file
   * @lastreviewed 2025-10-01
   */
  constructor(protected readonly rawUri: vscode.Uri) {
    this.sf = ScriptFactory.createFile(rawUri);
    if (!this.path().endsWith(TsConfig.NAME)) {
      throw new Err.InvalidResourceTypeError("tsconfig.json file");
    }
  }

  /**
   * Checks if this TsConfig is equal to another TsConfig by comparing their underlying ScriptFiles.
   * @param other The TsConfig to compare with
   * @lastreviewed 2025-10-01
   */
  public equals(other: TsConfig): boolean {
    if (!(other instanceof TsConfig)) {
      return false;
    }
    return this.equals(other);
  }

  /**
   * Gets the file system path of this tsconfig.json file.
   * @lastreviewed 2025-10-01
   */
  public path(): string {
    return this.rawUri.fsPath;
  }

  /**
   * Gets the URI of this tsconfig.json file.
   * @lastreviewed 2025-10-01
   */
  public uri(): vscode.Uri {
    return this.rawUri;
  }

  /**
   * Gets the folder containing this tsconfig.json file.
   * @returns The parent {@link ScriptFolder} instance
   * @lastreviewed 2025-10-01
   */
  public folder() {
    return ScriptFactory.createFolder(() => vscode.Uri.joinPath(this.rawUri, ".."));
  }

  /**
   * Checks if this tsconfig.json file is in a valid/copacetic state.
   * @returns A {@link Promise} that resolves to `true` if the file is copacetic, `false` otherwise
   * @lastreviewed 2025-10-01
   */
  public async isCopacetic(): Promise<boolean> {
    const exists = await this.sf.exists();
    if (!exists) {
      return false;
    }
    const fileContents = await fs().readFile(this.uri());
    const fileString = Buffer.from(fileContents).toString('utf-8');
    try {
      const parsed = JSON.parse(fileString);
      // Basic validation: check for compilerOptions and include fields
      // TODO determine if this is overkill.
      if (parsed.compilerOptions && parsed.include) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 
   * @returns A {@link Promise} that resolves to a {@link ScriptFolder} representing the build output folder as specified in the tsconfig.json's outDir.
   * @throws an {@link Err.MissingConfigurationError} When the outDir is not specified in the tsconfig.json
   * @lastreviewed 2025-10-01
   */
  public async getBuildFolder() {
    const fileContents = await readFileText(this.uri());
    const config = JSON.parse(fileContents);
    const outDir = config.compilerOptions?.outDir || (() => { throw new Err.MissingConfigurationError("outDir"); })();
    return ScriptFactory.createFolder(() => vscode.Uri.joinPath(this.folder().uri(), outDir));
  }
}