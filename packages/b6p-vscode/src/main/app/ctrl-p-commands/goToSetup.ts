import * as vscode from 'vscode';
import { App } from '../App';
import { ScriptFactory } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';
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
    App.core.prompt.error("Error opening setup: " + (e instanceof Error ? e.message : e));
  }
}
