import type { ScriptContext } from '@bluestep-systems/b6p-core';

/**
 * Updates the user credentials. As of right now this is only tooled for Basic Auth, so we'll
 * need to update this when another auth type, (such as oauth) is needed
 * @returns A promise that resolves when the update is complete.
 */
export default async function (ctx: ScriptContext): Promise<void> {
  try {
    await ctx.auth.update();
  } catch (error) {
    ctx.logger.error("Error getting user credentials:", error);
  }
}
