import * as vscode from 'vscode';
import { App } from '../App';
import { getActiveEditorUri } from '../util/data/getActiveEditorUri';
import { getDirtyDocs } from '../util/data/getDirtyDocs';
import { ScriptFile } from '../util/script/ScriptFile';
import { Alert } from '../util/ui/Alert';
import pushScript from './push';


/**
 * Pushes the current file (the one the editor is currently open to) to its associated WebDAV location.
 * @returns 
 */
export default async function (): Promise<void> {

  try {

    const activeEditorUri = getActiveEditorUri();
    if (activeEditorUri === undefined) {
      return;
    }
    const fileMetaData = new ScriptFile(activeEditorUri);
    const dirtyDocs = await getDirtyDocs(fileMetaData.getScriptRoot().getRootUri());
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

    await pushScript({ overrideFormulaUri: fileMetaData.getScriptRoot().toBaseUpstairsString() });
  } catch(e) {
    
    if (e instanceof Error) { 
      Alert.error(`Error pushing current file: ${e.message}`);
      App.logger.error(e);
    } else {
      Alert.error(`Error pushing current file: ${e}`);
      App.logger.error('Push current file error: ' + e);
    }
  }
}
