import * as vscode from 'vscode';
import { ScriptFactory } from '../../../core/script/ScriptFactory';
import { B6PUri } from '../../../core/B6PUri';
import { Alert } from '../util/ui/Alert';
import { Util } from '../util';

export default async function (): Promise<void> {
  try {
    const contextualUri = await Util.getDownstairsFileUri();
    const scriptRoot = ScriptFactory.createFile(B6PUri.fromFsPath(contextualUri.fsPath)).getScriptRoot();
    const scriptKey = await scriptRoot.getScriptKey();
    const origin = await scriptRoot.anyOrigin();
    const setupUrl = scriptKey.buildSetupUrl(origin);
    await vscode.env.openExternal(vscode.Uri.parse(setupUrl));
  } catch (e) {
    Alert.error("Error opening setup: " + (e instanceof Error ? e.message : e));
  }
}
