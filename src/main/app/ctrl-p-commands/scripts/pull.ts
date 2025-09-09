import * as vscode from 'vscode';
import { App } from '../../App';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { getScript } from "../../util/data/getScript";
import { parseUrl } from "../../util/data/URLParser";
import { Alert } from '../../util/ui/Alert';
import { ScriptFile } from '../../util/script/ScriptFile';
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
   for (let i = 0; i < ScriptObject.rawFilePaths.length; i++) {
     const path = ScriptObject.rawFilePaths[i];
     await createIndividualFileOrFolder(path, url);
   }
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
      console.log(`Directory already exists: ${ultimatePath.fsPath}`);
    } else {
      await vscode.workspace.fs.createDirectory(ultimatePath);
    }
  } else {

    const sf = new ScriptFile({ downstairsUri: ultimatePath });
    const exists = await sf.fileExists();

    const lookupUri = sf.toUpstairsURL();

    App.logger.info("fetching from:", lookupUri);
    const headers: { [key: string]: string } = {};
    if (exists) {
      //headers['If-Modified-Since'] = new Date((await sf.lastModifiedTime())).toUTCString();
    }
    const response = await SM.fetch(lookupUri, {
      method: "GET",
      headers
    });
    if (response.status >= 400) {
      App.logger.error(`Error fetching file ${lookupUri.toString()}: ${response.status} ${response.statusText}`);
      throw new Error(`Error fetching file ${lookupUri.toString()}: ${response.status} ${response.statusText}`);
    }
    await sf.getScriptRoot().touchFile(ultimatePath, "lastPulled");
    if (response.status === 304) {
      App.logger.info(`File not modified since last pull: ${ultimatePath.fsPath}`);
      return;
    }
    const buffer = await response.arrayBuffer();
    await vscode.workspace.fs.writeFile(ultimatePath, Buffer.from(buffer));
  }
}
