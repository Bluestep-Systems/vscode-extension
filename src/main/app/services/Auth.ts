import * as vscode from 'vscode';
import { PrivateKeys, PrivatePersistanceMap } from "../../app/util/data/PseudoMaps";
import { StatefulNode } from './StatefulNode';

type BasicAuthParams = { username: string; password: string; };
export class BasicAuth {
  username: string;
  password: string;
  constructor({ username, password }: BasicAuthParams) {
    this.username = username;
    this.password = password;
  }

  toSavableObject() {
    return { username: this.username, password: this.password };
  }
  toJSON() {
    return JSON.stringify({ username: this.username, password: "***" });
  }
}

export const BasicAuthManager = new class extends StatefulNode {

  private _flagMap: PrivatePersistanceMap<BasicAuthParams> | null = null;
  private readonly DEFAULT_FLAG = "default";
  private CUR_FLAG: string = this.DEFAULT_FLAG;
  #parent: StatefulNode | null = null;

  public init(parent: StatefulNode) {
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

  /**
   * alias for persistance map so this reads easier
   */
  private get flagMap() {
    if (!this._flagMap) {
      throw new Error('AuthManager not initialized');
    }
    return this._flagMap;
  }

  protected get persistance(): PrivatePersistanceMap<BasicAuthParams> {
    return this.flagMap;
  }

  public clear() {
    this.flagMap.clear();
  }

  public setFlag(flag?: string) {
    this.CUR_FLAG = flag || this.DEFAULT_FLAG;
  }

  public async getAuth(flag: string = this.CUR_FLAG): Promise<BasicAuth> {
    const existingAuth = this.flagMap.get(flag);
    if (!existingAuth) {
      vscode.window.showInformationMessage('No existing credentials found, please enter new credentials.');
      await this.getNewCredentials(flag);
      return this.getAuth(flag);
    } else {
      return new BasicAuth(existingAuth);
    }
  }


  public hasAuth(flag: string = this.CUR_FLAG): boolean {
    return this.flagMap.has(flag);
  }

  public setAuth(auth: BasicAuth, flag: string = this.CUR_FLAG) {
    this.flagMap.set(flag, auth.toSavableObject());
  }

  public async getDefaultAuth(): Promise<BasicAuth> {
    return await this.getAuth(this.DEFAULT_FLAG);
  }

  public async toBase64(flag: string = this.CUR_FLAG) {
    const auth = await this.getAuth(flag);
    return auth ? Buffer.from(`${auth.username}:${auth.password}`).toString('base64') : '';
  }

  public async authHeaderValue() {
    return `Basic ${await this.toBase64()}`;
  }

  public async getNewCredentials(flag: string = this.CUR_FLAG) {
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
    this.setAuth(new BasicAuth({ username, password }), flag);
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

