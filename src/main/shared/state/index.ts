import * as vscode from 'vscode';
export default new class {
  #context: vscode.ExtensionContext | null;
  static vars: Map<string, any> = new Map<string, any>();

  constructor() {
    this.#context = null;
  }

  get context(): vscode.ExtensionContext {
    if (this.#context === null) {
      throw new Error('Extension context is not set');
    }
    return this.#context;
  }

  set context(context: vscode.ExtensionContext) {
    if (this.#context !== null) {
      throw new Error('Extension context is already set');
    }
    this.#context = context;
  }
}();