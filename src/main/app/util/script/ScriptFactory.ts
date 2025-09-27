
import { ScriptFile } from "./ScriptFile";
import { ScriptFolder } from "./ScriptFolder";
import type { ScriptNode } from "./ScriptNode";
import * as vscode from "vscode";
//import { FileSystem } from "../fs/FileSystem";
//const fs = FileSystem.getInstance();
console.log("ScriptFactory loaded");
export namespace ScriptFactory {

  export function createScriptFromUri(uri: vscode.Uri): ScriptNode {
    
    if (uri.fsPath.endsWith('/')) {
      return new ScriptFolder(uri);
    } else {
      return new ScriptFile(uri);
    }
  }

  export function createScriptFolderFromUri(uri: vscode.Uri): ScriptFolder {
    return new ScriptFolder(uri);
  }

  export function createScriptFileFromUri(uri: vscode.Uri): ScriptFile {
    return new ScriptFile(uri);
  }
}