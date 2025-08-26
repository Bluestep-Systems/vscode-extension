import type { SavableObject } from "../../../../types";
import { State } from "../App";

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
  set(key: string, value: T): void {
    this.obj[key] = value;
  }
  forEach(callback: (element: T, key: string) => void): void {
    for (const key in this.obj) {
      callback(this.obj[key], key);
    }
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
  clear(bool?: boolean): void;
}

export class PublicPersistanceMap<T extends SavableObject> extends PseudoMap<T> implements Persistable {
  readonly key: string;
  constructor(key: string) {
    super();
    this.key = key;
    console.log("PublicPersistanceMap initialized with key:", key);
    this.obj = State.context.workspaceState.get<Record<string, T>>(this.key, {});
  }
  store(): void {
    console.log("PublicPersistanceMap storing data with key:", this.key);
    State.context.workspaceState.update(this.key, this.obj);
  }
  clear(bool?: boolean): void {
    this.obj = {};
    bool && this.store();
  }
}
export class PrivatePersistanceMap<T extends SavableObject> extends PseudoMap<T> implements Persistable {
  readonly key: PrivateKeys;
  //TODO 
  // lastModified: number;
  private initialized: boolean = false;
  constructor(key: PrivateKeys) {
    super();
    this.key = key;
    console.log("PrivatePersistanceMap loaded data for key:", this.key);
    State.context.secrets.get(this.key).then(jsonString => {
      this.obj = JSON.parse(jsonString || '{}');
      this.initialized = true;
    });
    // State.context.secrets.get(this.key + "-metadata").then(jsonString => {
    //   this.lastModified = JSON.parse(jsonString || '{}').lastModified || Date.now();
    //   this.initialized = true;
    // });
  }
  store(): void {
    console.log("PrivatePersistanceMap storing data with key:", this.key);
    State.context.secrets.store(this.key, JSON.stringify(this.obj));
    State.saveState();
  }
  clear(bool?: boolean): void {
    this.obj = {};
    bool && this.store();
  }
  // TODO find a better way to do this in typescript
  // @Override
  get(key: string): T | undefined {
    return this.obj[key];
  }
  async touch(): Promise<void> {
    // Update the last accessed time
  }
}

export enum PrivateKeys {
  BASIC_AUTH = 'basic_auth',
}
