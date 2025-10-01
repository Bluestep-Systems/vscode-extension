import * as vscode from 'vscode';
import { App } from "../App";
import { getActiveEditorUri } from "../util/data/getActiveEditorUri";
import { ScriptFile } from '../util/script/ScriptFile';
import { ScriptRoot } from "../util/script/ScriptRoot";
import { ScriptFactory } from '../util/script/ScriptFactory';

export default async function () {
  try {
    if (App.isDebugMode()) {
     return; // in debug mode, don't enforce read-only
    }
    const activeEditorUri = getActiveEditorUri({ quiet: true });
    if (!activeEditorUri) {
      return; // if there's no active editor, just return. not our problem
    }
    const sf = ScriptFactory.createFile(activeEditorUri);
    if (!(await sf.exists())) {
      return; // if the active editor is not part of a script, just return. not our problem
    }

    if (await determine(sf)) {
      vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      App.isDebugMode() && App.logger.info(`Set ${activeEditorUri.toString()} to read-only`);
    } else {
      App.isDebugMode() && App.logger.info(sf.fileName() + " is not read-only");
    }
  } catch (e) {
    App.logger.error("Error checking read-only status:", e);
  }
}

/**
 * perform a determination on if the current file should be set to read only.
 * 
 * //TODO improve this logic to be more efficient
 * @param sf 
 */
async function determine(sf: ScriptFile) {
  const curFileName = sf.fileName();
  const specialFileNames = [ScriptRoot.METADATA_FILENAME];
  if (specialFileNames.includes(curFileName)) {
    return true;
  }
  if (sf.isInDeclarations()) {
    return true;
  }
  if (await sf.isInInfoOrObjects()) {
    return true;
  }
  if (await sf.isExternalModel()) {
    return true;
  }
  return false;
}