import * as vscode from "vscode";
import type { SavableObject } from "../../../../../types";

/**
 * A simple class that mimics the behavior of a Map, but uses a plain object underneath.
 */
export class PseudoMap<T> {
  /**
   * The internal object storing key-value pairs.
   */
  protected obj: Record<string, T> = {};

  /**
   * Creates an instance of PseudoMap.
   * @param initialData Optional initial data to populate the map.
   */
  constructor(initialData?: Record<string, T>) {
    if (initialData) {
      this.obj = initialData;
    }
  }

  /**
   * Retrieves the value associated with the given key.
   * @param key The key to look up.
   * @returns The value associated with the key, or undefined if not found.
   */
  get(key: string): T | undefined  {
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
  set(key: string, value: T): this {
    this.obj[key] = value;
    return this;
  }

  /**
   * Executes a provided function once for each key-value pair in the map.
   * @param callback The function to execute for each entry.
   */
  forEach(callback: (value: T, key: string, map: this) => void): void {
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
    this.obj = {};
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

  forEach(callback: (value: T, key: string, map: this) => void): void {
    this.requiresInit();
    super.forEach(callback);
  }

  delete(key: string): this {
    this.requiresInit();
    return super.delete(key);
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
    if (!this.initialized) {
      throw new Error("PrivatePersistanceMap not fully initialized");
    }
    this.context.secrets.store(this.key, JSON.stringify(this.obj));
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
   * key for the data we persist for the existing sessions map
   */
  SESSIONS = 'b6p:sessions'

}

/**
 * Keys used for public persistance maps
 */
export enum PublicKeys {
  /**
   * TODO
   */
  SETTINGS = 'b6p:user_settings',

}
