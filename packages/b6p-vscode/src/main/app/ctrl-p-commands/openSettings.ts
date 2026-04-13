import * as vscode from "vscode";

export default function() {
  vscode.commands.executeCommand('workbench.action.openSettings', '@ext:bluestep-systems.bsjs-push-pull');
}
