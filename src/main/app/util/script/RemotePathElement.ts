import * as vscode from 'vscode';
export abstract class RemotePathElement {
  abstract fsPath(): string;
  abstract getUri(): vscode.Uri;
  abstract equals(other: RemotePathElement): boolean;
}

