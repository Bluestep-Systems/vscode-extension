import * as vscode from "vscode";
export abstract class Manager {
  abstract parent: Manager | null;
  abstract context: vscode.ExtensionContext;
  /**
   * Initialize the manager with the given context.
   * if already initialized, throws an error.
   * 
   * if the manager has dependencies on other managers, it should also call their initDependencies() methods here.
   * @param context the extension context
   */
  abstract init(contextOrManager: vscode.ExtensionContext | Manager): this;
  abstract initChildren(): void;
  abstract save(): void;
  abstract get logger(): vscode.LogOutputChannel;
}