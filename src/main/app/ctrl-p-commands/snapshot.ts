import { SourceOps } from "../../../../types";
import { App } from "../App";
import { Util } from "../util";
//import { FileSystem } from "../util/fs/FileSystemFactory";
import { RemoteScriptFile } from "../util/script/RemoteScriptFile";
import { Alert } from "../util/ui/Alert";

//const fs = FileSystem.getInstance;
export default async function snapshot({ overrideFormulaUri, sourceOps }: { overrideFormulaUri?: string, sourceOps?: SourceOps } = {}) {
  
  try {
    //TODO remove when done
    App.logger.info("Snapshot command called with:", overrideFormulaUri, sourceOps);
    if (overrideFormulaUri === undefined && sourceOps === undefined) {
      App.logger.info("Snapshot command called with no arguments, assuming current context");
    }
    const activeEditor = await Util.getDownstairsFileUri(sourceOps);
    const sf = new RemoteScriptFile({ downstairsUri: activeEditor });
    sf.getScriptRoot().snapshot();
    // console.log("sf.getScriptRoot().getDraftBuildFolderUri())", sf.getScriptRoot().getDraftBuildFolderUri());
    // await fs().delete(sf.getScriptRoot().getDraftBuildFolderUri()).catch(e => {console.error(e);});
    // console.log("Deleted draft build folder");
  } catch (e) {
    Alert.error("Error during snapshot: " + (e instanceof Error ? e.message : e));
  }
  
}