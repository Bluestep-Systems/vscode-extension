import * as vscode from 'vscode';
import lifeCycle from './lifecycle';
import { State } from './shared';


/**
 * This method is called when the extension is activated. Triggers once on load.
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
	lifeCycle.start(context);
	State.setContext(context);
}


/**
 * This method is called when your extension is deactivated
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 */
export function deactivate() {
	lifeCycle.end();
}
