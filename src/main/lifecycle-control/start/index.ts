import * as vscode from 'vscode';
import { State } from '../../app/util/StateManager';

export default function (context: vscode.ExtensionContext) {
  try {
    console.log("Initializing state...");
    State.initializeFromContext(context);
    //we don't know if this is a string, an error wrapper or whatever
    // so sadly `any` is the only appropriate catch type
  } catch (error: any) {
    console.trace(error);
    vscode.window.showErrorMessage('Failed to initialize extension: ' + (error.stack ? error.stack : ''), { modal: true });

    // rethrow until we know for sure we don't need to.
    throw error;
  }
}

