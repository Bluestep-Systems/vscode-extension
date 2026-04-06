import { App } from '../App';

export default async function checkForUpdates(): Promise<void> {
  try {
    await App.updateUI.checkForUpdatesManually();
  } catch (error) {
    console.error('Error checking for updates:', error);
    App.core.prompt.error(
      `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
