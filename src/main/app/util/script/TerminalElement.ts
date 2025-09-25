import { PathElement } from "./PathElement";
import { ScriptFolder } from "./ScriptFolder";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfig } from "./TsConfig";

export interface TerminalElement extends PathElement {
  folder(): ScriptFolder;
  getClosestTsConfigFile(): Promise<TsConfig>;
  getScriptRoot(): ScriptRoot;
}