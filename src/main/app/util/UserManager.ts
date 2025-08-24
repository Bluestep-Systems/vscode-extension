import * as vscode from 'vscode';
import { State } from "./StateManager";
import { PrivateKeys, PrivatePersistanceMap, PseudoMap, PublicPersistanceMap, TransientMap } from "./PersistantMap";
import { SavableObject } from '../../../../types';

export interface AuthType {
}
export class BasicAuth implements AuthType {
  username: string;
  password: string;
  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }
  getUserName(): string {
    return this.username;
  }
  getPassword(): string {
    return this.password;
  }
  toSavableObject() {
    return { username: this.username, password: this.password };
  }
}
export abstract class AuthManager<T extends AuthType> {
  protected curManager: AuthManager<T> | null = null;
  abstract store: PrivatePersistanceMap<SavableObject>;
  
  constructor() { }

  abstract authHeaderValue(): Promise<string>;
  abstract newCredentials(): Thenable<AuthManager<T>>;
}
export class BasicAuthManager extends AuthManager<BasicAuth> {
  authCollection: TransientMap<BasicAuth>;
  store: PrivatePersistanceMap<SavableObject> = new PrivatePersistanceMap(PrivateKeys.BASIC_AUTH);
  FLAG: BASIC_AUTH_FLAGS;
  private static singleton: BasicAuthManager | null = null;

  static getSingleton() {
    if (!this.singleton) {
      this.singleton = new BasicAuthManager();
    }
    return this.singleton;
  }
  private constructor() {
    super();
    this.authCollection = new TransientMap<BasicAuth>();
    this.FLAG = BASIC_AUTH_FLAGS.DEFAULT;
  }
  async getAuth(): Promise<BasicAuth> {
    return this.authCollection.get(this.FLAG) || (await this.newCredentials()).getAuth();
  }
  setAuth(auth: BasicAuth) {
    this.authCollection.set(this.FLAG, auth);
  }
  getAuthByFlag(flag: BASIC_AUTH_FLAGS): BasicAuth | undefined {
    return this.authCollection.get(flag);
  }
  setAuthByFlag(flag: BASIC_AUTH_FLAGS, auth: BasicAuth) {
    this.authCollection.set(flag, auth);
  }

  getDefaultAuth(): BasicAuth {
    return this.getAuthByFlag(BASIC_AUTH_FLAGS.DEFAULT)!;
  }
  async toBase64() {
    const auth = await this.getAuth();
    console.log("Auth Object:", auth);
    return auth ? Buffer.from(`${auth.username}:${auth.password}`).toString('base64') : '';
  }

  async authHeaderValue() {
    return `Basic ${await this.toBase64()}`;
  }

  async newCredentials(): Promise<this> {
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
    this.setAuth(new BasicAuth(username, password));
    return this;
  }
};

enum BASIC_AUTH_FLAGS {
  DEFAULT = 'default',
}

