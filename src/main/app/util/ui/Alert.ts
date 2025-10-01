import * as vscode from 'vscode';
import { App } from '../../App';
import type { Err } from '../Err';

/**
 * Namespace for alerting the user via VS Code's UI.
 * 
 * This includes popups, info messages, warnings, and errors.
 * 
 * All methods log to the output channel as well.
 */
export namespace Alert {

  /**
   * Use this when you want to make sure the user sees the message.
   * 
   * It is wise to use this in tandem with a {@link Err.AlreadyAlertedError} to avoid
   * spamming the user with multiple popups for the same issue.
   */
  export async function popup(str: string, ops?: vscode.MessageOptions) {
    App.logger.info(str);
    await vscode.window.showInformationMessage(str, { modal: true, ...ops });
  }

  /**
   * Does a non-popup info alert, logging to output channel as well.
   */
  export async function info(str: string, ops?: vscode.MessageOptions) {
    App.logger.info(str);
    await vscode.window.showInformationMessage(str, { modal: false, ...ops});
  }

  /**
   * Does a non-popup warning alert, logging to output channel as well.
   */
  export async function warning(str: string, ops?: vscode.MessageOptions) {
    App.logger.warn(str);
    await vscode.window.showWarningMessage(str, { modal: false, ...ops });
  }

  /**
   * Does a non-popup error alert, logging to output channel as well.
   */
  export async function error(str: string, ops?: vscode.MessageOptions) {
    App.logger.error(str);
    await vscode.window.showErrorMessage(str, { modal: false, ...ops });
  }

  /**
   * Prompts the user with a warning message and a set of options.
   * 
   * It is wise to "await" this function to get the user's response when logic depends on it,
   * and to remember to always expressly handle the case where the user dismisses the prompt.
   * 
   * @param message The message in the prompt.
   * @param options The options to present to the user.
   * @returns the exact string of the option selected, or undefined if the user dismissed the prompt.
   */
  export async function prompt(message: string, options: string[]): Promise<string | undefined> {
    App.logger.info("Prompting user: " + message + " Options: " + options.join(", "));
    return await vscode.window.showWarningMessage(
      message,
      ...options
    );
  }
}
