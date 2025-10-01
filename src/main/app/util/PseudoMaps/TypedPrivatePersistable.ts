import * as vscode from "vscode";
import type { Serializable } from "../../../../../types";
import { PrivateKeys } from "./PersistenceKeys";
import { TypedPersistable } from "./TypedPersistable";
import { Err } from "../Err";

/**
 * A typed private persistable pseudomap that uses VS Code's secret storage.
 * 
 * Extends TypedPersistable to provide secure storage for sensitive data
 * such as credentials, tokens, and other private information that should
 * not be stored in workspace state.
 * 
 * @template T The type of the object being persisted
 * @lastreviewed 2025-10-01
 */
export class PrivateTypedPersistable<T extends Record<string, Serializable>> extends TypedPersistable<T> {
  private isInitialized: boolean = false;
  /**
   * Constructor for {@link PrivateTypedPersistable}.
   * 
   * @param key The private persistence key for secret storage
   * @param context The VS Code extension context
   * @param defaultValue The default value if no stored data exists
   * @lastreviewed 2025-10-01
   */
  constructor({ key, context, defaultValue }: { key: PrivateKeys; context: vscode.ExtensionContext; defaultValue: T }) {
    // Call super with a dummy public key since we'll override the behavior
    super({ key, context, defaultValue });
    this.context.secrets.get(this.key).then(jsonString => {
      this.obj = JSON.parse(jsonString || '{}');
      this.isInitialized = true;
    });
  }
  
  /**
   * Type guard that ensures the map is fully initialized.
   * 
   * Throws an error if not initialized. While this doesn't provide compile-time
   * type narrowing, it ensures runtime safety for all map operations.
   * 
   * @throws an {@link Err.PersistenceNotInitializedError} if the map is not fully initialized
   * @lastreviewed 2025-10-01
   */
  private checkIsInitialized(): this is PrivateTypedPersistable<T> & { isInitialized: true } {
    if (!this.isInitialized) {
      throw new Err.PersistenceNotInitializedError("PrivateTypedPersistable", this.key);
    }
    return true;
  }

  /**
   * Sets a value with type safety and automatic persistence.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @param key The key to set
   * @param value The value to set
   * @param update Whether to immediately store the updated map
   * @returns This instance for chaining
   * @lastreviewed 2025-10-01
   */
  set<K extends keyof T & string>(key: K, value: T[K]): this {
    this.checkIsInitialized();
    super.set(key, value);
    this.store();
    return this;
  }

  /**
   * Gets a value for the specified key with type safety.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @param key The key to get
   * @param defaultValue The default value if key doesn't exist
   * @returns The value or default value
   * @lastreviewed 2025-10-01
   */
  public get<K extends keyof T & string>(key: K, defaultValue: T[K]): T[K];
  public get<K extends keyof T & string>(key: K): T[K] | undefined;
  public get<K extends keyof T & string>(key: K, defaultValue?: T[K]): T[K] | undefined {
    this.checkIsInitialized();
    return defaultValue !== undefined ? super.get(key, defaultValue) : super.get(key);
  }

  /**
   * Checks if the map has the specified key.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @param key The key to check
   * @returns True if the key exists
   * @lastreviewed 2025-10-01
   */
  public has<K extends keyof T>(key: K): boolean {
    this.checkIsInitialized();
    return super.has(key);
  }

  /**
   * Deletes the specified key from the map.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @param key The key to delete
   * @returns This instance for method chaining
   * @lastreviewed 2025-10-01
   */
  public delete<K extends keyof T & string>(key: K) {
    this.checkIsInitialized();
    return super.delete(key);
  }

  /**
   * Iterates over all key-value pairs in the map.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @param callback Function to call for each key-value pair
   * @lastreviewed 2025-10-01
   */
  public forEach<K extends keyof T>(callback: (value: T[K], key: K, map: this) => void): void {
    this.checkIsInitialized();
    super.forEach(callback);
  }

  /**
   * Returns an array of all keys in the map.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  public keys(): (keyof T & string)[] {
    this.checkIsInitialized();
    return super.keys();
  }

  /**
   * Returns an array of all values in the map.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  public values(): T[keyof T][] {
    this.checkIsInitialized();
    return super.values();
  }

  /**
   * Returns an array of all key-value pairs.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  public entries(): [keyof T & string, T[keyof T]][] {
    this.checkIsInitialized();
    return super.entries();
  }

  /**
   * Returns the number of key-value pairs in the map.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  public get size(): number {
    this.checkIsInitialized();
    return super.size;
  }

  /**
   * Removes all key-value pairs from the map.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  public clear(): void {
    this.checkIsInitialized();
    super.clear();
  }

  /**
   * Converts the map to a JSON string.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  toJSON(): string {
    this.checkIsInitialized();
    return super.toJSON();
  }

  /**
   * Stores the current state using VS Code's secret storage.
   * Ensures the map is fully initialized before delegating to parent implementation.
   * @lastreviewed 2025-10-01
   */
  store(): Thenable<void> {
    this.checkIsInitialized();
    return this.context.secrets.store(this.key, JSON.stringify(this.obj));
  }
}