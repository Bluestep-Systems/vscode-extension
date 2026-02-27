import * as vscode from 'vscode';
import { App } from '../App';
import { Err } from '../util/Err';
import pushScript from '../ctrl-p-commands/push';
import { ScriptFactory } from '../util/script/ScriptFactory';

/**
 * Handles the auto-save feature. When enabled via the `bsjs-push-pull.autoSave.enabled`
 * setting, a push and snapshot are triggered automatically every time a B6P script file
 * is saved.
 *
 * Non-B6P files are silently ignored so that normal VS Code saves are unaffected.
 *
 * @param document The document that was just saved.
 * @lastreviewed null
 */
export async function handleAutoSave(document: vscode.TextDocument): Promise<void> {
  if (!App.settings.get('autoSave').enabled) {
    return;
  }

  try {
    const sr = ScriptFactory.createScriptRoot(document.uri);
    const overrideFormulaUrl = await sr.toScriptBaseRemoteString();

    App.logger.info(`Auto-save: pushing ${document.uri.fsPath}`);

    // Regular push (silent – no completion popup)
    await pushScript({ overrideFormulaUrl, skipMessage: true, scriptRoot: sr });

    App.logger.info(`Auto-save: snapshotting ${document.uri.fsPath}`);

    // Compile draft folder, then push as snapshot (silent)
    await sr.compileDraftFolder();
    await pushScript({ overrideFormulaUrl, skipMessage: true, isSnapshot: true, scriptRoot: sr });

    App.logger.info(`Auto-save: completed for ${document.uri.fsPath}`);
  } catch (e) {
    if (e instanceof Err.AlreadyAlertedError) {
      // Error was already surfaced to the user by a lower-level call; nothing more to do.
      return;
    }
    // Silently skip files that are not part of a B6P script root.
    // In debug mode, log the reason so developers can diagnose unexpected failures.
    App.isDebugMode() && App.logger.info(`Auto-save: skipping ${document.uri.fsPath}: ${e}`);
  }
}
