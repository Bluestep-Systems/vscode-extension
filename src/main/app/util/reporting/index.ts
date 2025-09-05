import * as vscode from "vscode";

/**
 * Placeholder for various reporting mechanisms, such as sending notifications to external services,
 * github integration, clickup, etc.
 */
export namespace Reporting {

  /**
   * Sends an external notification.
   * @param ops The options for the external report
   */
  export function external(ops: { message: string, type: Types, target: Target }) {
    vscode.window.showInformationMessage(ops.message);
    // we want to have the option of notifying external people for whatever reasons.
    // this is intended to tie into the update process on BlueHQ, at minimum
  }
  /**
   * The type of notification to send.
   */
  export enum Types {
    Info,
    Warning,
    Error,
    Critical
  }
  /**
   * The target system for the notification.
   */
  export enum Target {
    BST,
    Corporate,
    Faciliq,
    QVR,
    LDS,
    GitHub,
    ClickUp,
    Other
  }
}