import * as vscode from 'vscode';
import { App } from "../App";
import { Util } from "../util";
import { ScriptFile } from '@bluestep-systems/b6p-core';
import { ScriptFactory } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';
import { Err } from '@bluestep-systems/b6p-core';

export default async function () {
  try {
    if (App.isDebugMode()) {
     return; // in debug mode, don't enforce read-only
    }
    const activeEditorUri = Util.getActiveEditorUri({ quiet: true });
    if (!activeEditorUri) {
      return; // if there's no active editor, just return. not our problem
    }
    let sf: ScriptFile;
    try {
      sf = ScriptFactory.createFile(B6PUri.fromFsPath(activeEditorUri.fsPath));
    } catch (e) {
      if (e instanceof Err.InvalidUriStructureError) {
        // Not a B6P script path (no U###### segment, etc.) — not our concern.
        return;
      }
      throw e;
    }
    if (!(await sf.exists())) {
      return; // if the active editor is not part of a script, just return. not our problem
    }

    if (await determine(sf)) {
      vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      App.isDebugMode() && App.logger.info(`Set ${activeEditorUri.toString()} to read-only`);
    } else {
      App.isDebugMode() && App.logger.info(sf.name() + " is not read-only");
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
  if (sf.isInDeclarations()) {
    return true;
  }
  return false;
}