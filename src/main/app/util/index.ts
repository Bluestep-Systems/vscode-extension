import * as path from 'path';
import * as vscode from "vscode";
import { PrimitiveNestedObject, Serializable, SourceOps } from "../../../../types";
import { IdUtility } from "./data/IdUtility";
import { FileSystem } from "./fs/FileSystem";
import { Folder } from './script/Folder';
import { Err } from './Err';

const fs = FileSystem.getInstance;
/**
 * Utility functions and types.
 */
export namespace Util {
  export function printLine(ops?: { ret?: boolean }) {
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

  export function isNonPrimitiveSavable(object: Serializable): object is { [key: string]: Serializable } {
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

  export function rethrow<U,V>(fn: (arg: U) => V, arg: U): V {
    try {
      return fn(arg);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Gets the URI for the current file based on the provided source operations.
   * @param sourceOps The source operations to use for determining the URI.
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
    const wsDir = await fs().readDirectory(await Folder.fromUri(curWorkspaceFolder.uri));
  
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
}

