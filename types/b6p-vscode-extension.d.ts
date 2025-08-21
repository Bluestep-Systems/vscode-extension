import type { Serializable } from "node:worker_threads";

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
  username: string;
  password: string;
  newUsername(value: string): UserCredentials;
  newPassword(value: string): UserCredentials;
}
/**
 * TODO
 */

type VSCodeSerializable = { [k: string]: SavableObject };
type SavableObject = string | number | boolean | null | bigint | SavableMap | VSCodeSerializable;
export class SavableMap extends Map<string, SavableObject> { }