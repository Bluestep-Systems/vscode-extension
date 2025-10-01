import * as vscode from 'vscode';
import { App } from '../../App';
export namespace Alert {
  export async function info(str: string, ops?: vscode.MessageOptions) {
    App.logger.info(str);
    await vscode.window.showInformationMessage(str, { modal: true, ...ops });
  }
  export async function warning(str: string, ops?: vscode.MessageOptions) {
    App.logger.warn(str);
    await vscode.window.showWarningMessage(str, { modal: true, ...ops });
  }
  export async function error(str: string, ops?: vscode.MessageOptions) {
    App.logger.error(str);
    await vscode.window.showErrorMessage(str, { modal: true, ...ops });
  }

  export async function prompt(message: string, options: string[]): Promise<string | undefined> {
    return await vscode.window.showWarningMessage(
      message,
      ...options
    );
  }
}
