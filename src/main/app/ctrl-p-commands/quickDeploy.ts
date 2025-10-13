import * as vscode from 'vscode';
import { ApiEndpoints } from "../../resources/constants";
import { Alert } from "../util/ui/Alert";
import { ProgressHelper } from "../util/ui/ProgressHelper";
import { App } from '../App';
import { Util } from '../util';
import { Err } from "../util/Err";
import push from "./push";

/**
 * Pushes the current file to multiple origins and topIds as specified by a function in the current file.
 */
export default async function (): Promise<void> {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor === undefined) {
    Alert.error("No active text editor found");
    return;
  }
  const curText = activeTextEditor.document.getText();
  //NOTE: we may assume that this eval is safe, as the user is in control of the contents of the file
  const getArgs = eval(curText) as (() => { recipientOrgs: string[], topIds: string[], sourceOrigin: string; });

  if (typeof getArgs !== 'function') {
    Alert.error("getArgs is not a function!");
    return;
  }
  const { recipientOrgs, topIds, sourceOrigin } = getArgs();
  App.logger.info("Quick Deploy triggered");
  const origins = recipientOrgs.map(v => new URL(v).origin);

  // Create tasks for all origin/topId combinations
  const deployTasks = [];
  for (const origin of origins) {
    for (const topId of topIds) {
      deployTasks.push({
        execute: async () => {
          const webDavId = await Util.getScriptWebdavId(origin, topId);
          if (webDavId !== null) {
            await push({
              overrideFormulaUrl: `${origin}${ApiEndpoints.FILES}${webDavId}/`,
              sourceOps: { sourceOrigin, topId },
              skipMessage: true
            });
            return { origin, topId, webDavId };
          } else {
            await Alert.error(`Could not find script at ${origin} with topId ${topId}`);
            throw new Err.ScriptNotFoundError(origin, topId);
          }
        },
        description: `${origin} - ${topId}`
      });
    }
  }

  await ProgressHelper.withProgress(deployTasks, {
    title: "Doing Quick Deploy...",
    showItemCount: true
  });


  Alert.popup("Quick Deploy complete!");
}