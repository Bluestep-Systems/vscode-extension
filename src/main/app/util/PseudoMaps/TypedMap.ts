import type { Serializable } from "../../../../../types";
import { PseudoMap } from "./PseudoMap";

/**
 * A typed map that ensures type safety for object property access with string keys.
 * Extends PseudoMap to provide strongly-typed persistence storage.
 * @lastreviewed null
 */
export class TypedMap<T extends Record<string, Serializable>> extends PseudoMap<keyof T & string, T[keyof T]> {

  constructor(initialData?: T) {
    super();
    if (initialData) {
      this.obj = initialData;
    }
  }

  /**
   * Sets a value for the specified key with type safety.
   * @param key The key to set
   * @param value The value to set
   * @returns This instance for method chaining
   * @lastreviewed null
   */
  public set<K extends keyof T & string>(key: K, value: T[K]) {
    this.obj[key] = value;
  }

  /**
   * Gets a value for the specified key with type safety.
   * @param key The key to get
   * @param defaultValue The default value if key doesn't exist
   * @returns The value or default value
   * @lastreviewed null
   */
  public get<K extends keyof T & string>(key: K, defaultValue: T[K]): T[K];
  public get<K extends keyof T & string>(key: K): T[K] | undefined;
  public get<K extends keyof T & string>(key: K, defaultValue?: T[K]): T[K] | undefined {
    const value = this.obj[key];
    return value !== undefined ? value as T[K] : defaultValue;
  }

  /**
   * Checks if the map has the specified key.
   * @param key The key to check
   * @returns True if the key exists
   * @lastreviewed null
   */
  public has<K extends keyof T>(key: K): boolean {
    return key in this.obj;
  }

  /**
   * Deletes the specified key from the map.
   * @param key The key to delete
   * @returns This instance for method chaining
   * @lastreviewed null
   */
  public delete<K extends keyof T & string>(key: K) {
    if (key in this.obj) {
      delete this.obj[key];
    } else {
      throw new Error(`Key ${key} does not exist in TypedMap and cannot be deleted.`);
    }
  }

  /**
   * Iterates over all key-value pairs in the map.
   * @param callback Function to call for each key-value pair
   * @lastreviewed null
   */
  public forEach<K extends keyof T>(callback: (value: T[K], key: K, map: this) => void): void {
    for (const k in this.obj) {
      const value = this.obj[k];
      callback(value as unknown as T[K], k as unknown as K, this);
    }
  }

  /**
   * Returns an array of all keys in the map.
   * @returns Array of keys
   * @lastreviewed null
   */
  public keys(): (keyof T & string)[] {
    return Object.keys(this.obj) as (keyof T & string)[];
  }

  /**
   * Returns an array of all values in the map.
   * @returns Array of values
   * @lastreviewed null
   */
  public values(): T[keyof T][] {
    return Object.values(this.obj).filter(v => v !== undefined) as T[keyof T][];
  }

  /**
   * Returns an array of all key-value pairs.
   * @returns Array of [key, value] tuples
   * @lastreviewed null
   */
  public entries(): [keyof T & string, T[keyof T]][] {
    return this.keys().map(key => [key, this.obj[key]!]);
  }

  /**
   * Returns the number of key-value pairs in the map.
   * @returns The size of the map
   * @lastreviewed null
   */
  public get size(): number {
    return this.keys().length;
  }

  /**
   * Removes all key-value pairs from the map.
   * @lastreviewed null
   */
  public clear(): void {
    Object.keys(this.obj).forEach(key => delete this.obj[key]);
  }
}