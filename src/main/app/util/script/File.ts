import { PathElement } from "./PathElement";
import { Folder } from "./Folder";
import { ScriptRoot } from "./ScriptRoot";
import { TsConfig } from "./TsConfig";

export interface File extends PathElement {
  folder(): Folder;
  getClosestTsConfigFile(): Promise<TsConfig>;
  getScriptRoot(): ScriptRoot;
  isCopacetic(): Promise<boolean>;
  getScriptRoot(): ScriptRoot;
}