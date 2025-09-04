import * as vscode from 'vscode';
import { getFileMetaData } from '../../util/data/FileMetaData';
import pushScript from '../scripts/push';


/**
 * Pushes the current file (the one the editor is currently open to) to its associated WebDAV location.
 * @returns 
 */
export default async function (): Promise<void> {
  const workspaceUri = vscode.workspace.workspaceFolders![0]!.uri;
  const activeEditorUri = vscode.window.activeTextEditor!.document.uri;
  if (workspaceUri === undefined) {
    vscode.window.showErrorMessage('No source path provided');
    return;
  }
  console.log("Active Editor URI:", activeEditorUri.toString());
  console.log("workspace URI:", workspaceUri.toString());
  const { webdavId, domain } = await getFileMetaData({ curUri: activeEditorUri });
  pushScript(`https://${domain}/files/${webdavId}/`);
}


