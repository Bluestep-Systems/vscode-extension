import * as vscode from 'vscode';
import type { ScriptContext } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';
import { Util } from '../util';

export default async function (ctx: ScriptContext): Promise<void> {
  try {
    const contextualUri = await Util.getDownstairsFileUri();
    const scriptRoot = ctx.getScriptFactory().createFile(B6PUri.fromFsPath(contextualUri.fsPath)).getScriptRoot();
    const scriptKey = await scriptRoot.getScriptKey();
    const origin = await scriptRoot.anyOrigin();
    const setupUrl = scriptKey.buildSetupUrl(origin);
    await vscode.env.openExternal(vscode.Uri.parse(setupUrl));
  } catch (e) {
    ctx.prompt.error("Error opening setup: " + (e instanceof Error ? e.message : e));
  }
}
