import * as vscode from 'vscode';

export namespace Alert {
  export function info(str: string, ops?: vscode.MessageOptions) {
    vscode.window.showInformationMessage(str, { modal: true, ...ops });
  }
  export function warning(str: string, ops?: vscode.MessageOptions) {
    vscode.window.showWarningMessage(str, { modal: true, ...ops });
  }
  export function error(str: string, ops?: vscode.MessageOptions) {
    vscode.window.showErrorMessage(str, { modal: true, ...ops });
  }
}
