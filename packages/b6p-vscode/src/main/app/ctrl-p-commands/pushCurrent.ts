import * as vscode from 'vscode';
import type { B6PCore, ScriptRoot } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';
import { Util } from '../util';

/**
 * Pushes the current file (the one the editor is currently open to) to its associated WebDAV location using B6PCore.
 */
export default async function (core: B6PCore, args?: { isSnapshot: boolean; sr: ScriptRoot }): Promise<void> {
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
      actual_sr = core.getScriptFactory().createScriptRoot(B6PUri.fromFsPath(activeEditorUri.fsPath));
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

    await core.pushCurrent({
      filePath: actual_sr.getRootUri().fsPath,
      snapshot: args?.isSnapshot ?? false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    core.prompt.error(`Error pushing current file: ${message}`);
    core.logger.error('Push current file error:', e);
  }
}
