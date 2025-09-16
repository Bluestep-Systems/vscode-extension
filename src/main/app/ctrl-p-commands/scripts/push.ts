import * as path from 'path';
import * as vscode from 'vscode';
import type { SourceOps } from '../../../../../types';
import { App } from '../../App';
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { Util } from '../../util';
import { flattenDirectory } from '../../util/data/flattenDirectory';
import { getScript } from '../../util/data/getScript';
import { IdUtility } from '../../util/data/IdUtility';
import { parseUpstairsUrl } from '../../util/data/URLParser';
import { FileSystem } from '../../util/fs/FileSystemFactory';
import { RemoteScriptFile } from '../../util/script/RemoteScriptFile';
import { Alert } from '../../util/ui/Alert';
import { ProgressHelper } from '../../util/ui/ProgressHelper';
const fs = FileSystem.getInstance;
/**
 * Pushes a script to a WebDAV location.
 * @param overrideFormulaUri The URI to override the default formula URI.
 * @param sourceOps The source operations to perform.
 * @returns A promise that resolves when the push is complete.
 */
export default async function (overrideFormulaUri?: string, sourceOps?: SourceOps): Promise<void> {
  try {
    const sourceEditorUri = await getDownstairsFileUri(sourceOps);
    if (sourceEditorUri === undefined) {
      Alert.error('No source path provided');
      return;
    }
    App.logger.info(Util.printLine({ ret: true }) as string + "Pushing script for: " + sourceEditorUri.toString());
    const targetFormulaUri = overrideFormulaUri || await vscode.window.showInputBox({ prompt: 'Paste in the target formula URI' });
    if (targetFormulaUri === undefined) {
      Alert.error('No target formula URI provided');
      return;
    }
    const matcher = sourceEditorUri.toString().match(/(.*\/\d+)\//);
    const sourceFolder = matcher ? matcher[1] : null;
    if (sourceFolder === null) {
      Alert.error('target URI not valid');
      return;
    }
    App.logger.info("sourceFolder", sourceFolder);
    if (!sourceFolder) {
      Alert.error('No source folder found');
      return;
    }
    App.logger.info("Source folder URI:", sourceFolder);
    const downstairsRootFolderUri = vscode.Uri.file(uriStringToFilePath(sourceFolder));
    App.logger.info("Reading directory:", downstairsRootFolderUri.toString());
    const fileList = await fs()
      .readDirectory(downstairsRootFolderUri)
      .then(async node => await tunnelNode(node, { nodeURI: uriStringToFilePath(sourceFolder) }));

    // Create tasks for progress helper
    const pushTasks = fileList.map(file => ({
      execute: () => sendFile({ localFile: file, upstairsRootUrlString: targetFormulaUri }),
      description: `scripts`
    }));

    await ProgressHelper.withProgress(pushTasks, {
      title: "Pushing Script...",
      cleanupMessage: "Cleaning up the upstairs draft folder..."
    });

    cleanupUnusedUpstairsPaths(downstairsRootFolderUri, targetFormulaUri);

    if (!sourceOps?.skipMessage) {
      Alert.info('Push complete!');
    }
  } catch (e) {
    Alert.error(`Error pushing files: ${e}`);
    throw e;
  }
}
/**
 * //TODO
 * @param node 
 * @param param1 
 * @returns 
 */
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
      const nestedNode = await fs().readDirectory(vscode.Uri.file(newNodeUri));
      await tunnelNode(nestedNode, { pathList, nodeURI: newNodeUri });
    } else {
      pathList.push(newNodeUri);
    }
  }));
  return pathList;
}

/**
 * Sends a specific file to a WebDAV location.
 * @param param0 The parameters for sending the file.
 * @returns A promise that resolves when the file has been sent.
 */
async function sendFile({ localFile, upstairsRootUrlString }: { localFile: string; upstairsRootUrlString: string; }) {

  App.logger.info("Preparing to send file:", localFile);
  App.logger.info("To target formula URI:", upstairsRootUrlString);
  const { webDavId, url: upstairsUrl } = parseUpstairsUrl(upstairsRootUrlString);
  const downstairsUri = vscode.Uri.file(localFile);
  const scriptFile = new RemoteScriptFile({ downstairsUri });



  const desto = localFile
    .split(upstairsUrl.host + "/" + webDavId)[1];
  if (typeof desto === 'undefined') {
    throw new Error('Failed to determine destination path for file: ' + localFile);
  }
  upstairsUrl.pathname = `/files/${webDavId}${desto}`;
  const reason = await scriptFile.getReasonToNotPush({ upstairsOverride: upstairsUrl });
  if (reason) {
    App.logger.info(`${reason}; skipping file:`, localFile);
    return;
  }
  App.logger.info("Destination:", upstairsUrl.toString());

  
  //TODO investigate if this can be done via streaming
  const fileContents = await fs().readFile(downstairsUri);
  const resp = await SM.fetch(upstairsUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: fileContents
  });
  if (!resp.ok) {
    const details = await getDetails(resp);
    throw new Error('Failed to send file' + details);
  }
  await scriptFile.getScriptRoot().touchFile(scriptFile, "lastPushed");
  App.logger.info("File sent successfully:", localFile);
  return resp;


}

async function getDetails(resp: Response) {
  return `
========
========
status: ${resp.status}
statusText: ${resp.statusText}
========
========
text: ${await resp.text()}
========
========`;
}

/**
 * Converts a URI string to a file path.
 * @param uriString The URI string to convert.
 * @returns The corresponding file path.
 */
function uriStringToFilePath(uriString: string): string {
  // Remove the file:// protocol prefix if present
  let path = uriString.replace(/^file:\/\/\/?/, '');

  // URL decode the string to handle encoded characters like %3A
  path = decodeURIComponent(path);

  return path;
}

/**
 * the objective of this function is to remove upstairs paths that no longer have a downstairs counterpart
 * @param downstairsRootFolderUri 
 * @param upstairsRootUrlString 
 */
async function cleanupUnusedUpstairsPaths(downstairsRootFolderUri?: vscode.Uri, upstairsRootUrlString?: string) {
  if (!downstairsRootFolderUri || !upstairsRootUrlString) {
    throw new Error("Both downstairsRootFolderUri and upstairsRootUrlString are required for cleanup");
  }
  const upstairsObj = parseUpstairsUrl(upstairsRootUrlString);
  /**
   * this will give us a list of that are currently present upstairs
   */
  const getScriptRet = await getScript({ url: upstairsObj.url, webDavId: upstairsObj.webDavId });
  if (!getScriptRet) {
    throw new Error("Failed to get script for cleanup");
  }
  const rawFilePaths = getScriptRet;

  const flattenedDownstairs = await flattenDirectory(downstairsRootFolderUri);
  // here's where the clever part comes in. We've just fetched the upstairs paths AFTER we pushed the new stuff.
  // which gives us the definitive list of what is upstairs and also where they should be located downstairs.
  // So we simply use what is downstairs as a "source of truth" and then send a webdav DELETE request for
  // any unmatched brothers.

  for (const rawFilePath of rawFilePaths) {
    // note that the only thing with an undefined trailing should be the root itself
    const curPath = vscode.Uri.joinPath(downstairsRootFolderUri, rawFilePath.trailing || path.sep);
    const downstairsPath = flattenedDownstairs.find(dp => dp.fsPath === curPath.fsPath);
    if (!downstairsPath) {
      // we don't want to delete stuff that is in gitignore
      const sf = new RemoteScriptFile({ downstairsUri: vscode.Uri.file(rawFilePath.downstairsPath) });
      if (await sf.isInGitIgnore()) {
        App.logger.info(`File is in .gitignore; skipping deletion: ${rawFilePath.upstairsPath}`);
        continue;
      }
      // If there's no matching downstairs path, we need to delete the upstairs path
      await SM.fetch(rawFilePath.upstairsPath, {
        method: "DELETE"
      });
    }
  }
}


/**
 * Gets the URI for the current file based on the provided source operations.
 * @param sourceOps The source operations to use for determining the URI.
 * @returns The URI of the current file.
 */
async function getDownstairsFileUri(sourceOps?: SourceOps): Promise<vscode.Uri> {
  if (!sourceOps) {
    return vscode.window.activeTextEditor?.document.uri || (() => { throw new Error("No active editor found"); })();
  }
  const { sourceOrigin, topId } = sourceOps;
  const url = new URL(sourceOrigin);
  let found = false;
  const curWorkspaceFolder = vscode.workspace.workspaceFolders![0]!;
  const wsDir = await fs().readDirectory(curWorkspaceFolder.uri);

  const folderUri = wsDir.reduce(
    (curValue, [subFolderName, _fileType]) => {
      const subFolderPath = path.join(curWorkspaceFolder.uri.fsPath, subFolderName);
      if (subFolderPath.includes(url.host)) {
        if (found) {
          throw new Error("Multiple folders found for source origin");
        }
        found = true;
        return vscode.Uri.file(subFolderPath);
      }
      return curValue;
    },
    undefined as vscode.Uri | undefined
  );
  if (!folderUri) {
    throw new Error("No folder found for source origin");
  }
  const id = new IdUtility(topId);

  const ret = await id.findFileContaining(folderUri);
  if (!ret) {
    throw new Error("No matching file found");
  }
  return ret;
}


