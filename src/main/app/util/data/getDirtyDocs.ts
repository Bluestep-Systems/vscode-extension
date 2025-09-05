import * as vscode from 'vscode';

/**
 * Recursively retrieves all dirty documents within a given directory.
 * @param directoryUri The URI of the directory to search.
 * @returns An array of dirty text documents within the directory.
 */
export async function getDirtyDocs(directoryUri: vscode.Uri): Promise<vscode.TextDocument[]> {
  const activeEditorDocuments = vscode.window.visibleTextEditors.map(editor => editor.document);
  const dirtyDocs: vscode.TextDocument[] = [];
  const directory = await vscode.workspace.fs.readDirectory(directoryUri);
  for (const [name, type] of directory) {
    if (type === vscode.FileType.Directory) {
      const subDir = vscode.Uri.joinPath(directoryUri, name);
      dirtyDocs.push(...await getDirtyDocs(subDir));
    } else if (type === vscode.FileType.File) {
      const fileUri = vscode.Uri.joinPath(directoryUri, name);
      const dirtyDoc = activeEditorDocuments.find(doc => doc.uri.toString() === fileUri.toString() && doc.isDirty);
      if (dirtyDoc) {
        dirtyDocs.push(dirtyDoc);
      }
    }
  }
  return dirtyDocs;
}
