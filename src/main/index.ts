import * as vscode from 'vscode';
import start from './lifecycle/start';
import end from './lifecycle/end';

/**
 * This method is called when the extension is activated. Triggers once on load.
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
	try {
		start(context);
	} catch (error) {
		console.trace(error);
	}
}


/**
 * This method is called when your extension is deactivated
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 */
export function deactivate() {
	end();
}
