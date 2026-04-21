import * as vscode from 'vscode';
import { ApiEndpoints, Err } from '@bluestep-systems/b6p-core';
import type { App } from '../App';
import { Util } from '../util';
import push from "./push";

/**
 * Pushes the current file to multiple origins and topIds as specified by a function in the current file.
 */
export default async function (app: typeof App): Promise<void> {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor === undefined) {
    app.core.prompt.error("No active text editor found");
    return;
  }
  const curText = activeTextEditor.document.getText();
  //NOTE: we may assume that this eval is safe, as the user is in control of the contents of the file
  const getArgs = eval(curText) as (() => { recipientOrgs: string[], topIds: string[], sourceOrigin: string; });

  if (typeof getArgs !== 'function') {
    app.core.prompt.error("getArgs is not a function!");
    return;
  }
  const { recipientOrgs, topIds, sourceOrigin } = getArgs();
  app.logger.info("Quick Deploy triggered");
  const origins = recipientOrgs.map(v => new URL(v).origin);

  const deployTasks = [];
  for (const origin of origins) {
    for (const topId of topIds) {
      deployTasks.push({
        execute: async () => {
          const webDavId = await Util.getScriptWebdavId(origin, topId);
          if (webDavId !== null) {
            await push(app, {
              overrideFormulaUrl: `${origin}${ApiEndpoints.FILES}${webDavId}/`,
              sourceOps: { sourceOrigin, topId },
              skipMessage: true
            });
            return { origin, topId, webDavId };
          } else {
            app.core.prompt.error(`Could not find script at ${origin} with topId ${topId}`);
            throw new Err.ScriptNotFoundError(origin, topId);
          }
        },
        description: `${origin} - ${topId}`
      });
    }
  }

  await app.core.progress.withProgress(deployTasks, {
    title: "Doing Quick Deploy...",
    showItemCount: true
  });

  app.core.prompt.popup("Quick Deploy complete!");
}
