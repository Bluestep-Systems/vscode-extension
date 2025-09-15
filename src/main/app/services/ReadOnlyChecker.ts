import * as vscode from 'vscode';
import { App } from "../App";
import { getActiveEditorUri } from "../util/data/getActiveEditorUri";
import { RemoteScriptFile } from "../util/script/RemoteScriptFile";
import { RemoteScriptRoot } from "../util/script/RemoteScriptRoot";

export default async function () {
  try {
    const activeEditorUri = getActiveEditorUri({ quiet: true });
    if (!activeEditorUri) {
      return; // if there's no active editor, just return. not our problem
    }
    const sf = new RemoteScriptFile({ downstairsUri: activeEditorUri });
    if (!(await sf.exists())) {
      return; // if the active editor is not part of a script, just return. not our problem
    }

    if (await determine(sf)) {
      vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      App.logger.info(`Set ${activeEditorUri.toString()} to read-only`);
    } else {
      App.logger.info(sf.getFileName() + " is not read-only");
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
 * @returns 
 */
async function determine(sf: RemoteScriptFile) {
  const curFileName = sf.getFileName();
  const specialFileNames = [RemoteScriptRoot.METADATA_FILE];
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