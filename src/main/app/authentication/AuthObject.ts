import { Serializable } from "../../../../types";
import { Err } from "../util/Err";

/**
 * Generic Auth class that can be extended for specific auth types.
 * Provides base functionality for authentication objects that can be serialized and persisted.
 * @lastreviewed 2025-10-01
 */
export abstract class AuthObject {
  /**
   * The internal object containing authentication data.
   * @lastreviewed 2025-10-01
   */
  protected sObj: Serializable;

  /**
   * Constructs an auth object containing the given savable object.
   * @param arg The internal object containing authentication data
   * @lastreviewed 2025-10-01
   */
  constructor(arg: Serializable) {
    this.sObj = arg;
  }

  /**
   * Produces a serializable object representing the internal state that can be used
   * in any one of the persistable maps.
   * @returns The object representing this auth object's state
   * @lastreviewed 2025-10-01
   */
  abstract toSerializableObject(): Serializable;

  /**
   * Produces a JSON representation of the internal state.
   * @returns JSON string representation of the auth object (sensitive data should be masked)
   * @lastreviewed 2025-10-01
   */
  abstract toJSON(): string;

  /**
   * Generates new credentials for this auth object, typically by prompting the user.
   * This is a static method that should be overridden by concrete implementations.
   * @returns Promise that resolves to a new AuthObject instance with user-provided credentials
   * @throws {Err.AuthenticationError} When not implemented by concrete class
   * @lastreviewed 2025-10-01
   */
  static generateNew(): Promise<AuthObject> {
    throw new Err.AuthenticationError("Not implemented");
  }

  /**
   * Updates the internal state of this auth object, typically by prompting the user
   * for new values. NOTE: this does not trigger any persistence; that is up to the caller.
   * @returns Promise that resolves when the update is complete
   * @lastreviewed 2025-10-01
   */
  abstract update(): Promise<void>;
}
