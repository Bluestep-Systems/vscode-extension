import * as vscode from 'vscode';
import { getScript } from "../../util/data/getScript";
import { urlParser } from "../../util/data/URLParser";
import { BasicAuthManager } from '../../services/Auth';
import { Util } from '../../util';
import { Alert } from '../../util/ui/Alert';
/**
 * TODO
 */
export default async function (overrideFormulaUri?: string): Promise<void> {
 try {
   const urlObj = await getStartingURL(overrideFormulaUri);
   if (urlObj === undefined) {
     return;
   }
   const { url, webDavId } = urlObj;
   const ScriptObject = await getScript({ url, webDavId, authManager: BasicAuthManager.getSingleton() });
   if (ScriptObject === undefined) {
     return;
   }
   ScriptObject.rawFilePaths.forEach(async path => {
     await createIndividualFileOrFolder(path, url);
   });
   Alert.info('Pull complete!');
 } catch (e) {
   Alert.error(`Error pulling files: ${e}`);
 }
}

async function getStartingURL(overrideFormulaUri?: string) {
  const formulaURI = overrideFormulaUri || await vscode.window.showInputBox({ prompt: 'Paste in the desired formula URI' });
  if (formulaURI === undefined) {
    vscode.window.showErrorMessage('No formula URI provided');
    return;
  }
  return urlParser(formulaURI);
}

async function createIndividualFileOrFolder(path: string, sourceUrl: URL): Promise<void> {
  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  if (!activeFolder) {
    vscode.window.showErrorMessage('No active file found');
    return;
  }
  const curPath = activeFolder.uri;
  const ultimatePathStr = curPath.fsPath + "/" + sourceUrl.host + "/" + path;
  const ultimatePath = vscode.Uri.file(ultimatePathStr);
  
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
    const authManager = BasicAuthManager.getSingleton();
    const lookupUri = "https://" + sourceUrl.host + "/files/" + path;
    Util.printLine();
    console.log("fetching from:", lookupUri);
    const contents = await fetch(lookupUri, {
      method: "GET",
      headers: {
        "Authorization": `${await authManager.authHeaderValue()}`
      }
    });
    vscode.workspace.fs.writeFile(ultimatePath, await contents.arrayBuffer().then(buffer => Buffer.from(buffer)));
  }
}
