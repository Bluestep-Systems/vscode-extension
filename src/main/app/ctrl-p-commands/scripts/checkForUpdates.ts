import * as vscode from 'vscode';
import { Alert } from '../../util/ui/Alert';
import { UPDATE_MANAGER } from '../../services/UpdateChecker';

export default async function checkForUpdates(): Promise<void> {
  try {
    // Show progress indicator
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Checking for B6P updates...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      progress.report({ increment: 50, message: "Contacting GitHub..." });

      const updateInfo = await UPDATE_MANAGER.checkForUpdates();

      progress.report({ increment: 100 });

      if (!updateInfo) {
        Alert.info('You are running the latest version of B6P Extension!');
      }
      // If updateInfo exists, the user will already be notified via UPDATE_CHECKER.notifyUser()
    });

  } catch (error) {
    console.error('Error checking for updates:', error);
    Alert.error(
      `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
