import * as vscode from 'vscode';
import lifeCycle from './lifecycle-control';

/**
 * This method is called when the extension is activated. Triggers once on load.
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
	try {
		lifeCycle.start(context);
	}catch (error) {
		console.trace("Error during activation:", error);
	}
}


/**
 * This method is called when your extension is deactivated
 *
 * THIS MUST EXIST FOR THE EXTENSION TO WORK
 */
export function deactivate() {
	lifeCycle.end();
}
