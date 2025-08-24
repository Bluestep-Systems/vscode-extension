import * as vscode from 'vscode';
import { getFileMetaData } from '../../util/FileMetaData';
import { pullScript, pushScript } from '..';
export default async function (): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders![0]!.uri;
  const activeEditorUri = vscode.window.activeTextEditor!.document.uri;
  if (workspaceUri === undefined) {
    vscode.window.showErrorMessage('No source path provided');
    return;
  }
  console.log("Active Editor URI:", activeEditorUri.toString());
  console.log("workspace URI:", workspaceUri.toString());
  const { webdavId, domain } = await getFileMetaData({ workspaceUri: workspaceUri, curUri: activeEditorUri });
  pushScript(`https://${domain}/files/${webdavId}/draft/`);
  // const { url, webDavId, trailing } = urlObj;
  // vscode.window.showInformationMessage(`Yoinking formula from ${url.href}`);
  // const ScriptObject = await getScript({ url, authManager: BasicAuthManager.getSingleton() });
  // if (ScriptObject === undefined) {
  //   return;
  // }
  // ScriptObject.rawFiles.forEach(file => {
  //   createIndividualFileOrFolder(file, url);
  // });
}


