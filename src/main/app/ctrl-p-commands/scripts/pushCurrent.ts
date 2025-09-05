import * as vscode from 'vscode';
import { FileMetaData } from '../../util/data/FileMetaData';
import { Alert } from '../../util/ui/Alert';
import pushScript from '../scripts/push';


/**
 * Pushes the current file (the one the editor is currently open to) to its associated WebDAV location.
 * @returns 
 */
export default async function (): Promise<void> {

  try {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder is open.');
      return;
    }
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage('No active text editor found.');
      return;
    }
    const workspaceUri = workspaceFolders[0].uri;
    const activeEditorUri = activeEditor.document.uri;
    if (!activeEditorUri.path.startsWith(workspaceUri.path)) {
      vscode.window.showWarningMessage('Active file is not in the current workspace');
      return;
    }

    const fileMetaData = new FileMetaData({ curUri: activeEditorUri });
    const dirtyDocs = await getDirtyDocs(fileMetaData.get_webdavId_folderUri());
    if (dirtyDocs.length > 0) {
      const SAVE_AND_PUSH = 'Save and Push';
      const CANCEL = 'Cancel';
      const save = await vscode.window.showWarningMessage(
        `${dirtyDocs.length} files have unsaved changes. Save before pushing?\n ${dirtyDocs.map(doc => doc.uri.fsPath).join('\n ')}`,
        SAVE_AND_PUSH,
        CANCEL
      );
      if (save === SAVE_AND_PUSH) {
        await Promise.all(dirtyDocs.map(doc => doc.save()));
      } else if (save === CANCEL) {
        // we may want to save the current state of affairs here in order to implement some kind of "resume from..." functionality,
        // but for now just exit
        return;
      } else {
        return;
      }
    }

    await pushScript(fileMetaData.toBasePullPushUrlString());
  } catch(e) {
    
    if (e instanceof Error) { 
      Alert.error(`Error pushing current file: ${e.message}`);
      console.error('Push current file error:', e.stack || e.message || e);
    } else {
      Alert.error(`Error pushing current file: ${e}`);
      console.error('Push current file error:', e);
    }
  }
}

async function getDirtyDocs(uri: vscode.Uri): Promise<vscode.TextDocument[]> {
  const activeEditorDocuments = vscode.window.visibleTextEditors.map(editor => editor.document);
  const dirtyDocs: vscode.TextDocument[] = [];
  const directory = await vscode.workspace.fs.readDirectory(uri);
  for (const [name, type] of directory) {
    if (type === vscode.FileType.Directory) {
      const subDir = vscode.Uri.joinPath(uri, name);
      dirtyDocs.push(...await getDirtyDocs(subDir));
    } else if (type === vscode.FileType.File) {
      const fileUri = vscode.Uri.joinPath(uri, name);
      const dirtyDoc = activeEditorDocuments.find(doc => doc.uri.toString() === fileUri.toString() && doc.isDirty);
      if (dirtyDoc) {
        dirtyDocs.push(dirtyDoc);
      }
    }
  }
  return dirtyDocs;
}
