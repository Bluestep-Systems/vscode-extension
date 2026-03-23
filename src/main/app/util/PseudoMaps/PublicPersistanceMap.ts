import * as vscode from "vscode";
import { PersistablePseudoMap } from "./PersistablePseudoMap";
import { PublicKeys } from "./PersistenceKeys";
import type { Serializable } from "./Serializable";
import { revive } from "./Serializable";

/**
 * A persistable map that uses the vscode workspace state to persist data.
 * Note that this is synchronous, so you can use it immediately after construction.
 */
export class PublicPersistanceMap<T extends Serializable> extends PersistablePseudoMap<T> {
  /**
   * Creates an instance of PublicPersistanceMap.
   * @param key The key used for persisting the map.
   * @param context The context in which to persist the map.
   */
  constructor(key: PublicKeys, context: vscode.ExtensionContext) {
    super(key, context);
    this.obj = revive(this.context.workspaceState.get<Record<string, T>>(this.key, {}));
  }

  /**
   * Stores the current state of the of the map in the vscode workspaceState
   */
  override store(): Thenable<void> {
    return this.context.workspaceState.update(this.key, this.obj);
  }
}