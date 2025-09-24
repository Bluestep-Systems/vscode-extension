import * as vscode from 'vscode';
export abstract class PathElement {
  static TS_CONFIG_JSON = "tsconfig.json";
  abstract fsPath(): string;
  abstract getUri(): vscode.Uri;
  abstract equals(other: this): boolean;
}

