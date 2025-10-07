import { OrgWorker } from '../app/util/data/OrgWorker';
import { FileSystem } from '../app/util/fs/FileSystem';
import { ScriptFactory } from "../app/util/script/ScriptFactory";
import { Converter } from "./Converter";
const fs = FileSystem.getInstance;
export class Converter1_0_1_to_1_1_0 extends Converter {
  public fromVersion = "1.0.1";
  public toVersion = "1.1.0";
  async convert(): Promise<void> {
    const metaDataFiles = await fs().findFiles("**/.b6p_metadata.json");

    await Promise.all(metaDataFiles.map(async (file) => {
      const sf = ScriptFactory.createFile(file);
      const sr = sf.getScriptRoot();
      const metaDataDotJson = await sr.getAsFolder().getMetadataFile();
      const U = await new OrgWorker(sr.toScriptBaseUpstairsUrl()).getU();
      await sr.modifyMetaData(meta => {
        meta.U = U;
        meta.scriptName = metaDataDotJson.displayName || (() => { throw new Error("Missing displayName in metadata"); })();
      });
    }));
  }
}