import * as vscode from "vscode";
import { ContextNode } from "../context/ContextNode";
import type { SESSION_MANAGER } from "../b6p_session/SessionManager";
import { AuthObject } from "./AuthObject";

/**
 * Abstract base class for managing authentication objects of a specific type.
 * Extends ContextNode to provide VS Code context and persistence capabilities.
 * @lastreviewed 2025-10-01
 */
export abstract class AuthManager<T extends AuthObject> extends ContextNode {

  /**
   * The default flag used when no specific flag is provided.
   * @lastreviewed 2025-10-01
   */
  readonly DEFAULT_FLAG = "default";

  /**
   * The VS Code extension context needed for persistence operations.
   * @lastreviewed 2025-10-01
   */
  public abstract context: vscode.ExtensionContext;

  /**
   * Determines the flag needed for an arbitrary operation.
   *
   * NOTE: this is abstract because different auth managers may have different
   * ways of determining the flag. For example, basic auth may use the realm,
   * while OAuth may use the client ID.
   *
   * @lastreviewed 2025-10-01
   */
  public abstract determineFlag(): string;

  /**
   * Checks if the auth manager has credentials for the given flag.
   * @param flag The flag to check for existing credentials
   * @lastreviewed 2025-10-01
   */
  public abstract hasAuth(flag: string): boolean;

  /**
   * Sets the auth object for the given flag.
   * @param auth The auth object to set
   * @param flag The flag to associate with the auth object
   * @returns The auth object that was set
   * @lastreviewed 2025-10-01
   */
  public abstract setAuthObject(auth: T, flag: string): T;

  /**
   * Gets the auth object for the given flag.
   * @param flag The flag to get the auth object for
   * @param createIfNotPresent Whether to create a new auth object if none exists for the flag
   * @returns a {@link Promise} that resolves to the auth object for the specified flag
   * @lastreviewed 2025-10-01
   */
  public abstract getAuthObject(flag: string, createIfNotPresent: boolean): Promise<T>;

  /**
   * Creates new credentials or updates existing ones based on current state.
   * @returns a {@link Promise} that resolves to the created or updated auth object
   * @lastreviewed 2025-10-01
   */
  public abstract createOrUpdate(): Promise<T>;

  /**
   * Gets the default auth object for this manager.
   * @returns a {@link Promise} that resolves to the default auth object
   * @lastreviewed 2025-10-01
   */
  public abstract getDefaultAuth(): Promise<T>;

  /**
   * Creates new credentials for the given flag, overriding any existing ones and persisting them.
   * @param flag The flag to create credentials for
   * @returns a {@link Promise} that resolves to the newly created auth object
   * @lastreviewed 2025-10-01
   */
  public abstract createNewCredentials(flag: string): Promise<T>;

  /**
   * Gets the auth header value for the given flag, or default if none is provided.
   * @param flag The flag to get the auth header value for (optional, defaults to default flag)
   * @lastreviewed 2025-10-01
   */
  public abstract authHeaderValue(flag?: string): Promise<string>;

  /**
   * Gets the auth login body value for the given flag.
   * This is likely to be removed in favor of just using the header value.
   * @param flag The flag to get the auth login body value for (optional, defaults to default flag)
   * @deprecated Consider using authHeaderValue instead
   * @lastreviewed 2025-10-01
   */
  public abstract authLoginBodyValue(flag?: string): Promise<string>;

  /**
   * Initializes the auth manager from the {@link SESSION_MANAGER} context node.
   * @returns This auth manager instance for method chaining
   * @lastreviewed 2025-10-01
   */
  public abstract init(parent: typeof SESSION_MANAGER): this;
}
