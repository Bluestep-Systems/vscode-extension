/**
 * An interface for objects that can be persisted but must be manually stored.
 */
export interface SoftPersistable {
  /**
   * Stores the current state of the object in the appropriate storage.
   */
  store(): void;
}

/**
 * An interface for objects that can be persisted asynchronously, and can be awaited on
 */
export interface HardPersistable extends SoftPersistable {
  /**
   * The key used for persisting the object.
   */
  readonly key: string;
  
  /**
   * Sets the value associated with the given key asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for set to be done
   * and you need an await done.
   * @param key The key to set.
   * @param value The value to associate with the key.
   * @returns A promise that resolves to the PersistableMap instance.
   */
  setAsync(key: string, value: import("../../../../../types").SavableObject): Thenable<this>;

  /**
   * Deletes the entry associated with the given key asynchronously.
   * 
   * This is primarily intended for situations where you can't wait for delete
   * and you need an await.
   * @param key The key to delete.
   * @returns A promise that resolves to the PersistableMap instance.
   */
  deleteAsync(key: string): Thenable<this>;
}