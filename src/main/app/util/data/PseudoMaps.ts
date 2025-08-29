import type { SavableObject } from "../../../../../types";
import { App } from "../../App";

export abstract class PseudoMap<T> {
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
  forEach(callback: (element: T, key: string) => void): void {
    for (const key in this.obj) {
      callback(this.obj[key], key);
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


interface Persistable {
  readonly key: string;
  store(): void;
  clear(): void;
}

export class PublicPersistanceMap<T extends SavableObject> extends PseudoMap<T> implements Persistable {
  readonly key: string;
  constructor(key: string) {
    super();
    this.key = key;
    App.logger.info("PublicPersistanceMap initialized with key:", key);
    this.obj = App.context.workspaceState.get<Record<string, T>>(this.key, {});
  }
  // @Override
  set(key: string, value: T): this {
    this.obj[key] = value;
    this.store();
    return this;
  }
  store(): void {
    App.logger.info("PublicPersistanceMap storing data with key:", this.key);
    App.context.workspaceState.update(this.key, this.obj);
  }
  clear(): void {
    this.obj = {};
    this.store();
  }
}
export class PrivatePersistanceMap<T extends SavableObject> extends PseudoMap<T> implements Persistable {
  readonly key: PrivateKeys;
  // TODO: Implement support for tracking and storing metadata such as lastModified timestamp for PrivatePersistanceMap entries.
  // lastModified: number;
  private initialized: boolean = false;
  constructor(key: PrivateKeys) {
    super();
    this.key = key;
    App.logger.info("PrivatePersistanceMap loaded data for key:", this.key);
    App.context.secrets.get(this.key).then(jsonString => {
      this.obj = JSON.parse(jsonString || '{}');
      this.initialized = true;
    });
    // State.context.secrets.get(this.key + "-metadata").then(jsonString => {
    //   this.lastModified = JSON.parse(jsonString || '{}').lastModified || Date.now();
    //   this.initialized = true;
    // });
  }
  store(): void {
    App.logger.info("PrivatePersistanceMap storing data with key:", this.key);
    App.context.secrets.store(this.key, JSON.stringify(this.obj));
    App.saveState();
  }
  clear(): void {
    this.obj = {};
    this.store();
  }
  // @Override
  set(key: string, value: T): this {
    this.obj[key] = value;
    this.store();
    return this;
  }
  async touch(): Promise<void> {
    // Update the last accessed time
  }
  public isInitialized(): boolean {
    return this.initialized;
  }
}

export enum PrivateKeys {
  BASIC_AUTH = 'basic_auth',
  SESSIONS = 'b6p:sessions'
}
