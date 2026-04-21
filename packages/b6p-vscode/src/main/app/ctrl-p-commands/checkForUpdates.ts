import type { App } from "../App";

export default async function checkForUpdates(app: typeof App): Promise<void> {
  try {
    await app.updateUI.checkForUpdatesManually();
  } catch (error) {
    console.error('Error checking for updates:', error);
    app.core.prompt.error(
      `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
