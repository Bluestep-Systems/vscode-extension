import * as vscode from 'vscode';
import { AuthManager, AuthType, BasicAuthManager } from '../../services/Auth';
import { Util } from '../../util';
import { urlParser } from '../../util/data/URLParser';
/**
 * TODO
 */
export default async function (overrideFormulaUri?: string): Promise<void> {
  const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
  if (activeEditorUri === undefined) {
    vscode.window.showErrorMessage('No source path provided');
    return;
  }
  console.log(Util.printLine({ ret: true }), "Active Editor URI:", activeEditorUri.toString());
  const targetFormulaUri = overrideFormulaUri || await vscode.window.showInputBox({ prompt: 'Paste in the target formula URI' });
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
  if (!sourceFolder) {
    vscode.window.showErrorMessage('No source folder found');
    return;
  }
  const fileList = await vscode.workspace.fs
    .readDirectory(vscode.Uri.file(sourceFolderUri))
    .then(async node => await tunnelNode(node, { nodeURI: sourceFolderUri }));

  for (const file of fileList) {
    /**
     * NOTE:
     * 
     * we want to `await` each one here so that they run sequentially, and not in parallel.
     *
     * This
     * (1) prevents us from overloading the server with the plurality of requests
     * (2) prevents duplicate folders from being created by the webdav PUT method.
     */
    await sendFile({ localFile: file, targetFormulaUri, creds: BasicAuthManager.getSingleton() });
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
async function sendFile({ localFile, targetFormulaUri, creds }: { localFile: string; targetFormulaUri: string; creds: AuthManager<AuthType>; }) {
  if (localFile.includes("/declarations/")) {
    console.log("skipping a declarations file");
    return;
  }
  const { webDavId, url } = urlParser(targetFormulaUri);
  const desto = localFile.split(url.host + "/" + webDavId)[1]!;
  url.pathname = `/files/${webDavId}/${desto}`;
  console.log("Destination:", url.toString());

  //TODO investigate if this can be done via streaming
  const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(localFile));
  const resp = await fetch(url.toString(), {
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
