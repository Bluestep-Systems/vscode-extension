
import { ScriptFile } from "./ScriptFile";
import { ScriptFolder } from "./ScriptFolder";
import type { ScriptNode } from "./ScriptNode";
import * as vscode from "vscode";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfig } from "./TsConfig";
import * as path from 'path';
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
   * Automatically determines the appropriate type by checking path characteristics.
   *
   * @param uriSupplier A function that returns the {@link vscode.Uri} for the script node, or a raw {@link vscode.Uri} itself.
   * @param scriptRoot Optional {@link ScriptRoot} associated with this script node.
   *
   * @returns A {@link ScriptNode} which is either a {@link ScriptFile} or {@link ScriptFolder} instance.
   * The type is determined by checking if the path ends with a separator or has a file extension.
   *
   * @example
   * ```typescript
   * // Creates a ScriptFile
   * const file = ScriptFactory.createNode(() => vscode.Uri.file('/path/to/script.ts'));
   *
   * // Creates a ScriptFolder
   * const folder = ScriptFactory.createNode(() => vscode.Uri.file('/path/to/folder/'));
   * ```
   *
   * @remarks
   * For better reliability, prefer using {@link createFile} or {@link createFolder} when the type is known.
   *
   * @lastreviewed 2025-10-01
   */
  export function createNode(uriSupplier: (() => vscode.Uri) | vscode.Uri, scriptRoot?: ScriptRoot): ScriptNode {
    const uri = uriSupplier instanceof Function ? uriSupplier() : uriSupplier;
    const fsPath = uri.fsPath;

    // Check if path explicitly ends with a separator (caller's intent to mark as folder)
    if (fsPath.endsWith(path.sep) || fsPath.endsWith('/')) {
      return new ScriptFolder(uri, scriptRoot);
    }

    // Check if path has a file extension (indicates it's likely a file)
    const basename = path.basename(fsPath);
    if (basename.includes('.')) {
      return new ScriptFile(uri, scriptRoot);
    }

    // Default to file for backwards compatibility
    return new ScriptFile(uri, scriptRoot);
  }

  /**
   * Creates a {@link ScriptFolder} instance for the specified {@link vscode.Uri}.
   * This method explicitly creates a folder instance regardless of the URI path format, and performs no other validation.
   * 
   * @param uriSupplier A function that returns the {@link vscode.Uri} for the folder, or a raw {@link vscode.Uri} itself.
   * @param scriptRoot Optional {@link ScriptRoot} associated with this script folder.
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
   * @param uriSupplier A function that returns the {@link vscode.Uri} for the file, or a raw {@link vscode.Uri} itself
   * @param scriptRoot Optional {@link ScriptRoot} associated with this script file.
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
   * @param uriSupplier A function that returns the {@link vscode.Uri} for the script root, or a direct {@link vscode.Uri}
   * @param scriptRoot Optional {@link ScriptRoot} associated with this script root.
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
   * Creates a {@link TsConfig} instance for the specified tsconfig.json file {@link vscode.Uri}.
   * 
   * @param uriSupplier A function that returns the {@link vscode.Uri} for the tsconfig.json file, or a direct {@link vscode.Uri}.
   * @param scriptRoot Optional {@link ScriptRoot} associated with this tsconfig file.
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