import * as vscode from 'vscode';
import type { UserCredentials } from '../../../../types/b6p-vscode-extension';
export interface UserManager {
  creds: Thenable<UserCredentials>;
}
export const UserManager = new class implements UserManager {
  #credentials: UserCredentials | null;

  constructor() {
    this.#credentials = null;
  }

  get creds(): Thenable<UserCredentials> {
    if (this.#credentials === null) {
      return this.#newCredentials();
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
      username: string;
      password: string;
      constructor(username?: string, password?: string) {
        this.username = username || '';
        this.password = password || '';
      }
      newUsername(value: string) {
        this.username = value;
        return this;
      }
      newPassword(value: string) {
        this.password = value;
        return this;
      }
      get toBase64() {
        return Buffer.from(`${this.username}:${this.password}`).toString('base64');
      }
    }(username, password);

    return this.#credentials;
  }

}();
