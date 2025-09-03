import type { SavableObject } from "../../../../../types";
import * as vscode from "vscode";
import { App } from "../../App";

export class PseudoMap<T> {
  protected obj: Record<string, T> = {};
  constructor(initialData?: Record<string, T>) {
    if (initialData) {
      this.obj = initialData;
    }
  }
  get(key: string): T | undefined  {
    return this.obj[key];
  }
  has(key: string): boolean {
    return key in this.obj;
  }
  set(key: string, value: T): this {
    this.obj[key] = value;
    return this;
  }
  forEach(callback: (arg: [key: string, value: T]) => void): void {
    for (const key in this.obj) {
      callback([key, this.obj[key]]);
    }
  }
  delete(key: string): this {
    delete this.obj[key];
    return this;
  }
  toJSON(): string {
    return JSON.stringify(this.obj);
  }
  toSavableObject(): SavableObject {
    return this.obj as SavableObject;
  }
};


export abstract class PersistableMap<T extends SavableObject> extends PseudoMap<T> {
  readonly key: string;
  readonly context: vscode.ExtensionContext;
  constructor(key: string, context: vscode.ExtensionContext) {
    super();
    this.key = key;
    this.context = context;
  }
  // @Override
  set(key: string, value: T): this {
    super.set(key, value);
    this.store();
    return this;
  }
  clear(): void {
    this.obj = {};
    this.store();
  }
  abstract store(): void;
}

export class PublicPersistanceMap<T extends SavableObject> extends PersistableMap<T> {
  constructor(key: PublicKeys, context: vscode.ExtensionContext) {
    super(key, context);
    this.obj = App.context.workspaceState.get<Record<string, T>>(this.key, {});
  }

  // @Override
  store(): void {
    App.logger.info("PublicPersistanceMap storing data with key:", this.key);
    App.context.workspaceState.update(this.key, this.obj);
  }


}
export class PrivatePersistanceMap<T extends SavableObject> extends PersistableMap<T> {
  constructor(key: PrivateKeys, context: vscode.ExtensionContext) {
    super(key, context);
    App.context.secrets.get(this.key).then(jsonString => {
      this.obj = JSON.parse(jsonString || '{}');
    });
  }
  store(): void {
    App.logger.info("PrivatePersistanceMap storing data with key:", this.key);
    App.context.secrets.store(this.key, JSON.stringify(this.obj));
  }
}

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

export enum PublicKeys {
  /**
   * TODO
   */
  SETTINGS = 'b6p:user_settings',
}
