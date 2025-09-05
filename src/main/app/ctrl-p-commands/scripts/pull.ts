import * as vscode from 'vscode';
import { App } from '../../App';
import { SESSION_MANAGER } from '../../b6p_session/SessionManager';
import { getScript } from "../../util/data/getScript";
import { parseUrl } from "../../util/data/URLParser";
import { Alert } from '../../util/ui/Alert';
/**
 * Pulls files from a WebDAV location to the local workspace.
 * @param overrideFormulaUri The URI to override the default formula URI.
 * @returns A promise that resolves when the pull is complete.
 */
export default async function (overrideFormulaUri?: string): Promise<void> {
 try {
   const urlObj = await getStartingURL(overrideFormulaUri);
   if (urlObj === undefined) {
     return;
   }
   const { url, webDavId } = urlObj;
   const ScriptObject = await getScript({ url, webDavId });
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
  return parseUrl(formulaURI);
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
    const lookupUri = "https://" + sourceUrl.host + "/files/" + path;
    App.logger.info("fetching from:", lookupUri);
    const contents = await SESSION_MANAGER.fetch(lookupUri, {
      method: "GET",
    });
    vscode.workspace.fs.writeFile(ultimatePath, await contents.arrayBuffer().then(buffer => Buffer.from(buffer)));
  }
}
