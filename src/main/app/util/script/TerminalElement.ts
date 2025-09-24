import { PathElement } from "./PathElement";
import { RemoteScriptFolder } from "./RemoteScriptFolder";
import { RemoteScriptRoot } from "./RemoteScriptRoot";
import { TsConfigFile } from "./TsConfigFile";

export interface TerminalElement extends PathElement {
  folder(): RemoteScriptFolder;
  getClosestTsConfigFile(): Promise<TsConfigFile>;
  getScriptRoot(): RemoteScriptRoot;
}