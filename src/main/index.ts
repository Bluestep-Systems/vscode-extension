import * as vscode from 'vscode';
import { attachCommands } from './lifecycle/init';
import { detachCommands } from './lifecycle/destroy';
import { State } from './shared';


/**
 * This method is called when the extension is activated. Triggers once on load.
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
	State.setContext(context);
	attachCommands(context);

}


/**
 * This method is called when your extension is deactivated
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 */
export function deactivate() { 
	detachCommands();
}
