import * as vscode from "vscode";
import { BasicAuthParams, SavableObject } from "../../../../types";
import { ContextNode } from "../services/ContextNode";

/**
   * Generic Auth class that can be extended for specific auth types.
   */
export abstract class AuthObject {
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

  abstract update(): Promise<void>;
}

export abstract class AuthManager<T extends AuthObject> extends ContextNode {

  readonly DEFAULT_FLAG = "default";
  public abstract context: vscode.ExtensionContext;
  public abstract determineFlag(): string;

  /**
   * Checks if the auth manager has credentials for the given flag.
   * @param flag 
   */
  public abstract hasAuth(flag: string): boolean;

  /**
   * Sets the auth object for the given flag.
   * @param auth The auth object to set.
   * @param flag The flag to associate with the auth object.
   */
  public abstract setAuthObject(auth: T, flag: string): T;

  /**
   * Gets the auth object for the given flag.
   * @param flag the flag to get the auth object for.
   */
  public abstract getAuthObject(flag: string, createIfNotPresent: boolean): Promise<T>;

  /**
   * alternatively creates new credentials or updates existing ones.
   */
  public abstract createOrUpdate(): Promise<T>;
  public abstract getDefaultAuth(): Promise<T>;

  public abstract createNewCredentials(flag: string): Promise<T>;
}


/**
 * the basic auth class implementation of the auth object
 * 
 */
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

  //#region Overrides
  public toSavableObject() {
    return this.sObj;
  }

  public toJSON() {
    return JSON.stringify({ username: this.sObj.username, password: "***" });
  }

  public async update(): Promise<void> {
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
  //#endregion

  /**
   * @returns the base64 encoded username:password string.
   */
  public toBase64() {
    return Buffer.from(`${this.sObj.username}:${this.sObj.password}`).toString('base64');
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}