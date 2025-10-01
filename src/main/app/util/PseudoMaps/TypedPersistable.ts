import * as vscode from "vscode";
import type { Serializable } from "../../../../../types";
import { TypedMap } from "./TypedMap";
import { Persistable } from "./Persistable";
import { PrivateKeys, PublicKeys } from "./PersistenceKeys";

/**
 * A persistable version of {@link TypedMap} that automatically handles loading and storing
 * from the VSCode extension context's workspace state.
 * @lastreviewed 2025-10-01
 */
export class TypedPersistable<T extends Record<string, Serializable>> extends TypedMap<T> implements Persistable {
  public readonly key: PublicKeys | PrivateKeys;
  protected context: vscode.ExtensionContext;

  constructor({key, context, defaultValue}: {key: PublicKeys | PrivateKeys, context: vscode.ExtensionContext, defaultValue: T}) {
    super();
    this.key = key;
    this.context = context;
    this.obj = this.context.workspaceState.get<T>(this.key, defaultValue);
  }

  /**
   * Sets a value with type safety and automatic persistence.
   * @param key The key to set
   * @param value The value to set
   * @param update Whether to immediately store the updated map. This is primarily intended to allow you to await store() after multiple sets
   * so it doesn't get called multiple times in a row.
   * @returns This instance for chaining
   * @lastreviewed 2025-10-01
   */
  set<K extends keyof T & string>(key: K, value: T[K]): this
  set<K extends keyof T & string>(key: K, value: T[K], update: boolean = true): this {
    super.set(key, value);
    update && this.store();
    return this;
  }

  
  toJSON(): string {
    return JSON.stringify(this.obj);
  }
  
  store(): Thenable<void> {
    return this.context!.workspaceState.update(this.key, JSON.stringify(this.obj));
  }
}