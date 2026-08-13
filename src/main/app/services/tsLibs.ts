import * as fs from "fs";
import * as path from "path";
import type * as vscode from "vscode";

// A file present in every TypeScript lib directory; the core probes for the same
// sentinel, so a directory that has it is a valid `typescriptLibDirs` entry.
const LIB_SENTINEL = "lib.d.ts";

/**
 * Directories to hand the core as `providers.typescriptLibDirs`, so its snapshot-push
 * TypeScript compile can resolve `lib.*.d.ts`.
 *
 * It cannot find them on its own: TypeScript's default host resolves the default library
 * relative to `__filename`, which once b6p-core is bundled into `dist/extension.js` is the
 * extension's own `dist/` — where no libs live. Without this the transpile falls back to
 * walking up for the *workspace's* `node_modules/typescript/lib`, which a BlueStep script
 * folder normally does not have, and every file reports `Cannot find global type 'Array'`.
 *
 * The libs are copied next to the bundle at build time by esbuild's `copy-ts-libs` plugin,
 * from **b6p-core's** pinned TypeScript — the same compiler that ends up bundled. Resolving
 * from `extensionUri` rather than `__dirname` keeps this correct regardless of how the
 * extension is bundled or where VS Code installed it.
 *
 * Returns `[]` when the directory is absent (a lib-less build, e.g. an old `.vsix` or a
 * partially-built `dist/`); the core then falls back to its previous behaviour rather than
 * failing, so this is a strict improvement in every case.
 * @lastreviewed null
 */
export function resolveTsLibDirs(extensionUri: vscode.Uri): string[] {
  const bundled = path.join(extensionUri.fsPath, "dist", "lib");
  if (fs.existsSync(path.join(bundled, LIB_SENTINEL))) {
    return [bundled];
  }
  return [];
}
