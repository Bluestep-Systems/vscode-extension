import * as vscode from "vscode";
import { ScriptMetaData } from "../../../../types";
import { ContextNode } from "../context/ContextNode";
import { PublicKeys, PublicPersistanceMap } from "../util/PseudoMaps";

const STORE_KEY = "all";
const LEGACY_METADATA_FILENAME = ".b6p_metadata.json";

/**
 * Persistent store for script metadata, replacing the old `.b6p_metadata.json` files.
 *
 * Stores an array of {@link ScriptMetaData} objects in VS Code workspace state.
 * Lookup is done by U + webdavId or U + scriptName depending on what is available.
 */
export const SCRIPT_METADATA_STORE = new class extends ContextNode {
  private _parent: ContextNode | null = null;
  private _map: PublicPersistanceMap<ScriptMetaData[]> | null = null;

  init(parent: ContextNode): this {
    this._parent = parent;
    this._map = new PublicPersistanceMap(PublicKeys.SCRIPT_METADATA, this.context);
    this.migrateLegacyFiles();
    return this;
  }

  /**
   * Searches the workspace for any legacy `.b6p_metadata.json` files,
   * migrates their contents into the persistent store, and deletes them.
   * Runs asynchronously on startup; failures are logged but do not block initialization.
   */
  private async migrateLegacyFiles(): Promise<void> {
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

          // strip legacy timestamp fields from pushPullRecords
          if (parsed.pushPullRecords) {
            parsed.pushPullRecords = parsed.pushPullRecords.map(r => ({
              downstairsPath: r.downstairsPath,
              lastVerifiedHash: r.lastVerifiedHash,
            }));
          }

          // only migrate if not already in the store
          if (!this.findByWebdavId(parsed.U, parsed.webdavId)) {
            await this.upsert(parsed);
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

  public get parent(): ContextNode {
    if (!this._parent) {
      throw new Error("ScriptMetaDataStore not initialized; call init() first.");
    }
    return this._parent;
  }

  public get context() {
    return this.parent.context;
  }

  protected map(): PublicPersistanceMap<ScriptMetaData[]> {
    if (!this._map) {
      throw new Error("ScriptMetaDataStore not initialized; call init() first.");
    }
    return this._map;
  }

  /**
   * Gets all stored metadata entries.
   */
  public all(): ScriptMetaData[] {
    return this.map().get(STORE_KEY) || [];
  }

  /**
   * Finds metadata by U and webdavId.
   */
  public findByWebdavId(U: string, webdavId: string): ScriptMetaData | undefined {
    return this.all().find(m => m.U === U && m.webdavId === webdavId);
  }

  /**
   * Finds metadata by U and scriptName.
   */
  public findByScriptName(U: string, scriptName: string): ScriptMetaData | undefined {
    return this.all().find(m => m.U === U && m.scriptName === scriptName);
  }

  /**
   * Finds metadata using whatever identifiers are available; attempts by webdavId first
   */
  public find(criteria: { U: string; webdavId?: string; scriptName?: string; }): ScriptMetaData | undefined {
    if (criteria.webdavId) {
      return this.findByWebdavId(criteria.U, criteria.webdavId);
    }
    if (criteria.scriptName) {
      return this.findByScriptName(criteria.U, criteria.scriptName);
    }
    return undefined;
  }

  /**
   * Upserts a metadata entry. If an entry with matching U + webdavId exists, it is replaced.
   */
  public async upsert(metadata: ScriptMetaData): Promise<void> {
    const entries = this.all();
    const index = entries.findIndex(m => m.U === metadata.U && m.webdavId === metadata.webdavId);
    if (index !== -1) {
      entries[index] = metadata;
    } else {
      entries.push(metadata);
    }
    await this.map().set(STORE_KEY, entries);
  }

  /**
   * Modifies metadata in-place via a callback function. Creates a new entry if none exists.
   * @returns The current or modified metadata object
   */
  public async modify(
    criteria: { U: string; webdavId: string; },
    callBack?: (meta: ScriptMetaData) => void,
    defaults?: ScriptMetaData
  ): Promise<ScriptMetaData> {
    let entry = this.findByWebdavId(criteria.U, criteria.webdavId);
    let created = false;
    if (!entry) {
      if (!defaults) {
        throw new Error(`No metadata found for U=${criteria.U}, webdavId=${criteria.webdavId} and no defaults provided`);
      }
      entry = defaults;
      created = true;
    }
    if (callBack) {
      callBack(entry);
    }
    if (created || callBack) {
      await this.upsert(entry);
    }
    return entry;
  }

  /**
   * Removes a metadata entry by U + webdavId.
   */
  public async remove(U: string, webdavId: string): Promise<void> {
    const entries = this.all().filter(m => !(m.U === U && m.webdavId === webdavId));
    await this.map().set(STORE_KEY, entries);
  }
}();
