import * as vscode from "vscode";
import { flattenDirectory } from "../data/flattenDirectory";
import { RemoteScriptFile } from "./RemoteScriptFile";
/**
 * A specialized RemoteScriptFile representing a tsconfig.json file.
 */
export class RemoteTsConfigFile extends RemoteScriptFile {
  public static FILENAME = "tsconfig.json";
  constructor(sf: RemoteScriptFile) {
    if (!sf.getUri().fsPath.endsWith(RemoteTsConfigFile.FILENAME)) {
      throw new Error("Provided RemoteScriptFile is not a tsconfig.json file.");
    }
    super({ downstairsUri: sf.getUri() });
  }

  static fromUri(uri: vscode.Uri): RemoteTsConfigFile {
    if (!uri.fsPath.endsWith(RemoteTsConfigFile.FILENAME)) {
      throw new Error("Provided URI does not point to a tsconfig.json file.");
    }
    return new RemoteTsConfigFile(RemoteScriptFile.fromUri(uri));
  }

  public equals(other: RemoteTsConfigFile): boolean {
    if (!(other instanceof RemoteTsConfigFile)) {
      return false;
    }
    return super.equals(other);
  }

  public async getTsFiles(): Promise<RemoteScriptFile[]> {
    return (await flattenDirectory(this.folder()))
      .filter((downstairsUri) => downstairsUri.fsPath.endsWith(".ts") || downstairsUri.fsPath.endsWith(".tsx"))
      .map(RemoteScriptFile.fromUri);
  }
}