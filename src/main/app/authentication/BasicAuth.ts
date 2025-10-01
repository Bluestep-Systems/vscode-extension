import * as vscode from "vscode";
import { BasicAuthParams } from "../../../../types";
import { AuthObject } from "./AuthObject";

/**
 * Basic authentication implementation of the AuthObject.
 * Handles username/password authentication with Base64 encoding support.
 * @lastreviewed null
 */
export class BasicAuth extends AuthObject {
  /**
   * Override the generic type of the parent to indicate that this child object
   * will always have BasicAuthParams shape with username and password properties.
   * @lastreviewed null
   */
  declare sObj: BasicAuthParams;

  /**
   * Constructs a BasicAuth object containing the given username and password.
   * @param credentials Object containing username and password properties
   * @lastreviewed null
   */
  constructor({ username, password }: BasicAuthParams) {
    super({ username, password });
  }

  //#region Overrides
  /**
   * Returns the internal BasicAuthParams object for persistence.
   * @returns The serializable BasicAuthParams object
   * @lastreviewed null
   */
  public toSavableObject() {
    return this.sObj;
  }

  /**
   * Returns a JSON representation with password masked for security.
   * @returns JSON string with username visible and password masked as "***"
   * @lastreviewed null
   */
  public toJSON() {
    return JSON.stringify({ username: this.sObj.username, password: "***" });
  }

  /**
   * Updates the username and/or password by prompting the user.
   * Shows input boxes for new credentials, allowing empty input to keep current values.
   * @returns Promise that resolves when the update is complete
   * @lastreviewed null
   */
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
   * Generates the Base64 encoded username:password string for HTTP Basic Authentication.
   * @returns The Base64 encoded credentials string in the format required by Authorization header
   * @lastreviewed null
   */
  public toBase64() {
    return Buffer.from(`${this.sObj.username}:${this.sObj.password}`).toString('base64');
  }

  /**
   * Creates a new BasicAuth instance by prompting the user for credentials.
   * Shows input boxes for username and password, with password input masked.
   * @returns Promise that resolves to a new BasicAuth instance with user-provided credentials
   * @lastreviewed null
   */
  static async generateNew(): Promise<BasicAuth> {
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
    return new BasicAuth({ username, password });
  }
}
