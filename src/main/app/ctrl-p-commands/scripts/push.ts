import * as vscode from 'vscode';
import { App } from '../../App';
import { SESSION_MANAGER } from '../../b6p_session/SessionManager';
import { Util } from '../../util';
import { parseUrl } from '../../util/data/URLParser';
import { Alert } from '../../util/ui/Alert';
import * as path from 'path';
import type { SourceOps } from '../../../../../types';
/**
 * Pushes a file to a WebDAV location.
 * @param overrideFormulaUri The URI to override the default formula URI.
 * @param sourceOps The source operations to perform.
 * @returns A promise that resolves when the push is complete.
 */
export default async function (overrideFormulaUri?: string, sourceOps?: SourceOps): Promise<void> {
  try {
    const sourceEditorUri = await getLocalFileUri(sourceOps);
    if (sourceEditorUri === undefined) {
      Alert.error('No source path provided');
      return;
    }
    App.logger.info(Util.printLine({ ret: true }) as string, "Active Editor URI:", sourceEditorUri.toString());
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
    const sourceFolderUri = vscode.Uri.file(uriStringToFilePath(sourceFolder));
    const readDir = sourceFolderUri;
    App.logger.info("Reading directory:", readDir.toString());
    const fileList = await vscode.workspace.fs
      .readDirectory(readDir)
      .then(async node => await tunnelNode(node, { nodeURI: uriStringToFilePath(sourceFolder) }));

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
      await sendFile({ localFile: file, targetFormulaUri });
    }
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
      const nestedNode = await vscode.workspace.fs.readDirectory(vscode.Uri.file(newNodeUri));
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
async function sendFile({ localFile, targetFormulaUri }: { localFile: string; targetFormulaUri: string; }) {
  if (localFile.includes(`/declarations/`)) {
    // we skip declarations -- since they are readonly and not part of the actual script
    return;
  }
  App.logger.info("Preparing to send file:", localFile);
  App.logger.info("To target formula URI:", targetFormulaUri);
  const { webDavId, url } = parseUrl(targetFormulaUri);
  const desto = localFile
    .split(url.host + "/" + webDavId)[1];
  url.pathname = `/files/${webDavId}${desto}`;
  App.logger.info("Destination:", url.toString());

  //TODO investigate if this can be done via streaming
  const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(localFile));
  const resp = await SESSION_MANAGER.fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: fileContents
  });
  if (!resp.ok) {
    const details = `
========
========
status: ${resp.status}
statusText: ${resp.statusText}
========
========
text: ${await resp.text()}
========
========`;
    throw new Error('Failed to send file' + details);
  }
  App.logger.info("File sent successfully:", localFile);
  return resp;
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
 * Gets the URI for the current file based on the provided source operations.
 * @param sourceOps The source operations to use for determining the URI.
 * @returns The URI of the current file.
 */
async function getLocalFileUri(sourceOps?: SourceOps): Promise<vscode.Uri> {
  if (!sourceOps) {
    return vscode.window.activeTextEditor?.document.uri || (() => { throw new Error("No active editor found"); })();
  }
  const { sourceOrigin, topId } = sourceOps;
  const url = new URL(sourceOrigin);
  let found = false;
  const curWorkspaceFolder = vscode.workspace.workspaceFolders![0]!;
  const wsDir = await vscode.workspace.fs.readDirectory(curWorkspaceFolder.uri);

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

/**
 * A utility class for dealing with IDs in the format `363769__FID_dummyTestEndpoint`.
 */
class IdUtility {

  /**
   * The class ID extracted from the ID string.
   */
  classId: string;

  /**
   * The alt ID value extracted from the ID string.
   */
  altIdValue: string;

  /**
   * The alt ID key extracted from the ID string. Typically it is "FID" or "PID".
   */
  altIdKey?: string;

  /**
   * constructs this utility class
   * @param id The ID string to extract information from.
   */
  constructor(id: string) {
    // write a regex that takes id in the following patterh `363769__FID_dummyTestEndpoint` and extracts a regex
    const match = id.match(/^(\d+)__(\w*)_(.+)$/);
    if (match) {
      this.classId = match[1];
      this.altIdKey = match[2];
      this.altIdValue = match[3];
    } else {
      throw new Error("Invalid ID format: expected something like `363769__FID_dummyTestEndpoint` but got: `" + id + "`");
    }
  }

  /**
   * Converts the ID to a format that can be searched for in a file.
   * @returns The searchable string representation of the ID.
   */
  private toSearchableString() {
    return `${this.altIdKey}=${this.altIdValue}`;
  }

  /**
   * uses the vscode api to determine if the file contains the id
   * @param uri 
   * @returns 
   */
  private async isContainedIn(uri: vscode.Uri): Promise<boolean> {
    const fileContent = await vscode.workspace.fs.readFile(uri);
    const textContent = new TextDecoder().decode(fileContent);
    if (textContent.includes(this.toSearchableString())) {
      return true;
    }
    return false;
  }

  /**
   * Finds a metadata file containing the specified ID.
   * @param nodes The directory listing to search.
   * @param folderUri The URI of the folder to search within.
   * @param id The ID to search for.
   * @returns The URI of the file containing the ID, or null if not found.
   */
  async findFileContaining(folderUri: vscode.Uri): Promise<vscode.Uri | null> {
    const nodes = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [name, type] of nodes) {
      if (type === vscode.FileType.Directory) {
        const nestedFolderUri = vscode.Uri.file(path.join(folderUri.fsPath, name));

        try {
          const files = await vscode.workspace.findFiles(new vscode.RelativePattern(nestedFolderUri, '**/metadata.json'));
          for (const file of files) {
            const isContained = await this.isContainedIn(file);
            if (isContained) {
              return file;
            }
          }
        } catch (error) {
          Alert.warning(`Error reading directory ${nestedFolderUri.fsPath}: ${error}`);
        }
      }
    }
    return null;
  }
}


