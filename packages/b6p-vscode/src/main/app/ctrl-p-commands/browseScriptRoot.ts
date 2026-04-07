import * as vscode from "vscode";
import type { ScriptContext } from "../../../core/script/ScriptContext";

export default async function(ctx: ScriptContext) {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Script Root Folder',
  });
  if (result && result[0]) {
    await vscode.workspace.getConfiguration('bsjs-push-pull').update('scriptRoot.path', result[0].fsPath, vscode.ConfigurationTarget.Global);
    ctx.prompt.info(`Script root set to: ${result[0].fsPath}`);
  }
}
