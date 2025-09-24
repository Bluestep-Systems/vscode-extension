import { RemoteScriptFolder } from "./RemoteScriptFolder";
import { RemoteScriptRoot } from "./RemoteScriptRoot";
import { TsConfigFile } from "./TsConfigFile";

export interface TerminalElement {
  folder(): RemoteScriptFolder;
  getClosestTsConfigFile(): Promise<TsConfigFile>;
  getScriptRoot(): RemoteScriptRoot;
}