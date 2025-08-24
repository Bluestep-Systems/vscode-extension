import * as vscode from 'vscode';
import { getScript } from "../../util/tree";
import { BasicAuthManager } from '../../util/Auth';
/**
 * TODO
 */
export default async function (): Promise<void> {
  const startingUrl = await getStartingURL();
  if (startingUrl === undefined) {
    return;
  }
  vscode.window.showInformationMessage(`Yoinking formula from ${startingUrl.href}`);
  const ScriptObject = await getScript({ url: startingUrl, authManager: BasicAuthManager.getSingleton() });
  if (ScriptObject === undefined) {
    return;
  }
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
  const activeFolder = vscode.workspace.workspaceFolders![0]!;
  if (!activeFolder) {
    vscode.window.showErrorMessage('No active file found');
    return;
  }
  const curPath = activeFolder.uri;
  const ultimatePath = vscode.Uri.file(curPath.fsPath + "/" + startingUrl.host + "/" + path);
  const isDirectory = ultimatePath.toString().endsWith("/");

  if (isDirectory) {
    let dirExists = false;
    try {
      const stat = await vscode.workspace.fs.stat(ultimatePath);
      dirExists = stat.type === vscode.FileType.Directory;
    } catch (e) {
      // swallow this error. We need to find a better way to determine
      // if the reason for this error is that the directory exists or not, but I couldn't
      // find some analog of `optFolderExists()`
    } 
    if (dirExists) {
      //console.log(`Directory already exists: ${ultimatePath.fsPath}`);
    } else {
      await vscode.workspace.fs.createDirectory(ultimatePath);
    }
  } else {
    const creds = BasicAuthManager.getSingleton();
    const contents = await fetch("https://" + startingUrl.host + "/files/" + path, {
      method: "GET",
      headers: {
        "Authorization": `${await creds.authHeaderValue()}`
      }
    });
    vscode.workspace.fs.writeFile(ultimatePath, await contents.arrayBuffer().then(buffer => Buffer.from(buffer)));
  }
}
