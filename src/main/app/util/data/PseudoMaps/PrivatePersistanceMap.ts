import * as vscode from "vscode";
import type { SavableObject } from "../../../../../../types";
import { SoftPersistableMap } from "./SoftPersistableMap";
import { HardPersistable } from "./Persistable";
import { PrivateKeys } from "./PersistenceKeys";

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
  async set(key: string, value: T) {
    this.requiresInit();
    super.set(key, value);
  }

  // documented in parent
  async setAsync(key: string, value: T): Promise<this> {
    this.requiresInit();
    super.set(key, value);
    await this.store();
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
    await this.store();
    return this;
  }

  // documented in parent
  clear(): void {
    this.requiresInit();
    super.clear();
    this.store();
  }

  // documented in parent
  store(): Thenable<void> {
    this.requiresInit();
    return this.context.secrets.store(this.key, JSON.stringify(this.obj));
  }
}