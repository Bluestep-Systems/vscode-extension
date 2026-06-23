import * as vscode from 'vscode';
import pull from "./pull";
import push from "./pull";

/**
 * Runs the current file as a Ctrl+P script.
 */
export default function () {

    // #region eval variables
    // these are seemingly unused variables/properties that are specifically left so 
    // that they are accessible in the eval scope
    const B6P = {
        activeEditorDocument: vscode.window.activeTextEditor!.document,
        pull,
        push,
        alert
    };
    // #endregion
    try {
        eval(B6P.activeEditorDocument.getText());
    } catch (error) {
        vscode.window.showErrorMessage(`Error executing script: ${error}`);
        vscode.window.activeTerminal?.sendText(`Error executing script: ${error}`);
    }
}
function alert(str: string) {
    vscode.window.showInformationMessage(str);
}