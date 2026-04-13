import * as vscode from 'vscode';
import type { IPrompt } from '@bluestep-systems/b6p-core';

/**
 * VSCode implementation of the prompt provider.
 * Wraps vscode.window UI APIs.
 */
export class VscodePrompt implements IPrompt {
  async inputBox(options: { prompt: string; password?: boolean; value?: string }): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      prompt: options.prompt,
      password: options.password,
      value: options.value,
    });
  }

  async confirm(message: string, options: string[]): Promise<string | undefined> {
    return await vscode.window.showInformationMessage(message, ...options);
  }

  info(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  async popup(message: string): Promise<void> {
    await vscode.window.showInformationMessage(message, { modal: true });
  }

  warn(message: string): void {
    vscode.window.showWarningMessage(message);
  }

  error(message: string): void {
    vscode.window.showErrorMessage(message);
  }
}
