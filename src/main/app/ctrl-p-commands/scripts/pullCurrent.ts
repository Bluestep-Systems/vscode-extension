import * as vscode from 'vscode';
export default async function (): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders![0]!.uri;
  const activeEditorUri = vscode.window.activeTextEditor!.document.uri;
  if (workspaceUri === undefined) {
    vscode.window.showErrorMessage('No source path provided');
    return;
  }
  console.log("Active Editor URI:", activeEditorUri.toString());
  console.log("workspace URI:", workspaceUri.toString());
  
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


