import * as vscode from 'vscode';
import { PrivateKeys, PrivatePersistanceMap } from "../util/data/PseudoMaps";
import { ContextNode } from '../services/ContextNode';
import { SavableObject } from '../../../../types';

export namespace Auth {
  /**
   * Generic Auth class that can be extended for specific auth types.
   */
  abstract class AuthObject {
    /**
     * the internal savable object
     */
    protected sObj: SavableObject;

    /**
     * constructs an auth object containing the given savable object.
     * @param arg the internal savable object
     */
    constructor(arg: SavableObject) {
      this.sObj = arg;
    }
    /**
     * produces a savable object representing the internal state that can be used
     * in any one of the persistable maps.
     */
    abstract toSavableObject(): SavableObject;

    /**
     * produces a JSON representation of the internal state.
     */
    abstract toJSON(): string;

    static generateNew(): Promise<void> {
      throw new Error("Not implemented");
    }

    abstract updateExisting(): Promise<void>;
  }

  export abstract class AuthManager extends ContextNode {
    readonly DEFAULT_FLAG: string = "default";
    abstract getNewCredentials(flag?: string): Promise<void>;
    abstract determineFlag(): string;
    abstract hasAuth(flag?: string): boolean;
    abstract setAuthObject(auth: AuthObject, flag?: string): void;
    abstract getAuthObject(flag?: string): Promise<AuthObject>;
  }

  type BasicAuthParams = {
    username: string;
    password: string;
  };

  export class BasicAuth extends AuthObject {
    /**
     * this is the only way to override the more generic type of the parent
     * and indicate that this child object will always have this specific shape.
     */
    declare sObj: BasicAuthParams;
    /**
     * constructs a BasicAuth object containing the given username/password.
     */
    constructor({ username, password }: BasicAuthParams) {
      super({ username, password });
    }

    toSavableObject() {
      return this.sObj;
    }

    toJSON() {
      return JSON.stringify({ username: this.sObj.username, password: "***" });
    }

    /**
     * @returns the base64 encoded username:password string.
     */
    toBase64() {
      return Buffer.from(`${this.sObj.username}:${this.sObj.password}`).toString('base64');
    }

    async updateExisting(): Promise<void> {
      const oldUsername = this.sObj.username;
      const oldPassword = this.sObj.password;
      const newUsername = await vscode.window.showInputBox({ prompt: 'Enter new username', placeHolder: oldUsername + " (Enter to Keep)" });

      if (typeof newUsername === 'undefined') {
        vscode.window.showErrorMessage('cancelled');
        return;
      } else {
        if (newUsername !== "") {
          this.sObj.username = newUsername;
        }
      }
      const newPassword = await vscode.window.showInputBox({ prompt: 'Enter new password', placeHolder: "*** (Enter to Keep)", password: true });
      if (typeof newPassword === 'undefined') {
        vscode.window.showErrorMessage('cancelled');
        return;
      } else {
        if (newPassword !== "") {
          this.sObj.password = newPassword;
        }
      }
      if (this.sObj.username === oldUsername && this.sObj.password === oldPassword) {
        vscode.window.showInformationMessage("No changes made to credentials.");
      } else {
        vscode.window.showInformationMessage("Credentials Updated!");
      }
    }
  }

  export const BASIC_AUTH_MANAGER = new class extends AuthManager {

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

    readonly DEFAULT_FLAG = "default";
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

    public clear() {
      this.flagMap.clear();
    }

    public setFlag(flag?: string) {
      this.CUR_FLAG = flag || this.DEFAULT_FLAG;
    }

    public async getAuthObject(flag: string = BASIC_AUTH_MANAGER.CUR_FLAG): Promise<BasicAuth> {
      const existingAuth = this.flagMap.get(flag);
      if (!existingAuth) {
        vscode.window.showInformationMessage('No existing credentials found, please enter new credentials.');
        await this.getNewCredentials(flag);
        return this.getAuthObject(flag);
      } else {
        return new BasicAuth(existingAuth);
      }
    }

    public hasAuth(flag: string = BASIC_AUTH_MANAGER.CUR_FLAG): boolean {
      return this.flagMap.has(flag);
    }

    public setAuthObject(auth: BasicAuth, flag: string = BASIC_AUTH_MANAGER.CUR_FLAG) {
      this.flagMap.set(flag, auth.toSavableObject());
    }

    public async getDefaultAuth(): Promise<BasicAuth> {
      return await this.getAuthObject(BASIC_AUTH_MANAGER.DEFAULT_FLAG);
    }

    public async authHeaderValue(flag: string = BASIC_AUTH_MANAGER.CUR_FLAG) {
      const auth = await this.getAuthObject(flag);
      return `Basic ${auth ? auth.toBase64() : ''}`;
    }

    public async getNewCredentials(flag: string = BASIC_AUTH_MANAGER.CUR_FLAG) {
      const username = await vscode.window.showInputBox({ prompt: 'Enter your username' })
        .then(resp => {
          // username validation?
          return resp || "";
        });
      const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true })
        .then(resp => {
          // password validation?
          return resp || "";
        });
      this.setAuthObject(new BasicAuth({ username, password }), flag);
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

  export function determineManager(): AuthManager {
    return BASIC_AUTH_MANAGER;
  }
}
