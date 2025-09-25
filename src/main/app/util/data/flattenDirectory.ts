import * as vscode from 'vscode';
import { Folder } from '../script/Folder';

export async function flattenDirectory(dir: Folder): Promise<vscode.Uri[]> {
  const result: vscode.Uri[] = [];
  const items = await vscode.workspace.fs.readDirectory(dir.uri());

  result.push(vscode.Uri.joinPath(dir.uri(), '/')); // include the directory itself
  for (const [name, type] of items) {
    const fullPath = vscode.Uri.joinPath(dir.uri(), name);
    if (type === vscode.FileType.Directory) {
      result.push(...(await flattenDirectory(new Folder(fullPath))));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}
