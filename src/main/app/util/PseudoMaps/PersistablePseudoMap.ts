import * as vscode from "vscode";
import type { Serializable } from "../../../../../types";
import { PseudoMap } from "./PseudoMap";
import { Persistable } from "./Persistable";

/**
 * A persistable version of a pseudomap. Extending classes must implement an initializer
 * that will load the data from the appropriate source, and a storage method.
 */
export abstract class PersistablePseudoMap<T extends Serializable> extends PseudoMap<string, T> implements Persistable, Iterable<[string, T]> {

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
   * An iterator over the key-value pairs in the map.
   * @lastreviewed 2025-10-07
   */
  [Symbol.iterator](): Iterator<[string, T]> {
    return Object.entries(this.obj)[Symbol.iterator]();
  }

  /**
   * Sets the value associated with the given key. will also save the result when called
   * @lastreviewed 2025-10-07
   */
  async set(key: string, value: T) {
    super.set(key, value);
    await this.store();
  }

  /**
   * Clears all entries in the map and persists the change.
   * @lastreviewed 2025-10-07
   */
  async clear(): Promise<void> {
    super.clear();
    await this.store();
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