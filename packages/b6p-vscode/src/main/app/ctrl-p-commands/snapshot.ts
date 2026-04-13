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
    await sf.getScriptRoot().snapshot(async (sr) => {
      await pushCurrent({ isSnapshot: true, sr });
    });
    // console.log("sf.getScriptRoot().getDraftBuildFolderUri())", sf.getScriptRoot().getDraftBuildFolderUri());
    // await fs().delete(sf.getScriptRoot().getDraftBuildFolderUri()).catch(e => {console.error(e);});
    // console.log("Deleted draft build folder");
  } catch (e) {
    App.core.prompt.error("Error during snapshot: " + (e instanceof Error ? e.message : e));
  }
  
}