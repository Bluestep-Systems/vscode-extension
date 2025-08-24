import type { SavableObject } from "../../../../types";
import { State } from "./StateManager";

export abstract class PseudoMap<T> {
  protected obj: Record<string, T> = {};
  constructor(initialData?: Record<string, T>) {
    if (initialData) {
      this.obj = initialData;
    }
  }
  get(key: string): T | undefined {
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
  getKeyRequired(key: string): T {
    if (!this.has(key)) {
      throw new Error(`Key '${key}' is required but not found`);
    }
    return this.get(key)!;
  }
};

export class TransientMap<T> extends PseudoMap<T> {
  constructor(initialData?: Record<string, T>) {
    super(initialData);
  }
}

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
  constructor(key: PrivateKeys) {
    super();
    this.key = key;
    console.log("PrivatePersistanceMap initialized with key:", key);
    State.context.secrets.get(this.key).then(jsonString => {
      this.obj = JSON.parse(jsonString || '{}');
    });
  }
  store(): void {
    console.log("PrivatePersistanceMap storing data with key:", this.key);
    State.context.secrets.store(this.key, JSON.stringify(this.obj));
  }
  clear(bool?: boolean): void {
    this.obj = {};
    bool && this.store();
  }
}

export enum PrivateKeys {
  BASIC_AUTH = 'basic_auth',
}
