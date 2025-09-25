import { PathElement } from "./PathElement";
import { ScriptFolder } from "./ScriptFolder";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfigFile } from "./TsConfigFile";

export interface TerminalElement extends PathElement {
  folder(): ScriptFolder;
  getClosestTsConfigFile(): Promise<TsConfigFile>;
  getScriptRoot(): ScriptRoot;
}