import * as vscode from 'vscode';
import { State } from "../../../app/util/StateManager";
import { getScript } from "../../util/tree";
/**
 * TODO
 */
export default async function (): Promise<void> {
  const creds = await State.User.creds;
  const startingUrl = getStartingURL();
  const TREE = await getScript({ url: startingUrl, creds });
  console.log(TREE);
}

function getStartingURL() {
  const STARTING_URL = "https://bst3.bluestep.net/files/1433697/draft/";
  const S = STARTING_URL.split("/");
  S.pop(); // get rid of last empty string
  S.pop(); // get rid of "draft" from the copy-paste
  return new URL(S.join("/")); // should look like `https://bst3.bluestep.net/files/1433697`
}

function workspaceModifier(fileName: string): void {
  const wsedit = new vscode.WorkspaceEdit();
  const wsPath = vscode.workspace.workspaceFolders![0]!.uri.fsPath; // gets the path of the first workspace folder
  const filePath = vscode.Uri.file(wsPath + fileName);
  vscode.window.showInformationMessage(filePath.toString());
  wsedit.createFile(filePath, { ignoreIfExists: true });
  vscode.workspace.applyEdit(wsedit);
  vscode.window.showInformationMessage(`Created a new file: ${fileName}`);
}