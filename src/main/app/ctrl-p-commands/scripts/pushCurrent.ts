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

    // Validate file is saved
    if (activeEditor.document.isDirty) {
      const save = await vscode.window.showWarningMessage(
        'File has unsaved changes. Save before pushing?',
        'Save and Push',
        'Cancel'
      );
      if (save === 'Save and Push') {
        await activeEditor.document.save();
      } else {
        return;
      }
    }

    const fileMetaData = new FileMetaData({ curUri: activeEditorUri });
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


