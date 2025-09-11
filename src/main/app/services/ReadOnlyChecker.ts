import { App } from "../App";
import { getActiveEditorUri } from "../util/data/getActiveEditorUri";
import { RemoteScriptFile } from "../util/script/RemoteScriptFile";
import * as vscode from 'vscode';

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

async function determine(sf: RemoteScriptFile) {
  const curFileName = sf.getFileName();
  const specialFileNames = ['metadata.json', 'config.json', 'b6p_metadata.json'];
  if (specialFileNames.includes(curFileName)) {
    return true;
  }
  if (sf.isInDeclarations()) {
    return true;
  }
  const config = await sf.getConfigFile();
  if (config.models?.map(m => m.name).includes(curFileName)) {
    return true;
  }
  return false;
}