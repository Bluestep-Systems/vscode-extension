import * as vscode from "vscode";
export namespace Reporting {
  export function external(ops: { message: string, type: Types, target: Target }) {
    vscode.window.showInformationMessage(ops.message);
    // we want to have the option of notifying external people for whatever reasons.

    // this is intended to tie into the update process on BlueHQ, at minimum
  }
  export enum Types {
    Info,
    Warning,
    Error
  }
  export enum Target {
    BST,
    Corporate,
    Faciliq,
    QVR,
    LDS
  }
}