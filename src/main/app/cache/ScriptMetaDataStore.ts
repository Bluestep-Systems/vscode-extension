import * as vscode from "vscode";
import type { ScriptMetaData } from "../../../../types";
import { ScriptKey } from "../../../core/data/ScriptKey";
import { ScriptMetaDataStore } from "../../../core/cache/ScriptMetaDataStore";

// Re-export the core class for backwards compatibility.
export { ScriptMetaDataStore };

const LEGACY_METADATA_FILENAME = ".b6p_metadata.json";

/**
 * App-side bootstrap that migrates any legacy `.b6p_metadata.json` files
 * found in the workspace into the persistent store, then deletes the legacy files.
 *
 * Runs asynchronously on startup; failures are logged but do not block initialization.
 */
export async function migrateLegacyMetadataFiles(store: ScriptMetaDataStore): Promise<void> {
  try {
    const files = await vscode.workspace.findFiles(`**/${LEGACY_METADATA_FILENAME}`);
    if (files.length === 0) {
      return;
    }
    console.log(`Found ${files.length} legacy metadata file(s) to migrate.`);
    for (const fileUri of files) {
      try {
        const contents = await vscode.workspace.fs.readFile(fileUri);
        const parsed = JSON.parse(Buffer.from(contents).toString("utf-8")) as ScriptMetaData;

        if (!parsed.scriptName || !parsed.U || !parsed.webdavId || !parsed.scriptKey) {
          console.warn(`Skipping malformed legacy metadata: ${fileUri.fsPath}`);
          continue;
        }

        // hydrate plain-object scriptKey into a proper ScriptKey instance
        if (!(parsed.scriptKey instanceof ScriptKey)) {
          parsed.scriptKey = ScriptKey.from(parsed.scriptKey);
        }

        // strip legacy timestamp fields from pushPullRecords
        if (parsed.pushPullRecords) {
          parsed.pushPullRecords = parsed.pushPullRecords.map(r => ({
            downstairsPath: r.downstairsPath,
            lastVerifiedHash: r.lastVerifiedHash,
          }));
        }

        // only migrate if not already in the store
        if (!store.findByWebdavId(parsed.U, parsed.webdavId)) {
          await store.upsert(parsed);
          console.log(`Migrated legacy metadata for "${parsed.scriptName}".`);
        }

        await vscode.workspace.fs.delete(fileUri);
        console.log(`Deleted legacy metadata file: ${fileUri.fsPath}`);
      } catch (fileErr) {
        console.warn(`Failed to migrate legacy metadata at ${fileUri.fsPath}:`, fileErr);
      }
    }
  } catch (e) {
    console.warn("Legacy metadata migration failed:", e);
  }
}
