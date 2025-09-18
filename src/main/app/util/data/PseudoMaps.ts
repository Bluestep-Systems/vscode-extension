import * as vscode from "vscode";
import type { SavableObject, Settings } from "../../../../../types";
import { App } from "../../App";


/**
 * A simple class that mimics the behavior of a Map, but uses a plain object underneath.
 */
export class PseudoMap<V> {
  /**
   * The internal object storing key-value pairs.
   */
  protected obj: Record<string, V> = {} as Record<string, V>;

  /**
   * Creates an instance of PseudoMap.
   * @param initialData Optional initial data to populate the map.
   */
  constructor(initialData?: Record<string, V>) {
    if (initialData) {
      this.obj = initialData;
    }
  }

  /**
   * Retrieves the value associated with the given key.
   * @param key The key to look up.
   * @returns The value associated with the key, or undefined if not found.
   */
  get(key: string): V | undefined {
    return this.obj[key];
  }

  /**
   * Checks if a value is associated with the given key.
   * @param key The key to look up.
   * @returns True if a value is associated with the key, false otherwise.
   */
  has(key: string): boolean {
    return key in this.obj;
  }

  /**
   * Sets the value associated with the given key.
   * @param key The key to set.
   * @param value The value to associate with the key.
   * @returns The PseudoMap instance.
   */
  set(key: string, value: V): this {
    this.obj[key] = value;
    return this;
  }

  /**
   * Executes a provided function once for each key-value pair in the map.
   * @param callback The function to execute for each entry.
   */
  forEach(callback: (value: V, key: string, map: this) => void): void {
    for (const key in this.obj) {
      callback(this.obj[key], key, this);
    }
  }

  /**
   * Deletes the value associated with the given key.
   * @param key The key to delete.
   * @returns The PseudoMap instance.
   */
  delete(key: string): this {
    delete this.obj[key];
    return this;
  }

  /**
   * Clears all entries in the map.
   */
  clear(): void {
    this.obj = {} as Record<string, V>;
  }

  /**
   * Serializes the map to a JSON string.
   * @returns The JSON string representation of the map.
   */
  toJSON(): string {
    return JSON.stringify(this.obj);
  }

};

/**
 * A typed map that ensures type safety for object property access.
 * @lastreviewed null
 */
export class TypedMap<T extends Record<string, SavableObject>> extends PseudoMap<Partial<T>[keyof T]> {
  
  protected obj: Partial<T> = {};

  /**
   * Sets a value for the specified key with type safety.
   * @param key The key to set
   * @param value The value to set
   * @lastreviewed null
   */
  public set<K extends keyof T>(key: K, value: T[K]): this {
    this.obj[key] = value;
    return this;
  }

  /**
   * Gets a value for the specified key with type safety.
   * @param key The key to get
   * @param defaultValue The default value if key doesn't exist
   * @returns The value or default value
   * @lastreviewed null
   */
  public get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
  public get<K extends keyof T>(key: K): T[K] | undefined;
  public get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined {
    const value = this.obj[key];
    return value !== undefined ? value : defaultValue;
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
   * @returns True if the key was deleted
   * @lastreviewed null
   */
  public delete<K extends keyof T>(key: K): this {
    if (key in this.obj) {
      delete this.obj[key];
    }
    return this;
  }

  /**
   * Iterates over all key-value pairs in the map.
   * @param callback Function to call for each key-value pair
   * @lastreviewed null
   */
  public forEach(callback: <K extends keyof T>(value: T[K], key: K & string, map: this) => void): void {
    for (const key in this.obj) {
      if (this.obj.hasOwnProperty(key)) {
        const typedKey = key as keyof T & string;
        const value = this.obj[typedKey];
        if (value !== undefined) {
          callback(value, typedKey, this);
        }
      }
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
    this.obj = {};
  }
}

export class SettingsMap extends TypedMap<Settings> {
  private static working: boolean = false;
  constructor(initialData?: Required<Settings>) {
    super(initialData);
  }

  /**
   * This will automatically store the settings when changed.
   * 
   * Storage is of changes is very specifically left as async, and will not be awaited.
   * 
   * This may be a problem if you make multiple changes in quick succession; and is very specifically
   * left as a potential bug to indicate that you need to rethink your settings logic.
   * @param key 
   * @param value 
   * @returns 
   */
  set<K extends keyof Settings>(key: K, value: Settings[K]): this {
    if (SettingsMap.working) {
      App.logger.warn("map is in the middle of changes! This is likely a bug.");
      throw new Error("SettingsMap is already working");
    }
    vscode.workspace.getConfiguration().get<Settings>(key as string);
    SettingsMap.working = true;
    super.set(key, value);
    this.store();
    return this;
  }
  private async store() {
    await vscode.workspace.getConfiguration().update(App.appKey, this.obj, vscode.ConfigurationTarget.Global);
    App.logger.info(`Settings updated: ${this.toJSON()}`);
    SettingsMap.working = false;
  }
}

/**
 * A persistable version of a pseudomap. Exending classes mus implement an initializer
 * that will load the data from the appropriate source, and a storage method.
 */
export abstract class PersistableMap<T extends SavableObject> extends PseudoMap<T> {

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
  set(key: string, value: T): this {
    super.set(key, value);
    this.store();
    return this;
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
  abstract store(): void;


  /**
   * produces a copy of the internal object.
   */
  toSavableObject(): Record<string, T> {
    return { ...this.obj };
  }
}

/**
 * A persistable map that uses the vscode workspace state to persist data.
 * Note that this is synchronous, so you can use it immediately after construction.
 */
export class PublicPersistanceMap<T extends SavableObject> extends PersistableMap<T> {
  /**
   * Creates an instance of PublicPersistanceMap.
   * @param key The key used for persisting the map.
   * @param context The context in which to persist the map.
   */
  constructor(key: PublicKeys, context: vscode.ExtensionContext) {
    super(key, context);
    this.obj = this.context.workspaceState.get<Record<string, T>>(this.key, {});
  }

  /**
   * Stores the current state of the of the map in the vscode workspaceState
   */
  store(): void {
    this.context.workspaceState.update(this.key, this.obj);
  }


}

/**
 * A persistable map that uses the vscode secret storage to persist data.
 * Data loaded is not immediately available upon construction, so any crucial data
 * you'll need to wait until `isInitialized()` returns true.
 */
export class PrivatePersistanceMap<T extends SavableObject> extends PersistableMap<T> {

  protected initialized: boolean = false;
  /**
   * Creates an instance of PrivatePersistanceMap. 
   * @param key The key used for persisting the map.
   * @param context The context in which to persist the map.
   */
  
  constructor(key: PrivateKeys, context: vscode.ExtensionContext) {
    super(key, context);
    this.context.secrets.get(this.key).then(jsonString => {
      this.obj = JSON.parse(jsonString || '{}');
      this.initialized = true;
    });
  }

  /**
   * Throws if the map is not fully initialized
   */
  private requiresInit() {
    if (!this.initialized) {
      throw new Error(`PrivatePersistanceMap for ${this.key} not fully initialized`);
    }
  }

  get(key: string): T | undefined  {
    this.requiresInit();
    return super.get(key);
  }

  has(key: string): boolean {
    this.requiresInit();
    return super.has(key);
  }

  set(key: string, value: T): this {
    this.requiresInit();
    return super.set(key, value);
  }

  /**
   * Sets the value associated with the given key asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for set to be done
   * and you need an await done.
   * @param key The key to set.
   * @param value The value to associate with the key.
   * @returns A promise that resolves to the PersistableMap instance.
   */
  async setAsync(key: string, value: T): Promise<this> {
    this.requiresInit();
    super.set(key, value);
    await this.storeAsync();
    return this;
  }

  forEach(callback: (value: T, key: string, map: this) => void): void {
    this.requiresInit();
    super.forEach(callback);
  }

  delete(key: string): this {
    this.requiresInit();
    return super.delete(key);
  }

  /**
   * Deletes the entry associated with the given key asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for delete
   * and you need an await.
   * @param key The key to delete.
   * @returns A promise that resolves to the PersistableMap instance.
   */
  async deleteAsync(key: string): Promise<this> {
    this.requiresInit();
    super.delete(key);
    return this.storeAsync().then(() => this);
  }


  clear(): void {
    this.requiresInit();
    super.clear();
    this.store();
  }

  /**
   * Stores the current state of the of the map in the vscode secrets storage
   */
  store(): void {
    this.requiresInit();
    this.context.secrets.store(this.key, JSON.stringify(this.obj));
  }

  /**
   * Stores the current state of the of the map in the vscode secrets storage asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for store to be done
   * and you need an await done.
   * @returns A promise that resolves when the storage is complete.
   */
  async storeAsync(): Promise<void> {
    this.requiresInit();
    await this.context.secrets.store(this.key, JSON.stringify(this.obj));
  }


  /**
   * Checks if the map is fully initialized.
   * @returns True if the map is initialized, false otherwise.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
}

/**
 * Keys used for private persistance maps
 */
export enum PrivateKeys {

  /**
   * key for the data we persist for the basic auth map
   */
  BASIC_AUTH = 'b6p:basic_auth',
  
  /**
   * key for the data we persist for the existing sessions
   */
  SESSIONS = 'b6p:sessions',

  /**
   * key for the data we persist for the github keys map
   */

  GITHUB_KEYS = 'b6p:github_keys'

}

/**
 * Keys used for public persistance maps
 */
export enum PublicKeys {
  /**
   * //TODO
   */
  SETTINGS = 'b6p:user_settings',

}
