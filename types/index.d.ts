/**
 * TODO
 */
declare interface ReadOnlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(callback: (value: T, key?: string) => void): void;
}

export type SavableObject = string | number | boolean | null | bigint | { [key: string]: SavableObject } | SavableObject[];
