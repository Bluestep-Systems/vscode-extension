import * as vscode from "vscode";
import { ContextNode } from "../../services/ContextNode";
import { PrivateKeys, PrivatePersistanceMap } from "../../util/data/PseudoMaps";
import { AuthManager, BasicAuth, AuthError } from "../classes";
import { BasicAuthParams } from "../../../../../types";

/**
 * The singleton basic auth manager.
 */

export const BASIC_AUTH_MANAGER = new class extends AuthManager<BasicAuth> {

  /**
   * the internal map of flags to basic auth params.
   */
  private _flagMap: PrivatePersistanceMap<BasicAuthParams> | null = null;
  /**
   * the persistable map that this context node manages.
   */
  protected persistence() {
    return this.flagMap;
  }

  private CUR_FLAG: string = this.DEFAULT_FLAG;
  #parent: ContextNode | null = null;

  public init(parent: ContextNode) {
    this.#parent = parent;
    if (this._flagMap) {
      throw new Error("only one auth manager may be initialized");
    }
    this._flagMap = new PrivatePersistanceMap(PrivateKeys.BASIC_AUTH, this.context);
    return this;
  }

  public get parent() {
    if (!this.#parent) {
      throw new Error("AuthManager not initialized");
    }
    return this.#parent;
  }
  public get context() {
    if (!this.parent.context) {
      throw new Error("AuthManager not initialized");
    }
    return this.parent.context;
  }

  public initChildren(): void {
    return void 0;
  }

  private get flagMap() {
    if (!this._flagMap) {
      throw new Error('AuthManager not initialized');
    }
    return this._flagMap;
  }

  public clearPersistance() {
    this.flagMap.clear();
  }

  public setFlag(flag: string) {
    this.CUR_FLAG = flag;
  }

  public async getAuthObject(flag: string = this.CUR_FLAG, createIfNotPresent: boolean = true): Promise<BasicAuth> {
    const existingAuth = this.flagMap.get(flag);
    if (!existingAuth) {
      if (createIfNotPresent) {
        vscode.window.showInformationMessage('No existing credentials found, please enter new credentials.');
        return await this.createNewCredentials(flag);
      } else {
        throw new AuthError(`No existing credentials found for flag: ${flag}`);
      }
      
    } else {
      return new BasicAuth(existingAuth);
    }
  }

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

  public hasAuth(flag: string = this.CUR_FLAG): boolean {
    return this.flagMap.has(flag);
  }

  public setAuthObject(auth: BasicAuth, flag: string = this.CUR_FLAG) {
    this.flagMap.set(flag, auth.toSavableObject());
    return auth;
  }

  public async getDefaultAuth(): Promise<BasicAuth> {
    return (await this.getAuthObject(this.DEFAULT_FLAG));
  }

  public async authHeaderValue(flag: string = this.CUR_FLAG) {
    const auth = await this.getAuthObject(flag);
    return `Basic ${auth ? auth.toBase64() : ''}`;
  }

  public async createNewCredentials(flag: string = this.CUR_FLAG) {
    const authObj = await BasicAuth.generateNew();
    this.setAuthObject(authObj, flag);
    return authObj;
  }

  /**
   * Determines the correct credential flag for the domain in question. 
   * 
   * right now we will only ever use the default
   * @returns The relevant authentication flag.
   */
  public determineFlag() {
    return this.CUR_FLAG;
  }
}();