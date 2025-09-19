import * as vscode from "vscode";
import type { SavableObject, Settings } from "../../../../../types";
import { App } from "../../App";
import { Alert } from "../ui/Alert";
import { Util } from "..";


/**
 * A simple class that mimics the behavior of a Map, but uses a plain object underneath.
 */
export class PseudoMap<K extends string, V> {
  /**
   * The internal object storing key-value pairs.
   */
  protected obj: Record<K, V> = {} as Record<K, V>;

  /**
   * Creates an instance of PseudoMap.
   * @param initialData Optional initial data to populate the map.
   */
  constructor(initialData?: Record<K, V>) {
    if (initialData) {
      this.obj = initialData;
    }
  }

  /**
   * Retrieves the value associated with the given key.
   * @param key The key to look up.
   * @returns The value associated with the key, or undefined if not found.
   */
  get(key: K): V | undefined {
    return this.obj[key];
  }

  /**
   * Checks if a value is associated with the given key.
   * @param key The key to look up.
   * @returns True if a value is associated with the key, false otherwise.
   */
  has(key: K): boolean {
    return key in this.obj;
  }

  /**
   * Sets the value associated with the given key.
   * @param key The key to set.
   * @param value The value to associate with the key.
   * @returns The PseudoMap instance.
   */
  set(key: K, value: V): this {
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
  delete(key: K): this {
    delete this.obj[key];
    return this;
  }

  /**
   * Clears all entries in the map.
   */
  clear(): void {
    this.obj = {} as Record<K, V>;
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
 * A typed map that ensures type safety for object property access with string keys.
 * Extends PseudoMap to provide strongly-typed persistence storage.
 * @lastreviewed null
 */
export class TypedMap<T extends Record<string, SavableObject>> extends PseudoMap<keyof T & string, T[keyof T]> {

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
  public set<K extends keyof T & string>(key: K, value: T[K]): this {
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
  public delete<K extends keyof T & string>(key: K): this {
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



/**
 * An interface for objects that can be persisted but must be manually
 */
interface SoftPersistable {

  /**
   * Stores the current state of the object in the appropriate storage.
   */
  store(): void;
}

/**
 * An interface for objects that can be persisted asynchronously, and can be awaited on
 */
interface HardPersistable extends SoftPersistable {

  /**
   * The key used for persisting the object.
   */
  readonly key: string;
  /**
   * Sets the value associated with the given key asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for set to be done
   * and you need an await done.
   * @param key The key to set.
   * @param value The value to associate with the key.
   * @returns A promise that resolves to the PersistableMap instance.
   */
  setAsync(key: string, value: SavableObject): Thenable<this>;

  /**
   * Deletes the entry associated with the given key asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for delete
   * and you need an await.
   * @param key The key to delete.
   * @returns A promise that resolves to the PersistableMap instance.
   */
  deleteAsync(key: string): Thenable<this>;
  /**
   * Checks if the map is fully initialized.
   * @returns True if the map is initialized, false otherwise.
   */
  storeAsync(): Thenable<void>;
}


/**
 * A persistable version of a pseudomap. Exending classes mus implement an initializer
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
export class PublicPersistanceMap<T extends SavableObject> extends SoftPersistableMap<T> {
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
export class PrivatePersistanceMap<T extends SavableObject> extends SoftPersistableMap<T> implements HardPersistable {

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

  // documented in parent
  get(key: string): T | undefined {
    this.requiresInit();
    return super.get(key);
  }

  // documented in parent
  has(key: string): boolean {
    this.requiresInit();
    return super.has(key);
  }

  // documented in parent
  set(key: string, value: T): this {
    this.requiresInit();
    return super.set(key, value);
  }

  // documented in parent
  async setAsync(key: string, value: T): Promise<this> {
    this.requiresInit();
    super.set(key, value);
    await this.storeAsync();
    return this;
  }

  // documented in parent
  forEach(callback: (value: T, key: string, map: this) => void): void {
    this.requiresInit();
    super.forEach(callback);
  }

  // documented in parent
  delete(key: string): this {
    this.requiresInit();
    super.delete(key);
    this.store();
    return this;
  }

  // documented in parent
  async deleteAsync(key: string): Promise<this> {
    this.requiresInit();
    super.delete(key);
    await this.storeAsync();
    return this;
  }

  // documented in parent
  clear(): void {
    this.requiresInit();
    super.clear();
    this.store();
  }

  // documented in parent
  store(): void {
    this.requiresInit();
    this.context.secrets.store(this.key, JSON.stringify(this.obj));
  }

  // documented in parent
  async storeAsync(): Promise<void> {
    this.requiresInit();
    await this.context.secrets.store(this.key, JSON.stringify(this.obj));
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
 * 
 * We may not end up needing these, but leaving them here for now.
 */
export enum PublicKeys {
  /**
   * //TODO
   */
  TODO = 'TODO',

}

/**
  * A typed persistable pseudomap.
 * @lastreviewed null
 */
export class TypedPersistable<T extends Record<string, SavableObject>> extends TypedMap<T> implements SoftPersistable {
  public readonly key: string;
  constructor(key: string, defaultValue: T) {
    super();
    this.key = key;
    this.obj = vscode.workspace.getConfiguration().get<T>(key, defaultValue);
  }


  /**
   * Sets a value with type safety and automatic persistence.
   * @param key The key to set
   * @param value The value to set
   * @returns This instance for chaining
   * @lastreviewed null
   */
  set<K extends keyof T & string>(key: K, value: T[K]): this {
    super.set(key, value);
    this.store();
    return this;
  }


  // documented in parent
  toJSON(): string {
    return JSON.stringify(this.obj);
  }

  // documented in parent
  store(): void {
    throw new Error("Method not implemented.");
  }
}

/**
 * A wrapper around the vscode settings to provide typed access and modification.
 * 
 * A convention is used where the settings key in vscode is `bsjs-push-pull.<settingKey>`
 * and nested keys are represented with dot notation, e.g. `bsjs-push-pull.nested.key`.
 * 
 * We very specifically want to funnel all settings changes through this class
 * so that we can ensure that the settings are always in sync with the vscode and appropriate context variables.
 * 
 * The thing to note here is that c
 * 
 * @lastreviewed null
 */
export class SettingsWrapper extends TypedMap<Settings> implements SoftPersistable {
  public static readonly DEFAULT: Settings = { debugMode: { enabled: false }, updateCheck: { enabled: true, showNotifications: true } };
  constructor() {
    // Read from user settings (global) with fallback to defaults
    const config = vscode.workspace.getConfiguration().inspect<Settings>(App.appKey)?.globalValue ||
      SettingsWrapper.DEFAULT;
    super(config);
  }

  // documented in parent
  get<K extends keyof Settings>(key: K): Settings[K] {
    return super.get(key) || SettingsWrapper.DEFAULT[key];
  }

  // documented in parent
  set<K extends keyof Settings>(key: K, value: Settings[K]): this {
    super.set(key, value);
    console.log(`Setting context key: bsjs-push-pull.${key} to ${JSON.stringify(value)}`);
    this.store();
    return this;
  }

  // documented in parent
  store(update: boolean = true): void {
    console.log('attempting to store');
    const flattened: { key: string, value: SavableObject }[] = [];
    for (const key of this.keys()) {
      Util.rethrow(flattenLayer, { key, obj: this.get(key) });

    }
    function flattenLayer({ key, obj }: { key: string, obj: SavableObject }) {
      if (typeof obj === 'object' && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
          flattenLayer({ key: `${key}.${k}`, obj: v });
        }
      } else {
        flattened.push({ key, value: obj });
      }
    }
    console.log("Storing settings:", flattened);
    flattened.forEach(({ key, value }) => {
      const config = vscode.workspace.getConfiguration(App.appKey);

      // Set context variable for immediate UI responsiveness
      vscode.commands.executeCommand('setContext', `bsjs-push-pull.${key}`, value);
      //this.context.workspaceState.update(`bsjs-push-pull.${key}`, value);
      if (update) {
        try {
          config.update(key, value, vscode.ConfigurationTarget.Global);
        } catch (e) {
          Alert.error(`Error updating settings key ${key}: ${e}`);
          throw e;
        }
      }
    });
  }

  sync(): void {
    // Read the effective configuration value (includes recent updates)
    const inspectResult = vscode.workspace.getConfiguration().inspect<Settings>(App.appKey);
    const config = inspectResult?.globalValue || SettingsWrapper.DEFAULT;
    const fleshedOut = { ...SettingsWrapper.DEFAULT, ...config };
    console.log("Settings changed, syncing");
    console.log("Current settings:", this.obj);
    console.log("Inspect result:", inspectResult);
    console.log("New effective settings:", fleshedOut);
    // Update each property individually to maintain type safety
    for (const key of Object.keys(fleshedOut)) {

      const k = key as keyof Settings;
      console.log(`Syncing setting ${k}`);
      const value = fleshedOut[k];
      type K = keyof Settings;
      // Use the set method without store() call to avoid redundant updates
      (this.obj as Record<K, Settings[K]>)[k] = value as Settings[K];
    }
    for (const key of this.keys()) {
      if (!(key in fleshedOut)) {
        console.log(`Removing obsolete setting ${key}`);
        this.delete(key);
      }
    }
    this.store(false);
  }
}