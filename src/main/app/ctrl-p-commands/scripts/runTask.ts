import * as vscode from 'vscode';
declare const pushArgs: any[];
export default function() {
    const activeEditorDocument = vscode.window.activeTextEditor!.document;
    const curText = activeEditorDocument.getText();
    eval(curText);
    
}