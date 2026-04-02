import * as vscode from "vscode";
import { BasicAuthParams } from "../../../../types";
import { AuthTypes } from "../../resources/constants";
import { PrivateKeys, PrivateGenericMap } from "../util/PseudoMaps";
import type { IPersistence } from "../../../core/providers";
import { AuthManager } from "./AuthManager";
import { BasicAuth } from "./BasicAuth";

/**
 * {@link BasicAuth} manager for VS Code extension authentication.
 *
 * This manager handles Basic Authentication credentials for BlueStep WebDAV operations.
 * It supports multiple authentication "flags" (profiles) to manage different sets of
 * credentials for different servers or users.
 *
 * Key features:
 * - Secure credential storage using persistence provider's secret storage
 * - Multiple authentication profiles via flags
 * - Automatic credential creation and update workflows
 * - Integration with BlueStep WebDAV session management
 *
 * @example
 * ```typescript
 * // Create the manager
 * const authManager = new BasicAuthManager(persistence);
 *
 * // Get authentication for default flag
 * const auth = await authManager.getDefaultAuth();
 *
 * // Use in HTTP requests
 * const headers = {
 *   'Authorization': await authManager.authHeaderValue()
 * };
 * ```
 *
 * @lastreviewed null
 */

export class BasicAuthManager extends AuthManager<BasicAuth> {

  /**
   * Internal persistence map storing {@link BasicAuth} credentials by flag.
   * Uses the persistence provider's secret storage for secure credential persistence.
   * @lastreviewed null
   */
  private readonly flagMap: PrivateGenericMap<BasicAuthParams>;

  /**
   * Current authentication flag used for operations.
   * Defaults to DEFAULT_FLAG and can be changed via setFlag().
   * @lastreviewed 2025-10-01
   */
  private CUR_FLAG: string = this.DEFAULT_FLAG;

  /**
   * Creates a new {@link BasicAuthManager}.
   *
   * @param persistence The persistence provider for secure credential storage
   * @lastreviewed null
   */
  constructor(persistence: IPersistence) {
    super(persistence);
    this.flagMap = new PrivateGenericMap(PrivateKeys.BASIC_AUTH, persistence);
  }

  /**
   * Clears all stored authentication credentials.
   * Removes all credential data from persistent storage.
   * @lastreviewed 2025-10-01
   */
  public clearMap() {
    this.flagMap.clear();
  }

  /**
   * Sets the current authentication flag for subsequent operations.
   * Changes which credential profile will be used by default.
   * @param flag The authentication flag/profile to set as current
   * @lastreviewed 2025-10-01
   */
  public setFlag(flag: string) {
    this.CUR_FLAG = flag;
  }

  /**
   * Gets the authentication object for the specified flag.
   *
   * Retrieves stored credentials or optionally creates new ones if none exist.
   * If no credentials are found and createIfNotPresent is true, prompts user
   * for new credentials and stores them.
   *
   * @param flag The authentication flag/profile to retrieve (defaults to current flag)
   * @param createIfNotPresent Whether to create new credentials if none exist
   * @returns a {@link Promise} resolving to {@link BasicAuth} object with credentials
   * @throws an {@link Error} if no credentials found and createIfNotPresent is false
   * @lastreviewed 2025-10-01
   */
  public async getAuthObject(flag: string = this.CUR_FLAG, createIfNotPresent: boolean = true): Promise<BasicAuth> {
    const existingAuth = this.flagMap.get(flag);
    if (!existingAuth) {
      if (createIfNotPresent) {
        vscode.window.showInformationMessage('No existing credentials found, please enter new credentials.');
        return await this.createNewCredentials(flag);
      } else {
        throw new Error(`No existing credentials found for flag: ${flag}`);
      }
    } else {
      return new BasicAuth(existingAuth);
    }
  }

  /**
   * Creates new credentials or updates existing ones for the current flag.
   *
   * Provides a unified workflow for credential management:
   * - If credentials exist: prompts user to update them
   * - If no credentials: creates new ones from user input
   *
   * @returns Promise resolving to {@link BasicAuth} object with current credentials
   * @lastreviewed 2025-10-01
   */
  public async createOrUpdate(): Promise<BasicAuth> {
    const flag = this.determineFlag();
    if (this.hasAuth(flag)) {
      const existing = await this.getAuthObject(flag, true);
      await existing.update();
      this.setAuthObject(existing, flag);
      return existing;
    } else {
      return await this.createNewCredentials(flag);
    }
  }

  /**
   * Checks if authentication credentials exist for the specified flag.
   * @param flag The authentication flag/profile to check (defaults to current flag)
   * @lastreviewed 2025-10-01
   */
  public hasAuth(flag: string = this.CUR_FLAG): boolean {
    return this.flagMap.has(flag);
  }

  /**
   * Sets the authentication object for the specified flag.
   *
   * Stores the provided {@link BasicAuth} credentials in persistent storage
   * associated with the given flag.
   *
   * @param auth The {@link BasicAuth} object containing credentials to store
   * @param flag The authentication flag/profile to associate with credentials
   * @returns The auth object for method chaining
   * @lastreviewed 2025-10-01
   */
  public setAuthObject(auth: BasicAuth, flag: string = this.CUR_FLAG) {
    this.flagMap.set(flag, auth.toSerializableObject());
    return auth;
  }

  /**
   * Retrieves default authentication credentials.
   *
   * Returns the {@link BasicAuth} object for the default flag (DEFAULT_FLAG).
   * Used for scenarios requiring default system credentials.
   *
   * @returns a {@link Promise} resolving to {@link BasicAuth} object with default credentials
   * @lastreviewed 2025-10-01
   */
  public async getDefaultAuth(): Promise<BasicAuth> {
    return (await this.getAuthObject(this.DEFAULT_FLAG));
  }

  /**
   * Generates the HTTP Authorization header value for basic authentication.
   *
   * Creates a properly formatted Authorization header using the specified
   * authentication credentials. Uses base64 encoding as required
   * by the HTTP Basic Authentication specification.
   *
   * @param flag The authentication flag/profile to use (defaults to current flag)
   * @returns Promise resolving to "Basic {base64(username:password)}" header value
   * @lastreviewed 2025-10-01
   */
  public async authHeaderValue(flag: string = this.CUR_FLAG) {
    const auth = await this.getAuthObject(flag);
    return `${AuthTypes.BASIC_PREFIX}${auth ? auth.toBase64() : ''}`;
  }

  /**
   * Generates the request body for basic authentication login.
   *
   * Creates a properly formatted login body containing username and password
   * from the specified authentication credentials.
   *
   * @param flag The authentication flag/profile to use (defaults to current flag)
   * @returns Promise resolving to login body object with username and password
   * @lastreviewed 2025-10-01
   */
  public async authLoginBodyValue(flag: string = this.CUR_FLAG) {
    const auth = await this.getAuthObject(flag);
    const params = auth.toSerializableObject();
    return `_postEvent=commit&_postFormClass=myassn.user.UserLoginWebView&rememberMe=false&myUserName=${encodeURIComponent(params.username)}&myPassword=${encodeURIComponent(params.password)}`;
  }

  /**
   * Creates new credentials for the specified authentication flag.
   *
   * Prompts the user for username and password input, creates a new BasicAuth
   * object, and stores it in persistent storage. This method is used when
   * no existing credentials are found for the given flag.
   *
   * @param flag The authentication flag/profile to create credentials for
   * @returns Promise resolving to newly created {@link BasicAuth} object
   * @lastreviewed 2025-10-01
   */
  public async createNewCredentials(flag: string = this.CUR_FLAG) {
    const authObj = await BasicAuth.generateNew();
    this.setAuthObject(authObj, flag);
    return authObj;
  }

  /**
   * Determines the appropriate authentication flag based on current context.
   *
   * This manager determines the flag based on reseller name or other contextual
   * information. Used internally to select the correct authentication profile
   * for the current operation.
   *
   * @returns The flag to use for the operation
   * @lastreviewed 2025-10-01
   */

  public determineFlag() {
    return this.CUR_FLAG;
  }
}
