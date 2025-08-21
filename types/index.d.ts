import type { SavableMap } from "../src/main/app/util/SavableMap";

/**
 * TODO
 */
declare interface ReadOnlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(callback: (value: T, key?: string) => void): void;
}
/**
 * TODO
 */
declare interface UserCredentials {
  store: SavableMap<{ username: string; password: string }>;
  get toBase64(): string;
  authHeaderValue(): string;
}
/**
 * TODO
 */
//type VSCodeSerializable = { [k: string]: SavableObject | SavableObject[] };

type SavableObject = string | number | boolean | null | bigint | { [key: string]: SavableObject } | SavableObject[];
