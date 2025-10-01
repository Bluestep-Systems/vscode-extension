import * as vscode from "vscode";
import { ContextNode } from "../context/ContextNode";
import type { SESSION_MANAGER } from "../b6p_session/SessionManager";
import { AuthObject } from "./AuthObject";

/**
 * Abstract base class for managing authentication objects of a specific type.
 * Extends ContextNode to provide VS Code context and persistence capabilities.
 * @template T The type of AuthObject this manager handles
 * @lastreviewed null
 */
export abstract class AuthManager<T extends AuthObject> extends ContextNode {

  /**
   * The default flag used when no specific flag is provided.
   * @lastreviewed null
   */
  readonly DEFAULT_FLAG = "default";

  /**
   * The VS Code extension context needed for persistence operations.
   * @lastreviewed null
   */
  public abstract context: vscode.ExtensionContext;

  /**
   * Determines the flag needed for an arbitrary operation.
   *
   * NOTE: this is abstract because different auth managers may have different
   * ways of determining the flag. For example, basic auth may use the realm,
   * while OAuth may use the client ID.
   *
   * @returns The flag to use for the operation
   * @lastreviewed null
   */
  public abstract determineFlag(): string;

  /**
   * Checks if the auth manager has credentials for the given flag.
   * @param flag The flag to check for existing credentials
   * @returns True if credentials exist for the flag, false otherwise
   * @lastreviewed null
   */
  public abstract hasAuth(flag: string): boolean;

  /**
   * Sets the auth object for the given flag.
   * @param auth The auth object to set
   * @param flag The flag to associate with the auth object
   * @returns The auth object that was set
   * @lastreviewed null
   */
  public abstract setAuthObject(auth: T, flag: string): T;

  /**
   * Gets the auth object for the given flag.
   * @param flag The flag to get the auth object for
   * @param createIfNotPresent Whether to create a new auth object if none exists for the flag
   * @returns Promise that resolves to the auth object for the specified flag
   * @lastreviewed null
   */
  public abstract getAuthObject(flag: string, createIfNotPresent: boolean): Promise<T>;

  /**
   * Creates new credentials or updates existing ones based on current state.
   * @returns Promise that resolves to the created or updated auth object
   * @lastreviewed null
   */
  public abstract createOrUpdate(): Promise<T>;

  /**
   * Gets the default auth object for this manager.
   * @returns Promise that resolves to the default auth object
   * @lastreviewed null
   */
  public abstract getDefaultAuth(): Promise<T>;

  /**
   * Creates new credentials for the given flag, overriding any existing ones and persisting them.
   * @param flag The flag to create credentials for
   * @returns Promise that resolves to the newly created auth object
   * @lastreviewed null
   */
  public abstract createNewCredentials(flag: string): Promise<T>;

  /**
   * Gets the auth header value for the given flag, or default if none is given.
   * @param flag The flag to get the auth header value for (optional, defaults to default flag)
   * @returns Promise that resolves to the authorization header value
   * @lastreviewed null
   */
  public abstract authHeaderValue(flag?: string): Promise<string>;

  /**
   * Gets the auth login body value for the given flag.
   * This is likely to be removed in favor of just using the header value.
   * @param flag The flag to get the auth login body value for (optional, defaults to default flag)
   * @returns Promise that resolves to the login body value
   * @deprecated Consider using authHeaderValue instead
   * @lastreviewed null
   */
  public abstract authLoginBodyValue(flag?: string): Promise<string>;

  /**
   * Initializes the auth manager from the SESSION_MANAGER context node.
   * @param parent The SESSION_MANAGER instance to use as parent context
   * @returns This auth manager instance for method chaining
   * @lastreviewed null
   */
  public abstract init(parent: typeof SESSION_MANAGER): this;
}
