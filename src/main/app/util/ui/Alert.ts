import * as vscode from 'vscode';
import { App } from '../../App'; 
export namespace Alert {
  export function info(str: string, ops?: vscode.MessageOptions) {
    App.logger.info(str);
    vscode.window.showInformationMessage(str, { modal: true, ...ops });
  }
  export function warning(str: string, ops?: vscode.MessageOptions) {
    App.logger.warn(str);
    vscode.window.showWarningMessage(str, { modal: true, ...ops });
  }
  export function error(str: string, ops?: vscode.MessageOptions) {
    App.logger.error(str);
    vscode.window.showErrorMessage(str, { modal: true, ...ops });
  }
}
