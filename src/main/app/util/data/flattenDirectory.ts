import * as vscode from 'vscode';

export async function flattenDirectory(dir: vscode.Uri): Promise<vscode.Uri[]> {
  const result: vscode.Uri[] = [];
  const items = await vscode.workspace.fs.readDirectory(dir);
  
  result.push(vscode.Uri.joinPath(dir, '/')); // include the directory itself
  for (const [name, type] of items) {
    const fullPath = vscode.Uri.joinPath(dir, name);
    if (type === vscode.FileType.Directory) {
      result.push(...(await flattenDirectory(fullPath)));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}
