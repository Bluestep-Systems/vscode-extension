import * as vscode from 'vscode';
import { App } from '../app/App';

/**
 * Performs all startup tasks for the extension.
 * @param context The VSCode extension context
 */
export default function (context: vscode.ExtensionContext) {
  try {
    
    App.init(context);
    App.isDebugMode() && console.log("B6P: App initialized in debug mode");
    App.logger.info("B6P: App initialized");
  } catch (error) {
    vscode.window.showErrorMessage('Failed to initialize extension: ' + (error instanceof Error ? error.stack : error), { modal: true });
    // rethrow until we know for sure we don't need to.
    throw error;
  }
}

