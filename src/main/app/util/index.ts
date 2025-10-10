import * as path from 'path';
import * as vscode from "vscode";
import { PrimitiveNestedObject, Serializable, SourceOps } from "../../../../types";
import { IdUtility } from "./data/IdUtility";
import { Err } from './Err';
import { FileSystem } from "./fs/FileSystem";
import { ScriptFactory } from './script/ScriptFactory';
import type { ScriptFolder } from './script/ScriptFolder';

const fs = FileSystem.getInstance;
/**
 * Utility functions and types.
 */
export namespace Util {
  export function printLine(ops?: { ret?: boolean; }) {
    const stack = new Error().stack || (() => { throw new Err.NoStackTraceError(); })();
    let FULL_LINE = stack.split('\n')[2]!.trim(); // 0:Error, 1:this function, 2:

    const match = FULL_LINE.match(/\(([^)]+)\)/);
    const extracted = match && match[1] || (() => { throw new Err.NoExtractedValueError(); })();
    if (ops?.ret) {
      return extracted;
    }
    console.log("LINE:", extracted);
    return;
  }

  /**
   * performs a deep comparison between two savable objects to determine if they are equivalent.
   * @returns 
   */
  export function isDeepEqual(object1: Serializable, object2: Serializable): boolean {
    // Handle primitive values (including null)
    if (object1 === object2) {
      return true;
    }

    // If one is null/undefined and the other isn't
    /* eslint-disable eqeqeq */
    if (object1 == null || object2 == null) {
      return false;
    }

    // Handle arrays
    if (Array.isArray(object1) && Array.isArray(object2)) {
      if (object1.length !== object2.length) {
        return false;
      }
      return object1.every((item, index) => isDeepEqual(item, object2[index]));
    }

    // If one is array and other isn't
    if (Array.isArray(object1) || Array.isArray(object2)) {
      return false;
    }

    // Handle objects
    if (isNonPrimitiveSavable(object1) && isNonPrimitiveSavable(object2)) {
      const objKeys1 = Object.keys(object1);
      const objKeys2 = Object.keys(object2);

      if (objKeys1.length !== objKeys2.length) {
        return false;
      }

      for (const key of objKeys1) {
        const value1 = object1[key];
        const value2 = object2[key];

        if (!isDeepEqual(value1, value2)) {
          return false;
        }
      }
      return true;
    }

    // Different types (one object, one primitive)
    return false;
  };

  export function isNonPrimitiveSavable(object: Serializable): object is { [key: string]: Serializable; } {
    // lack of strict equality check is intentional
    /* eslint-disable eqeqeq */
    return object != null && typeof object === "object" && !Array.isArray(object);
  };


  /** 
   * Adds a value to the object at the defined path 
   * 
   * Modified from BST methodology
   */
  export function PutObjVal(obj: PrimitiveNestedObject, path: string[], val: PrimitiveNestedObject, className: string) {
    let iteratedObj = obj;
    if (path.length === 1) {
      iteratedObj[path[0]] = val;
      return;
    }
    do {
      const location = path.shift();
      if (location === undefined) {
        return;
      };
      if (iteratedObj[location] === undefined) {
        iteratedObj[location] = {};
      } else if (typeof iteratedObj[location] === className) {
        iteratedObj[location] = { [`${iteratedObj[location]}`]: iteratedObj[location] };
      }
      iteratedObj = iteratedObj[location] as PrimitiveNestedObject;
    } while (path.length > 1);
    iteratedObj[path[0]] = val;
  }

  /**
   * inserts a delay for a defined number of milliseconds.
   * @param ms 
   * @returns 
   */
  export async function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  export function rethrow<U, V>(fn: (arg: U) => V, arg: U): V {
    try {
      return fn(arg);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Gets the URI for the current file based on the provided source options.
   * @param sourceOps The source options to use for determining the URI.
   * @returns The URI of the current file.
   */
  export async function getDownstairsFileUri(sourceOps?: SourceOps): Promise<vscode.Uri> {
    if (!sourceOps) {
      return vscode.window.activeTextEditor?.document.uri || (() => { throw new Err.NoActiveEditorError(); })();
    }
    const { sourceOrigin, topId } = sourceOps;
    const url = new URL(sourceOrigin);
    let found = false;
    const curWorkspaceFolder = vscode.workspace.workspaceFolders![0]!;
    const wsDir = await fs().readDirectory(ScriptFactory.createFolder(curWorkspaceFolder.uri));

    const folderUri = wsDir.reduce(
      (curValue, [subFolderName, _fileType]) => {
        const subFolderPath = path.join(curWorkspaceFolder.uri.fsPath, subFolderName);
        if (subFolderPath.includes(url.host)) {
          if (found) {
            throw new Err.MultipleFoldersFoundError("source origin");
          }
          found = true;
          return vscode.Uri.file(subFolderPath);
        }
        return curValue;
      },
      undefined as vscode.Uri | undefined
    );
    if (!folderUri) {
      throw new Err.NoFolderFoundError("source origin");
    }
    const id = new IdUtility(topId);

    const ret = await id.findFileContaining(folderUri);
    if (!ret) {
      throw new Err.NoMatchingFileFoundError();
    }
    return ret;
  }

  /**
 * Gets the URI of the active editor; performing basic checks to ensure it is valid.
 * @returns The URI of the active editor, or undefined if not available. NOTE: it
 * will also inform the user via vscode notifications if there is an issue.
 */
  export function getActiveEditorUri({ quiet = false }: { quiet?: boolean; } = {}): vscode.Uri | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      if (!quiet) {
        vscode.window.showErrorMessage('No workspace folder is open.');
      }
      return void 0;
    }
    const activeEditor = getActiveEditor();
    if (!activeEditor) {
      if (!quiet) {
        vscode.window.showErrorMessage('No active text editor found.');
      }
      return void 0;
    }
    const workspaceUri = workspaceFolders[0].uri;
    const activeEditorUri = activeEditor.document.uri;
    if (!activeEditorUri.path.startsWith(workspaceUri.path)) {
      if (!quiet) {
        vscode.window.showWarningMessage('Active file is not in the current workspace');
      }
      return void 0;
    }
    return activeEditorUri;
  }

  /**
   * Gets the active text editor, throwing an error if none is found.
   * @returns The active text editor.
   * @throws an {@link Err.NoActiveEditorError} if there is no active text editor.
   */
  export function getActiveEditor(): vscode.TextEditor {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      throw new Err.NoActiveEditorError();
    }
    return activeEditor;
  }

  /**
 * Reads the text content of a file.
 * @param uri The URI of the file to read.
 * @returns The text content of the file.
 */
  export async function readFileText(uri: vscode.Uri) {
    const fileData = await readFileRaw(uri);
    const textContent = Buffer.from(fileData).toString('utf8');
    return textContent;
  }

  /**
   * Reads the raw binary content of a file.
   * @param uri The URI of the file to read.
   * @returns The raw binary content of the file.
   */
  export async function readFileRaw(uri: vscode.Uri) {
    const fileData = await fs().readFile(uri);
    return fileData;
  }

  /**
 * Recursively retrieves all dirty documents within a given directory.
 * @param directoryUri The URI of the directory to search.
 * @returns An array of dirty text documents within the directory.
 */
  export async function getDirtyDocs(directoryUri: vscode.Uri): Promise<vscode.TextDocument[]> {
    const activeEditorDocuments = vscode.window.visibleTextEditors.map(editor => editor.document);
    const dirtyDocs: vscode.TextDocument[] = [];
    const directory = await vscode.workspace.fs.readDirectory(directoryUri);
    for (const [name, type] of directory) {
      if (type === vscode.FileType.Directory) {
        const subDir = vscode.Uri.joinPath(directoryUri, name);
        dirtyDocs.push(...await getDirtyDocs(subDir));
      } else if (type === vscode.FileType.File) {
        const fileUri = vscode.Uri.joinPath(directoryUri, name);
        const dirtyDoc = activeEditorDocuments.find(doc => doc.uri.toString() === fileUri.toString() && doc.isDirty);
        if (dirtyDoc) {
          dirtyDocs.push(dirtyDoc);
        }
      }
    }
    return dirtyDocs;
  }
  export async function flattenDirectory(dir: ScriptFolder): Promise<vscode.Uri[]> {
    const result: vscode.Uri[] = [];
    const items = await vscode.workspace.fs.readDirectory(dir.uri());

    result.push(vscode.Uri.joinPath(dir.uri(), '/')); // include the directory itself
    for (const [name, type] of items) {
      const fullPath = vscode.Uri.joinPath(dir.uri(), name);
      if (type === vscode.FileType.Directory) {
        const subFolder = ScriptFactory.createFolder(fullPath);
        result.push(...(await flattenDirectory(subFolder)));
      } else {
        result.push(fullPath);
      }
    }
    return result;
  }

}

