import * as vscode from 'vscode';
import { State } from '../../app';

export default function (context: vscode.ExtensionContext) {
  State.initializeFromContext(context);
}

