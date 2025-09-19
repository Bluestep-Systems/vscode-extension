import * as vscode from "vscode";
import type { SavableObject } from "../../../../../types";
import { PseudoMap } from "./PseudoMap";
import { SoftPersistable } from "./Persistable";

/**
 * A persistable version of a pseudomap. Extending classes must implement an initializer
 * that will load the data from the appropriate source, and a storage method.
 */
export abstract class SoftPersistableMap<T extends SavableObject> extends PseudoMap<string, T> implements SoftPersistable {

  /**
   * The key used for persisting the map in the vscode context.
   */
  readonly key: string;

  /**
   * the context in which we persist the map
   */
  protected readonly context: vscode.ExtensionContext;

  /**
   * Creates an instance of PersistableMap.
   * @param key The key used for persisting the map.
   * @param context The context in which to persist the map.
   */
  constructor(key: string, context: vscode.ExtensionContext) {
    super();
    this.key = key;
    this.context = context;
  }

  /**
   * Sets the value associated with the given key. will also save the result when called
   * @param key The key to set.
   * @param value The value to associate with the key.
   * @returns The PersistableMap instance.
   */
  async set(key: string, value: T) {
    super.set(key, value);
    await this.store();
  }

  /**
   * Clears all entries in the map and persists the change.
   */
  clear(): void {
    super.clear();
    this.store();
  }

  /**
   * Stores the current state of the of the map in the appropriate storage.
   */
  abstract store(): Thenable<void>;

  /**
   * produces a copy of the internal object.
   */
  toSavableObject(): Record<string, T> {
    return { ...this.obj };
  }
}