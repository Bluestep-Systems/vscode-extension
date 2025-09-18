import * as vscode from 'vscode';
import { App } from '../../app/App';


export default function (context: vscode.ExtensionContext) {

  try {
    
    App.init(context);
    App.logger.info("B6P: App initialized");
    

    
    //we don't know if this is a string, an error wrapper or whatever
    // so sadly `any` is the only appropriate catch type
  } catch (error) {
    vscode.window.showErrorMessage('Failed to initialize extension: ' + (error instanceof Error ? error.stack : error), { modal: true });

    // rethrow until we know for sure we don't need to.
    throw error;
  }
}

