import type { App } from '../App';
import { Util } from '../util/';

/**
 * Pulls files from a WebDAV location to the local workspace using B6PCore.
 *
 * @param overrideFormulaUri The URI to override the default formula URI.
 */
export default async function (app: typeof App, overrideFormulaUri?: string): Promise<void> {
  try {
    const workspacePath = Util.getActiveWorkspaceFolderUri().fsPath;

    const ran = await app.core.pull({
      formulaUrl: overrideFormulaUri,
      workspacePath,
    });

    if (ran && !(app.settings.get("squelch").pullComplete)) {
      app.core.prompt.popup('Pull complete!');
    }
  } catch (e) {
    app.core.prompt.error(`Error pulling files: ${e instanceof Error ? e.stack || e.message || e : e}`);
    throw e;
  }
}
