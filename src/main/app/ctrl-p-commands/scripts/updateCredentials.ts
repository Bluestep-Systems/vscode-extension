
import { Auth } from '../../authentication';

/**
 * Updates the user credentials. As of right now this is only tooled for Basic Auth, so we'll
 * need to update this when another auth type, (such as oauth) is needed
 * @returns A promise that resolves when the update is complete.
 */
export default async function (): Promise<void> {
  
  try {
    const MANAGER = Auth.determineManager();

    const flag = MANAGER.determineFlag();
    const firstTime = !MANAGER.hasAuth(flag);
    const authObject = await MANAGER.getAuthObject(flag);
    if (firstTime) {
      return; // getAuth prompts for creds if they don't exist
      // so if we don't return here it would be redundant
    }

    await authObject.updateExisting();

    MANAGER.setAuthObject(authObject, flag);
  } catch (error) {
    console.trace("Error getting user credentials:", error);
  }
}

