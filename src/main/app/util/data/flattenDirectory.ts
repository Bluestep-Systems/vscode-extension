import * as vscode from 'vscode';
import type{ ScriptFolder } from '../script/ScriptFolder';
import { ScriptFactory } from '../script/ScriptFactory';

export async function flattenDirectory(dir: ScriptFolder): Promise<vscode.Uri[]> {
  const result: vscode.Uri[] = [];
  const items = await vscode.workspace.fs.readDirectory(dir.uri());

  result.push(vscode.Uri.joinPath(dir.uri(), '/')); // include the directory itself
  for (const [name, type] of items) {
    const fullPath = vscode.Uri.joinPath(dir.uri(), name);
    if (type === vscode.FileType.Directory) {
      const subFolder = ScriptFactory.createFolder(() => fullPath);
      result.push(...(await flattenDirectory(subFolder)));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}
