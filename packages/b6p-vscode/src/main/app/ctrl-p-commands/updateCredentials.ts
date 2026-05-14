
import { App } from '../App';

/**
 * Updates the user's bearer token.
 * @returns A promise that resolves when the update is complete.
 */
export default async function (): Promise<void> {

  try {

    await App.auth.update();
      
    return void 0;

  } catch (error) {
    App.logger.error("Error getting user credentials:", error);
  }
}

