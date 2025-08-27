import * as vscode from 'vscode';
import fetchScript from "./pullCurrent";
import pushScript from "./pushCurrent";
export default function() {

    // #region eval variables
    // these are seemingly unused variables/properties that are specifically left so 
    // that they are accessible in the eval scope
    const B6P = {
        activeEditorDocument: vscode.window.activeTextEditor!.document,
        pull: fetchScript,
        push: pushScript
    };
    // #endregion
    try {
        eval(B6P.activeEditorDocument.getText());        
    } catch (error) {
        vscode.window.showErrorMessage(`Error executing script: ${error}`);
        vscode.window.activeTerminal?.sendText(`Error executing script: ${error}`);
    }
}
