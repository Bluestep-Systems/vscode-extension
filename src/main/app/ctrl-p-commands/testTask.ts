import { Util } from '../util';
import * as vscode from 'vscode';
import { ScriptFactory } from '../util/script/ScriptFactory';
import { ORG_CACHE } from '../cache/OrgCache';

export default async function () {
  const activeUri = await Util.getDownstairsFileUri();
  const sf = ScriptFactory.createFile(activeUri);
  const layerUp = vscode.Uri.joinPath(sf.getScriptRoot().getAsFolder().uri(), "..");
  console.log("Test Task: Layer up is ", layerUp.toString());
  await ORG_CACHE.clearCache();
  console.log("CACHE MAP:", ORG_CACHE.map());
}