import * as vscode from 'vscode';
import { getFileMetaData } from '../../util/FileMetaData';
import pullScript from '../scripts/pull';
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
  pullScript(`https://${domain}/files/${webdavId}/`);
}