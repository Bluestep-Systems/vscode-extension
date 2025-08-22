import * as vscode from 'vscode';
import { State } from "./StateManager";
import { SavableMap } from "./SavableMap";
class UserManager {
  #credentials: UserCredentials | null;
  static #_singleton = new UserManager();

  private constructor() {
    this.#credentials = null;
  }
  async saveCreds() {
    if (this.#credentials) {
      // Save the credentials to the context or a secure location
      State.privates.set('user.credentials', this.#credentials.store.toSavableObject());
      await State.saveState();
    }
  }

  static getInstance(): UserManager {
    return this.#_singleton;
  }

  get creds(): Thenable<UserCredentials> {
    if (this.#credentials === null) {
      const userCreds = new SavableMap<{ username: string; password: string }>(State.privates.get('user.credentials')).get('default');
      this.#credentials = new UserCredentials(userCreds?.username, userCreds?.password);
      if (this.#credentials === null) {
        return this.#newCredentials();
      }
    }
    return Promise.resolve(this.#credentials);
  }

  async #newCredentials(): Promise<UserCredentials> {
    // Implement your logic to get new credentials here
    const username = await vscode.window.showInputBox({ prompt: 'Enter your username' })
      .then(resp => {
        // username validation?
        return resp;
      });
    const password = await vscode.window.showInputBox({ prompt: 'Enter your password', password: true })
      .then(resp => {
        // password validation?
        return resp;
      });
    this.#credentials = new class implements UserCredentials {
      store = new SavableMap<{ username: string; password: string }>();
      constructor(username?: string, password?: string) {
        this.store.set('default', { username: username || '', password: password || '' });
      }
      get toBase64() {
        const { username, password } = this.store.get('default') || {};
        return Buffer.from(`${username}:${password}`).toString('base64');
      }
      authHeaderValue() {
        return `Basic ${this.toBase64}`;
      }
    }(username, password);
    this.saveCreds();
    return this.#credentials;
  }

};
export class UserCredentials {
  store: SavableMap<{ username: string; password: string }>;

  constructor(username?: string, password?: string) {
    this.store = new SavableMap<{ username: string; password: string }>();
    this.store.set('default', { username: username || '', password: password || '' });
  }
  get toBase64(): string {
    const { username, password } = this.store.get('default') || {};
    return Buffer.from(`${username}:${password}`).toString('base64');
  }
  authHeaderValue(): string {
    return `Basic ${this.toBase64}`;
  }
}
export const User = UserManager.getInstance();