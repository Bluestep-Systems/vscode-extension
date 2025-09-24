import * as vscode from 'vscode';
export interface PathElement {
  path(): string;
  uri(): vscode.Uri;
  equals(other: this): boolean;
}

