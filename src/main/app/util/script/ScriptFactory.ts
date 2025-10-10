
import { ScriptFile } from "./ScriptFile";
import { ScriptFolder } from "./ScriptFolder";
import type { ScriptNode } from "./ScriptNode";
import * as vscode from "vscode";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfig } from "./TsConfig";

/**
 * Factory namespace for creating ScriptNode instances (files and folders).
 * 
 * This `VERY SPECIFICALLY` exists to instantiate any ScriptNode objects.
 * You must `NEVER` call those constructors directly. This is because TypeScript
 * absolutely hates it when you do, and you risk being incapable of launching the
 * extension due to circular dependancies.
 * 
 * @lastreviewed 2025-10-01
 */
export namespace ScriptFactory {

  /**
   * Creates a ScriptNode instance (either ScriptFile or ScriptFolder) based on the URI path.
   * Automatically determines the appropriate type by checking if the path ends with '/'.
   * 
   * @param uriSupplier A function that returns the VS Code {@link vscode.Uri uri}  for the script node, or a raw URI.
   * @returns A {@link ScriptFile} if the path doesn't end with '/', otherwise a ScriptFolder
   * 
   * @example
   * ```typescript
   * // Creates a ScriptFile
   * const file = ScriptFactory.createNode(() => vscode.Uri.file('/path/to/script.ts'));
   * 
   * // Creates a ScriptFolder
   * const folder = ScriptFactory.createNode(() => vscode.Uri.file('/path/to/folder/'));
   * ```
   * @lastreviewed 2025-10-01
   */
  export function createNode(uriSupplier: (() => vscode.Uri) | vscode.Uri, scriptRoot?: ScriptRoot): ScriptNode {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    if (uri.fsPath.endsWith('/')) {
      return new ScriptFolder(uri, scriptRoot);
    } else {
      return new ScriptFile(uri, scriptRoot);
    }
  }

  /**
   * Creates a {@link ScriptFolder} instance for the specified {@link vscode.Uri uri}.
   * This method explicitly creates a folder instance regardless of the URI path format, and performs no other validation.
   * 
   * @param uriSupplier A function that returns the VS Code {@link vscode.Uri uri} for the folder, or a raw {@link vscode.Uri uri}.
   * @example
   * ```typescript
   * const folder = ScriptFactory.createFolder(() => 
   *   vscode.Uri.joinPath(workspaceUri, 'scripts', 'components')
   * );
   * ```
   * @lastreviewed 2025-10-01
   */
  export function createFolder(uriSupplier: (() => vscode.Uri) | vscode.Uri, scriptRoot?: ScriptRoot): ScriptFolder {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new ScriptFolder(uri, scriptRoot);
  }

  /**
   * Creates a {@link ScriptFile} instance for the specified {@link vscode.Uri uri}.
   * This method explicitly creates a file instance regardless of the URI path format, and performs no other validation.
   * 
   * @param uriSupplier A function that returns the VS Code {@link vscode.Uri uri} for the file, or a raw {@link vscode.Uri uri}.
   * 
   * @example
   * ```typescript
   * const file = ScriptFactory.createFile(() => 
   *   vscode.Uri.joinPath(workspaceUri, 'scripts', 'main.ts')
   * );
   * ```
   * @lastreviewed 2025-10-01
   */
  export function createFile(uriSupplier: (() => vscode.Uri) | vscode.Uri, scriptRoot?: ScriptRoot): ScriptFile {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new ScriptFile(uri, scriptRoot);
  }

  /**
   * Creates a {@link ScriptRoot} instance for the specified {@link vscode.Uri uri}.
   * and performs no form of validation.
   * @param uriSupplier A function that returns the VS Code {@link vscode.Uri uri} for the script root, or a direct {@link vscode.Uri uri}
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
   * @lastreviewed 2025-10-01
   */
  export function createScriptRoot(uriSupplier: (() => vscode.Uri) | vscode.Uri): ScriptRoot {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new ScriptRoot(uri);
  }

  /**
   * Creates a {@link TsConfig} instance for the specified tsconfig.json file {@link vscode.Uri uri}.
   * 
   * @param uriSupplier A function that returns the VS Code {@link vscode.Uri uri} for the tsconfig.json file, or a direct {@link vscode.Uri uri}
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
   * @lastreviewed 2025-10-01
   */
  export function createTsConfig(uriSupplier: (() => vscode.Uri) | vscode.Uri, scriptRoot?: ScriptRoot): TsConfig {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    return new TsConfig(uri, scriptRoot);
  }
}