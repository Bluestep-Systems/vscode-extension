import { App } from '../App';
import { Util } from '../util/';

let activePull: Promise<void> | null = null;

/**
 * Pulls files from a WebDAV location to the local workspace using B6PCore.
 *
 * @param overrideFormulaUri The URI to override the default formula URI.
 */
export default async function (overrideFormulaUri?: string): Promise<void> {
  if (activePull !== null) {
    App.core.prompt.warn("A pull operation is already in progress");
    return;
  }
  activePull = pullImpl(overrideFormulaUri);
  try {
    await activePull;
  } finally {
    activePull = null;
  }
}

async function pullImpl(overrideFormulaUri?: string): Promise<void> {
  try {
    const workspacePath = Util.getActiveWorkspaceFolderUri().fsPath;

    // Use B6PCore for the pull operation (handles all business logic)
    await App.core.pull({
      formulaUrl: overrideFormulaUri, // Will prompt if undefined
      workspacePath,
    });

    // Show completion message (unless squelched)
    if (!(App.settings.get("squelch").pullComplete)) {
      App.core.prompt.popup('Pull complete!');
    }
  } catch (e) {
    App.core.prompt.error(`Error pulling files: ${e instanceof Error ? e.stack || e.message || e : e}`);
    throw e;
  }
}

