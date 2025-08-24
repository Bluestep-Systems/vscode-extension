import * as vscode from 'vscode';
import { State } from "../../App";
import { AuthManager, AuthType, BasicAuth, BasicAuthManager } from '../../util/Auth';
/**
 * TODO
 */
export default async function (): Promise<void> {
  const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
  if (activeEditorUri === undefined) {
    vscode.window.showErrorMessage('No source path provided');
    return;
  }
  console.log("Active Editor URI:", activeEditorUri.toString());
  const targetFormulaUri = await vscode.window.showInputBox({ prompt: 'Paste in the target formula URI' });
  if (targetFormulaUri === undefined) {
    vscode.window.showErrorMessage('No target URI provided');
    return;
  }
  const matcher = activeEditorUri.toString().match(/(.*\/\d+)\//);
  const sourceFolder = matcher ? matcher[1] : null;
  if (sourceFolder === null) {
    vscode.window.showErrorMessage('target URI not valid');
    return;
  }
  console.log("sourceFolder", sourceFolder);
  const sourceFolderUri = sourceFolder.substring('file://'.length);
  const sfs = sourceFolder.split("/");
  const sourceId = sfs.pop()!;
  const sourceHost = sfs.pop()!;
  if (!sourceFolder) {
    vscode.window.showErrorMessage('No source folder found');
    return;
  }
  const fileList = await vscode.workspace.fs
    .readDirectory(vscode.Uri.file(sourceFolderUri))
    .then(async node => await tunnelNode(node, { nodeURI: sourceFolderUri }));

  for (const file of fileList) {
    sendFile({ file, sourceId, host: sourceHost, targetFormulaUri, creds: BasicAuthManager.getSingleton() });
  }
}
async function tunnelNode(node: [string, vscode.FileType][], {
  nodeURI,
  pathList = []
}: {
  nodeURI: string;
  pathList?: string[]
}) {
  await Promise.all(node.map(async ([name, type]) => {
    const newNodeUri = nodeURI + "/" + name;
    if (type === vscode.FileType.Directory) {
      const nestedNode = await vscode.workspace.fs.readDirectory(vscode.Uri.file(newNodeUri));
      await tunnelNode(nestedNode, { pathList, nodeURI: newNodeUri });
    } else {
      pathList.push(newNodeUri);
    }
  }));
  return pathList;
}

async function sendFile({ file: localFile, targetFormulaUri, sourceId, host: sourceHost, creds }: { file: string; targetFormulaUri: string; sourceId: string; host: string; creds: AuthManager<AuthType>; }) {

  const targetUrl = new URL(targetFormulaUri.split("/draft/")[0]);
  const desto = localFile.split(sourceHost + "/" + sourceId)[1]!;
  targetUrl.pathname += desto;
  console.log("Destination:", targetUrl.toString());
  const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(localFile));
  const resp = await fetch(targetUrl.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `${await creds.authHeaderValue()}`
    },
    body: fileContents
  });
  if (!resp.ok) {
    throw new Error('Failed to send file');
  }
  console.log(resp);
}
