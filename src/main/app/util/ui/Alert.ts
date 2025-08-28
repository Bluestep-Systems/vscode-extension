import * as vscode from 'vscode';

export namespace Alert {
  export function info(str: string) {
    vscode.window.showInformationMessage(str);
  }
  export function warning(str: string) {
    vscode.window.showWarningMessage(str);
  }
  export function error(str: string) {
    vscode.window.showErrorMessage(str);
  }
}
