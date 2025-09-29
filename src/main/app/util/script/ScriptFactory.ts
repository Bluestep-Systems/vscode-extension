
import { ScriptFile } from "./ScriptFile";
import { ScriptFolder } from "./ScriptFolder";
import type { ScriptNode } from "./ScriptNode";
import * as vscode from "vscode";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfig } from "./TsConfig";
console.log("ScriptFactory loaded");

/**
 * Factory namespace for creating ScriptNode instances (files and folders).
 * 
 * This `VERY SPECIFICALLY` exists to instantiate any ScriptNode object,
 * and `NEVER` allow you to call those constructors directly. This is because TypeScript
 * absolutely hates you calling sibling class constructors directly.
 * 
 * @lastreviewed null
 */
export namespace ScriptFactory {

  /**
   * Creates a ScriptNode instance (either ScriptFile or ScriptFolder) based on the URI path.
   * Automatically determines the appropriate type by checking if the path ends with '/'.
   * 
   * @param uriSupplier A function that returns the VS Code URI for the script node, or a direct URI, or a direct URI
   * @returns A ScriptFile if the path doesn't end with '/', otherwise a ScriptFolder
   * @throws {Error} May throw if the URI supplier returns an invalid URI
   * 
   * @example
   * ```typescript
   * // Creates a ScriptFile
   * const file = ScriptFactory.createNode(() => vscode.Uri.file('/path/to/script.ts'));
   * 
   * // Creates a ScriptFolder
   * const folder = ScriptFactory.createNode(() => vscode.Uri.file('/path/to/folder/'));
   * ```
   * @lastreviewed null
   */
  export function createNode(uriSupplier: (() => vscode.Uri) | vscode.Uri): ScriptNode {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    if (uri.fsPath.endsWith('/')) {
      return new ScriptFolder(uri);
    } else {
      return new ScriptFile(uri);
    }
  }

  /**
   * Creates a ScriptFolder instance for the specified URI.
   * This method explicitly creates a folder instance regardless of the URI path format.
   * 
   * @param uriSupplier A function that returns the VS Code URI for the folder, or a direct URI, or a direct URI
   * @returns A new ScriptFolder instance
   * @throws {Error} May throw if the URI supplier returns an invalid URI
   * 
   * @example
   * ```typescript
   * const folder = ScriptFactory.createFolder(() => 
   *   vscode.Uri.joinPath(workspaceUri, 'scripts', 'components')
   * );
   * ```
   * @lastreviewed null
   */
  export function createFolder(uriSupplier: (() => vscode.Uri) | vscode.Uri): ScriptFolder {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new ScriptFolder(uri);
  }

  /**
   * Creates a ScriptFile instance for the specified URI.
   * This method explicitly creates a file instance regardless of the URI path format.
   * 
   * @param uriSupplier A function that returns the VS Code URI for the file, or a direct URI, or a direct URI
   * @returns A new ScriptFile instance
   * @throws {Error} May throw if the URI supplier returns an invalid URI
   * 
   * @example
   * ```typescript
   * const file = ScriptFactory.createFile(() => 
   *   vscode.Uri.joinPath(workspaceUri, 'scripts', 'main.ts')
   * );
   * ```
   * @lastreviewed null
   */
  export function createFile(uriSupplier: (() => vscode.Uri) | vscode.Uri): ScriptFile {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new ScriptFile(uri);
  }

  /**
   * Creates a ScriptRoot instance for the specified URI.
   * A ScriptRoot represents the root directory of a BlueStep script project,
   * containing draft, snapshot, and other script-related folders.
   * 
   * @param uriSupplier A function that returns the VS Code URI for the script root, or a direct URI
   * @returns A new ScriptRoot instance
   * @throws {Error} May throw if the URI supplier returns an invalid URI or if the path structure is invalid
   * 
   * @example
   * ```typescript
   * // Using a function
   * const scriptRoot = ScriptFactory.createScriptRoot(() => 
   *   vscode.Uri.file('/workspace/configbeh.bluestep.net/1466960')
   * );
   * 
   * // Using a direct URI
   * const directRoot = ScriptFactory.createScriptRoot(
   *   vscode.Uri.file('/workspace/configbeh.bluestep.net/1466960')
   * );
   * ```
   * @lastreviewed null
   */
  export function createScriptRoot(uriSupplier: (() => vscode.Uri) | vscode.Uri): ScriptRoot {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new ScriptRoot(uri);
  }


  /**
   * Creates a TsConfig instance for the specified tsconfig.json file URI.
   * A TsConfig represents a TypeScript configuration file and provides methods
   * for parsing and validating the configuration.
   * 
   * @param uriSupplier A function that returns the VS Code URI for the tsconfig.json file, or a direct URI
   * @returns A new TsConfig instance
   * @throws {Error} May throw if the URI supplier returns an invalid URI or points to a non-tsconfig file
   * 
   * @example
   * ```typescript
   * // Using a function
   * const tsConfig = ScriptFactory.createTsConfig(() => 
   *   vscode.Uri.joinPath(projectUri, 'tsconfig.json')
   * );
   * 
   * // Using a direct URI
   * const directTsConfig = ScriptFactory.createTsConfig(
   *   vscode.Uri.file('/project/tsconfig.json')
   * );
   * ```
   * @lastreviewed null
   */
  export function createTsConfig(uriSupplier: (() => vscode.Uri) | vscode.Uri): TsConfig {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new TsConfig(uri);
  }
}