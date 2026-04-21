import { SourceOps } from '@bluestep-systems/b6p-core';
import { App } from "../App";
import { Util } from "../util";
import { ScriptFactory } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';
import pushCurrent from "./pushCurrent";
export default async function snapshot({ overrideFormulaUri, sourceOps }: { overrideFormulaUri?: string, sourceOps?: SourceOps } = {}) {

  try {
    //TODO remove when done
    App.logger.info("Snapshot command called with:", overrideFormulaUri, sourceOps);
    if (overrideFormulaUri === undefined && sourceOps === undefined) {
      App.logger.info("Snapshot command called with no arguments, assuming current context");
    }
    // "contextual" meaning currently open or determined from sourceOps
    const contextualUri = await Util.getDownstairsFileUri(sourceOps);
    App.logger.info("Contextual URI determined to be:", contextualUri?.toString() ?? "undefined");
    const sf = ScriptFactory.createFile(B6PUri.fromFsPath(contextualUri.fsPath));
    const sr = sf.getScriptRoot();
    const message = await App.core.prompt.inputBox({
      prompt: 'Snapshot commit message (optional)',
    });
    if (message === undefined) {
      return; // user cancelled
    }
    await pushCurrent({ isSnapshot: true, sr, message });
  } catch (e) {
    App.core.prompt.error("Error during snapshot: " + (e instanceof Error ? e.message : e));
  }

}
