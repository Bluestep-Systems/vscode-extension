import * as vscode from 'vscode';
import { App } from '../App';
import { Util } from '../util';
import { ScriptFactory } from '../../../core/script/ScriptFactory';
import { B6PUri } from '../../../core/B6PUri';
import type { ScriptRoot } from '../../../core/script/ScriptRoot';

/**
 * Pushes the current file (the one the editor is currently open to) to its associated WebDAV location using B6PCore.
 */
export default async function (args?: { isSnapshot: boolean; sr: ScriptRoot }): Promise<void> {
  try {
    // Determine the script root
    let actual_sr: ScriptRoot;
    if (args?.sr) {
      actual_sr = args.sr;
    } else {
      const activeEditorUri = Util.getActiveEditorUri();
      if (activeEditorUri === undefined) {
        return;
      }
      actual_sr = ScriptFactory.createScriptRoot(B6PUri.fromFsPath(activeEditorUri.fsPath));
    }

    // Check for unsaved changes
    const dirtyDocs = await Util.getDirtyDocs(vscode.Uri.file(actual_sr.getRootUri().fsPath));
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
      } else {
        return; // User cancelled
      }
    }

    // Use B6PCore for pushCurrent
    await App.core.pushCurrent({
      filePath: actual_sr.getRootUri().fsPath,
      snapshot: args?.isSnapshot ?? false,
    });

    // Success message shown by B6PCore
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    App.core.prompt.error(`Error pushing current file: ${message}`);
    App.logger.error('Push current file error:', e);
  }
}
