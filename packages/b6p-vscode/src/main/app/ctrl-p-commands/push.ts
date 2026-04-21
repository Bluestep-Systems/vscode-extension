import type { ScriptRoot, SourceOps } from '@bluestep-systems/b6p-core';
import type { App } from '../App';
import { Util } from '../util';

/**
 * Pushes a script to a WebDAV location using the platform-agnostic B6PCore.
 *
 * @param overrideFormulaUrl The URI to override the default formula URI.
 * @param sourceOps The options for overriding the source location
 * @param skipMessage Whether to skip the completion message
 * @param isSnapshot Whether this is a snapshot push
 * @param scriptRoot Optional pre-resolved ScriptRoot instance
 */
export default async function (
  app: typeof App,
  { overrideFormulaUrl, sourceOps, skipMessage, isSnapshot, scriptRoot }: {
    overrideFormulaUrl?: string;
    sourceOps?: SourceOps;
    skipMessage?: boolean;
    isSnapshot?: boolean;
    scriptRoot?: ScriptRoot;
  } = {}
): Promise<void> {
  try {
    let rootPath: string;
    if (scriptRoot) {
      rootPath = scriptRoot.getRootUri().fsPath;
    } else {
      const sourceEditorUri = await Util.getDownstairsFileUri(sourceOps);
      if (sourceEditorUri === undefined) {
        app.core.prompt.error('No source path provided');
        return;
      }
      app.logger.info(Util.printLine({ ret: true }) as string + "Pushing script for: " + sourceEditorUri.toString());
      rootPath = sourceEditorUri.fsPath;
    }

    await app.core.push({
      targetUrl: overrideFormulaUrl,
      rootPath,
      snapshot: isSnapshot ?? false,
    });

    if (!skipMessage && !(app.settings.get("squelch").pushComplete)) {
      app.core.prompt.popup(isSnapshot ? 'Snapshot complete!' : 'Push complete!');
    }
  } catch (e) {
    app.core.prompt.error(`Error pushing files: ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}
