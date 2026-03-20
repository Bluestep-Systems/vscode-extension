import * as vscode from 'vscode';
import { ScriptFactory } from '../util/script/ScriptFactory';
import { Alert } from '../util/ui/Alert';
import { Util } from '../util';

export default async function (): Promise<void> {
  try {
    const contextualUri = await Util.getDownstairsFileUri();
    const scriptRoot = ScriptFactory.createFile(contextualUri).getScriptRoot();
    const scriptKey = await scriptRoot.getScriptKey();
    const origin = await scriptRoot.anyOrigin();
    const setupUrl = `${origin}shared/admin/applications/relate/editendpoint.jsp?_event=edit&_id=${scriptKey.classid}___${scriptKey.seqnum}`;
    await vscode.env.openExternal(vscode.Uri.parse(setupUrl));
  } catch (e) {
    Alert.error("Error opening setup: " + (e instanceof Error ? e.message : e));
  }
}
