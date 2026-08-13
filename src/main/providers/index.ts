import type { FileSystem, Logger, Progress, Prompt } from "@bluestep-systems/b6p-core";
import { VscodeFileSystem } from "./VscodeFileSystem";
import { VscodePrompt } from "./VscodePrompt";
import { VscodeLogger } from "./VscodeLogger";
import { VscodeProgress } from "./VscodeProgress";

export { VscodeFileSystem } from "./VscodeFileSystem";
export { VscodePrompt } from "./VscodePrompt";
export { VscodeLogger } from "./VscodeLogger";
export { VscodeProgress } from "./VscodeProgress";

/**
 * The four platform providers this extension implements, as one bundle.
 *
 * b6p-core 0.5.0 made {@link B6PCore}'s copies private, so `App` keeps this object
 * and spreads it into both the `B6PProviders` literal and the `ScriptContext` it
 * builds — the two places that need exactly these four, under exactly these names.
 * @lastreviewed null
 */
export interface VscodeProviders {
  readonly fs: FileSystem;
  readonly prompt: Prompt;
  readonly logger: Logger;
  readonly progress: Progress;
}

/** Constructs a fresh {@link VscodeProviders} bundle. */
export function createVscodeProviders(logger: VscodeLogger): VscodeProviders {
  return {
    fs: new VscodeFileSystem(),
    prompt: new VscodePrompt(),
    logger,
    progress: new VscodeProgress(),
  };
}
