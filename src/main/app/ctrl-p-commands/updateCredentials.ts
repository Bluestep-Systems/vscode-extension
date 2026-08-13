import { App } from "../App";

/**
 * Updates the user credentials.
 *
 * Scheme-agnostic: this drives `AuthProvider.update()` through the interface, so it
 * prompts for whatever the configured scheme stores — a bearer token under the core's
 * default {@link BearerAuthProvider}, or whatever a consumer-supplied provider holds.
 * @returns A promise that resolves when the update is complete.
 * @lastreviewed null
 */
export default async function (): Promise<void> {
  try {
    await App.auth.update();

    return void 0;
  } catch (error) {
    App.logger.error("Error getting user credentials:", error);
  }
}
