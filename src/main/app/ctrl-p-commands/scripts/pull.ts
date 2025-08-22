import * as vscode from 'vscode';
import { State } from "../../../app/util/StateManager";
import { getScript } from "../../util/tree";
/**
 * TODO
 */
export default async function (): Promise<void> {
  const creds = await State.User.creds;
  const startingUrl = await getStartingURL();
  if (startingUrl === undefined) {
    return;
  }
  const ScriptObject = await getScript({ url: startingUrl, creds });
  console.log(ScriptObject);
  ScriptObject.rawFiles.forEach(file => {
    createFileOrFolder(file, startingUrl);
  });
}

async function getStartingURL() {
  //const STARTING_URL = "https://bst3.bluestep.net/files/1433697/draft/";
  const formulaURI = await vscode.window.showInputBox({ prompt: 'Paste in the desired formula URI' });
  if (formulaURI === undefined) {
    vscode.window.showErrorMessage('No formula URI provided');
    return;
  }
  const S = formulaURI.split("/");
  S.pop(); // get rid of last empty string
  S.pop(); // get rid of "draft" from the copy-paste
  return new URL(S.join("/")); // should look like `https://bst3.bluestep.net/files/1433697`
}

async function createFileOrFolder(path: string, startingUrl: URL): Promise<void> {
  const activeEditor = vscode.workspace.workspaceFolders![0]!;
  if (!activeEditor) {
    vscode.window.showErrorMessage('No active file found');
    return;
  }
  const curPath = activeEditor.uri;
  const filePath = vscode.Uri.file(curPath.fsPath + "/" + path);
  const isDirectory = filePath.toString().endsWith("/");

  if (isDirectory) {
    let dirExists = false;
    try {
      const stat = await vscode.workspace.fs.stat(filePath);
      dirExists = stat.type === vscode.FileType.Directory;
    } catch (e) {

    } 
    if (dirExists) {
      console.log(`Directory already exists: ${filePath.fsPath}`);
    } else {
      await vscode.workspace.fs.createDirectory(filePath);
    }
  } else {
    const creds = await State.User.creds;
    const contents = await fetch("https://" + startingUrl.host + "/files/" + path, {
      method: "GET",
      headers: {
        "Authorization": `${creds.authHeaderValue()}`
      }
    });
    vscode.workspace.fs.writeFile(filePath, await contents.arrayBuffer().then(buffer => Buffer.from(buffer)));
  }
}
