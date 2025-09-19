import * as vscode from "vscode";
import type { SavableObject } from "../../../../../types";
import { TypedMap } from "./TypedMap";
import { SoftPersistable } from "./Persistable";
import { PublicKeys } from "./PersistenceKeys";

/**
 * A typed persistable pseudomap.
 * @lastreviewed null
 */
export class TypedPersistable<T extends Record<string, SavableObject>> extends TypedMap<T> implements SoftPersistable {
  public readonly key: PublicKeys;
  protected context: vscode.ExtensionContext;
  
  constructor(key: PublicKeys, context: vscode.ExtensionContext, defaultValue: T) {
    super();
    this.key = key;
    this.context = context;
    this.obj = this.context.workspaceState.get<T>(this.key, defaultValue);
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
  store(): Thenable<void> {
    return this.context.workspaceState.update(this.key, JSON.stringify(this.obj));
  }
}