import * as vscode from 'vscode';
import { App } from '../../app/App';
import { UpdateChecker } from '../../app/services/UpdateChecker';

export default function (context: vscode.ExtensionContext) {

  try {
    
    App.init(context);
    App.logger.info("B6P: App initialized");
    return;
    //TODO implement this properly

    // Start automatic update checking (async, don't block startup)
    setTimeout(async () => {
      try {
        console.log("B6P: Starting automatic update check...");
        const updateChecker = new UpdateChecker(context);
        await updateChecker.checkForUpdatesIfNeeded();
      } catch (error) {
        console.error("B6P: Update check failed:", error);
        // Don't show error to user for automatic checks
      }
    }, 5000); // Wait 5 seconds after startup to avoid blocking
    
    //we don't know if this is a string, an error wrapper or whatever
    // so sadly `any` is the only appropriate catch type
  } catch (error) {
    console.trace(error);
    vscode.window.showErrorMessage('Failed to initialize extension: ' + (error instanceof Error ? error.stack : error), { modal: true });

    // rethrow until we know for sure we don't need to.
    throw error;
  }
}

