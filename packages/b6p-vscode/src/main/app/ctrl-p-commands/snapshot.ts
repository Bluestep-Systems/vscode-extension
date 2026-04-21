import type { B6PCore, SourceOps } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';
import { Util } from "../util";
import pushCurrent from "./pushCurrent";

export default async function snapshot(
  core: B6PCore,
  { overrideFormulaUri, sourceOps }: { overrideFormulaUri?: string, sourceOps?: SourceOps } = {}
) {
  try {
    //TODO remove when done
    core.logger.info("Snapshot command called with:", overrideFormulaUri, sourceOps);
    if (overrideFormulaUri === undefined && sourceOps === undefined) {
      core.logger.info("Snapshot command called with no arguments, assuming current context");
    }
    const contextualUri = await Util.getDownstairsFileUri(sourceOps);
    core.logger.info("Contextual URI determined to be:", contextualUri?.toString() ?? "undefined");
    const sf = core.getScriptFactory().createFile(B6PUri.fromFsPath(contextualUri.fsPath));
    await sf.getScriptRoot().snapshot(async (sr) => {
      await pushCurrent(core, { isSnapshot: true, sr });
    });
  } catch (e) {
    core.prompt.error("Error during snapshot: " + (e instanceof Error ? e.message : e));
  }
}
