import { RemoteScriptFolder } from "./RemoteScriptFolder";

export interface TerminalElement {
  folder(): RemoteScriptFolder;
}