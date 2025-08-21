import type { Serializable } from "node:worker_threads";
import { SavableMap } from "../src/main/app/util/StateManager";

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
  get toBase64(): string;
  authHeaderValue(): string;
}
/**
 * TODO
 */

type VSCodeSerializable = { [k: string]: SavableObject };
type SavableObject = string | number | boolean | null | bigint | SavableMap | VSCodeSerializable;
