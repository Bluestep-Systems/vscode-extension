import * as vscode from 'vscode';
export default function() {
    const activeEditorDocument = vscode.window.activeTextEditor!.document;
    const curText = activeEditorDocument.getText();
    eval(curText);
    
}
