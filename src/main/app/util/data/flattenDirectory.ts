import * as vscode from 'vscode';
import { RemoteScriptFolder } from '../script/RemoteScriptFolder';

export async function flattenDirectory(dir: RemoteScriptFolder): Promise<vscode.Uri[]> {
  const result: vscode.Uri[] = [];
  const items = await vscode.workspace.fs.readDirectory(dir.getUri());

  result.push(vscode.Uri.joinPath(dir.getUri(), '/')); // include the directory itself
  for (const [name, type] of items) {
    const fullPath = vscode.Uri.joinPath(dir.getUri(), name);
    if (type === vscode.FileType.Directory) {
      result.push(...(await flattenDirectory(new RemoteScriptFolder(fullPath))));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}
