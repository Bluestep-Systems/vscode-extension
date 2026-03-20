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
    const keyToScript = {
      "654015": "editformuladetails.jsp",
      "530024": "editdetailreport1.jsp",
      "363769": "editendpoint.jsp"
    } as {[key: string]: string}; //TODO improve typing on this and scriptkey classid return type
    const jspPage = keyToScript[scriptKey.classid];
    if (!jspPage) {
      throw new Error("no jsp page matching given id");
    }
    const webDavUrl = await scriptRoot.getBaseWebDavUrlString();
    const vscodeRedirect = encodeURIComponent('vscode://bluestep-systems.bsjs-push-pull/pull?url=' + webDavUrl);
    const setupUrl = `${origin}shared/admin/applications/relate/${jspPage}?_event=edit&_id=${scriptKey.classid}___${scriptKey.seqnum}&_vscodeRedirect=${vscodeRedirect}`;
    await vscode.env.openExternal(vscode.Uri.parse(setupUrl));
  } catch (e) {
    Alert.error("Error opening setup: " + (e instanceof Error ? e.message : e));
  }
}
