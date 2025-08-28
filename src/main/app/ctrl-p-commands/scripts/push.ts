import * as vscode from 'vscode';
import { AuthManager, AuthType, BasicAuthManager } from '../../services/Auth';
import { Util } from '../../util';
import { Alert } from '../../util/ui/Alert';
import * as path from 'path';
import { urlParser } from '../../util/data/URLParser';
import { App } from '../../App';
/**
 * TODO
 */
export default async function (overrideFormulaUri?: string): Promise<void> {
  try {
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    if (activeEditorUri === undefined) {
      Alert.error('No source path provided');
      return;
    }
    console.log(Util.printLine({ ret: true }), "Active Editor URI:", activeEditorUri.toString());
    const targetFormulaUri = overrideFormulaUri || await vscode.window.showInputBox({ prompt: 'Paste in the target formula URI' });
    if (targetFormulaUri === undefined) {
      Alert.error('No target formula URI provided');
      return;
    }
    const matcher = activeEditorUri.toString().match(/(.*\/\d+)\//);
    const sourceFolder = matcher ? matcher[1] : null;
    if (sourceFolder === null) {
      Alert.error('target URI not valid');
      return;
    }
    App.logger.info("sourceFolder", sourceFolder);
    const sourceFolderUri = sourceFolder.substring('file://'.length);
    if (!sourceFolder) {
      Alert.error('No source folder found');
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
    Alert.info('Push complete!');
  } catch (e) {
    Alert.error(`Error pushing files: ${e}`);
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
  if (localFile.includes(`${path.sep}declarations${path.sep}`)) {
    console.log("skipping declarations file");
    return;
  }
  const { webDavId, url } = urlParser(targetFormulaUri);
  const desto = localFile
    .split(url.host + path.sep + webDavId)[1]!
    .replaceAll(path.sep, "/");
  url.pathname = `/files/${webDavId}${desto}`;
  App.logger.info("Destination:", url.toString());

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
  return resp;
}
