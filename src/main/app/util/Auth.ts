import * as vscode from 'vscode';
import { PrivateKeys, PrivatePersistanceMap } from "./PseudoMaps";
import { SavableObject } from '../../../../types';

export interface AuthType {
}
type BasicAuthConstructorValue = { username: string; password: string };
export class BasicAuth implements AuthType {
  username: string;
  password: string;
  constructor({ username, password }: BasicAuthConstructorValue) {
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
  toJSON() {
    return JSON.stringify(new BasicAuth({ username: this.username, password: "***" }));
  }
}
export abstract class AuthManager<T extends AuthType> {
  abstract persistanceCollection: PrivatePersistanceMap<SavableObject>;

  constructor() { }
  abstract getAuth(flag?: AUTH_FLAGS): Promise<T>
  abstract setAuth(auth: T, flag?: AUTH_FLAGS): void;
  abstract getDefaultAuth(): Promise<T>
  abstract authHeaderValue(): Promise<string>;
  abstract newCredentials(): Thenable<AuthManager<T>>;
}

export class BasicAuthManager extends AuthManager<BasicAuth> {
  persistanceCollection: PrivatePersistanceMap<SavableObject> = new PrivatePersistanceMap(PrivateKeys.BASIC_AUTH);
  FLAG: AUTH_FLAGS;
  private static singleton: BasicAuthManager | null = null;

  static getSingleton() {
    if (!this.singleton) {
      this.singleton = new BasicAuthManager();
    }
    return this.singleton;
  }
  private constructor() {
    super();
    this.FLAG = AUTH_FLAGS.DEFAULT;
    this.persistanceCollection.touch();
  }

  /**
   * Ensure the singleton is initialized
   */
  static touch(): void {
    BasicAuthManager.getSingleton();
  }

  async getAuth(flag: AUTH_FLAGS = this.FLAG): Promise<BasicAuth> {
    console.log("persistanceColl", this.persistanceCollection);
    const existingAuth = this.persistanceCollection.get(flag);
    console.log("existingAuth", existingAuth);
    if (!existingAuth) {
      vscode.window.showInformationMessage('No existing credentials found, please enter new credentials.');
      return (await this.newCredentials()).getAuth();
    } else {
      return new BasicAuth(existingAuth as unknown as BasicAuthConstructorValue);
    }

  }

  setAuth(auth: BasicAuth, flag: AUTH_FLAGS = this.FLAG) {
    this.persistanceCollection.set(flag, auth.toSavableObject());
    this.save();
  }

  async getDefaultAuth(): Promise<BasicAuth> {
    return await this.getAuth(AUTH_FLAGS.DEFAULT);
  }

  private save() {
    this.persistanceCollection.store();
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
    this.setAuth(new BasicAuth({ username, password }));
    return this;
  }
};

enum AUTH_FLAGS {
  DEFAULT = 'default',
}

