import type { SourceOps } from '../../../../types';
import { App } from '../App';
import { Util } from '../util';
import { Alert } from '../util/ui/Alert';
import { ScriptRoot } from '../util/script/ScriptRoot';

/**
 * Pushes a script to a WebDAV location using the platform-agnostic B6PCore.
 *
 * @param overrideFormulaUrl The URI to override the default formula URI.
 * @param sourceOps The options for overriding the source location
 * @param skipMessage Whether to skip the completion message
 * @param isSnapshot Whether this is a snapshot push
 * @param scriptRoot Optional pre-resolved ScriptRoot instance
 */
export default async function ({ overrideFormulaUrl, sourceOps, skipMessage, isSnapshot, scriptRoot }: {
  overrideFormulaUrl?: string;
  sourceOps?: SourceOps;
  skipMessage?: boolean;
  isSnapshot?: boolean;
  scriptRoot?: ScriptRoot;
}): Promise<void> {
  try {
    // Get the source file path
    let rootPath: string;
    if (scriptRoot) {
      rootPath = scriptRoot.getRootUri().fsPath;
    } else {
      const sourceEditorUri = await Util.getDownstairsFileUri(sourceOps);
      if (sourceEditorUri === undefined) {
        Alert.error('No source path provided');
        return;
      }
      App.logger.info(Util.printLine({ ret: true }) as string + "Pushing script for: " + sourceEditorUri.toString());
      rootPath = sourceEditorUri.fsPath;
    }

    // Use B6PCore for the push operation (handles all business logic)
    await App.core.push({
      targetUrl: overrideFormulaUrl, // Will prompt if undefined
      rootPath,
      snapshot: isSnapshot ?? false,
    });

    // Show completion message (unless squelched)
    if (!skipMessage && !(App.settings.get("squelch").pushComplete)) {
      Alert.popup(isSnapshot ? 'Snapshot complete!' : 'Push complete!');
    }
  } catch (e) {
    Alert.error(`Error pushing files: ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}


