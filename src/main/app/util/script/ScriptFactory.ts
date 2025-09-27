
import { ScriptFile } from "./ScriptFile";
import { ScriptFolder } from "./ScriptFolder";
import type { ScriptNode } from "./ScriptNode";
import * as vscode from "vscode";
//import { FileSystem } from "../fs/FileSystem";
//const fs = FileSystem.getInstance();
console.log("ScriptFactory loaded");
export namespace ScriptFactory {

  export function createNode(uriSupplier: () => vscode.Uri): ScriptNode {
    
    if (uriSupplier().fsPath.endsWith('/')) {
      return new ScriptFolder(uriSupplier());
    } else {
      return new ScriptFile(uriSupplier());
    }
  }

  export function createFolder(uriSupplier: () => vscode.Uri): ScriptFolder {
    return new ScriptFolder(uriSupplier());
  }

  export function createFile(uriSupplier: () => vscode.Uri): ScriptFile {
    return new ScriptFile(uriSupplier());
  }
}