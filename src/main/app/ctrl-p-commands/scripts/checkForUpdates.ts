import * as vscode from 'vscode';
import { UpdateChecker } from '../../util/UpdateChecker';
import { State } from '../../App';

export default async function checkForUpdates(): Promise<void> {
  try {
    // Show progress indicator
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Checking for B6P updates...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      if (!State.isInitialized()) {
        throw new Error('Extension is not properly initialized');
      }

      progress.report({ increment: 50, message: "Contacting GitHub..." });

      const updateChecker = new UpdateChecker(State.context);
      
      progress.report({ increment: 80, message: "Checking version..." });

      const updateInfo = await updateChecker.checkForUpdates();
      
      progress.report({ increment: 100 });

      if (!updateInfo) {
        vscode.window.showInformationMessage('You are running the latest version of B6P Extension.');
      }
      // If update is found, the UpdateChecker will handle showing the notification
    });

  } catch (error) {
    console.error('Error checking for updates:', error);
    vscode.window.showErrorMessage(
      `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
