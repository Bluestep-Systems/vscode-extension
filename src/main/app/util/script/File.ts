import { PathElement } from "./PathElement";
import { Folder } from "./Folder";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfig } from "./TsConfig";

/**
 * Interface representing a file with additional script-related functionality.
 * @lastreviewed null
 */
export interface File extends PathElement {
  /**
   * Gets the folder containing this file.
   * @returns The parent folder
   * @lastreviewed null
   */
  folder(): Folder;
  
  /**
   * Finds the closest tsconfig.json file for this file.
   * @returns A Promise that resolves to the closest TsConfig instance
   * @lastreviewed null
   */
  getClosestTsConfigFile(): Promise<TsConfig>;
  
  /**
   * Gets the script root for this file.
   * @returns The ScriptRoot instance
   * @lastreviewed null
   */
  getScriptRoot(): ScriptRoot;
  
  /**
   * Checks if the file is in a valid/copacetic state.
   * @returns A Promise that resolves to true if the file is copacetic, false otherwise
   * @lastreviewed null
   */
  isCopacetic(): Promise<boolean>;
}