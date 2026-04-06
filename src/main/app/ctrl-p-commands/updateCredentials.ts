
import { App } from '../App';

/**
 * Updates the user credentials. As of right now this is only tooled for Basic Auth, so we'll
 * need to update this when another auth type, (such as oauth) is needed
 * @returns A promise that resolves when the update is complete.
 */
export default async function (): Promise<void> {

  try {

    await App.authManager.getOrCreate();
      
    return void 0;

  } catch (error) {
    App.logger.error("Error getting user credentials:", error);
  }
}

