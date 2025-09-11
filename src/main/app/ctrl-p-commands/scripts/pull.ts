import * as vscode from 'vscode';
import { App } from '../../App';
import { flattenDirectory } from '../../util/data/flattenDirectory';
import { getHostFolderUri } from '../../util/data/getHostFolderUri';
import { getScript } from "../../util/data/getScript";
import { parseUpstairsUrl } from "../../util/data/URLParser";
import { RemoteScriptFile } from '../../util/script/RemoteScriptFile';
import { Alert } from '../../util/ui/Alert';
import { ProgressHelper } from '../../util/ui/ProgressHelper';
/**
 * Pulls files from a WebDAV location to the local workspace.
 * @param overrideFormulaUri The URI to override the default formula URI.
 * @returns A promise that resolves when the pull is complete.
 */
export default async function (overrideFormulaUri?: string): Promise<void> {
  try {
    const urlObj = await getStartingURL(overrideFormulaUri);
    if (urlObj === undefined) {
      return;
    }
    const { url, webDavId } = urlObj;
    const fetchedScriptObject = await getScript({ url, webDavId });
    if (fetchedScriptObject === undefined) {
      return;
    }
    const rawFilePaths = fetchedScriptObject.rawFilePaths;
    const ultimateUris: vscode.Uri[] = [];
    
    // Create tasks for progress helper
    const pullTasks = rawFilePaths.map(path => ({
      execute: async () => {
        const createdUri = await createOrUpdateIndividualFileOrFolder(path.downstairsPath, url);
        ultimateUris.push(createdUri);
        return createdUri;
      },
      description: `scripts`
    }));

    await ProgressHelper.withProgress(pullTasks, {
      title: "Pulling Script...",
      cleanupMessage: "Cleaning up the downstairs folder..."
    });

    const flattenedDirectory = await flattenDirectory(vscode.Uri.joinPath(getHostFolderUri(url), webDavId));
    cleanUnusedDownstairsPaths(flattenedDirectory, ultimateUris);

    Alert.info('Pull complete!');
  } catch (e) {
    Alert.error(`Error pulling files: ${e instanceof Error ? e.stack || e.message || e : e}`);
    throw e;
  }
}
/**
 * Cleans up unused paths by deleting them from the filesystem.
 * @param existingPaths 
 * @param validPaths 
 */
function cleanUnusedDownstairsPaths(existingPaths: vscode.Uri[], validPaths: vscode.Uri[]) {
  // find all existing paths that are not in the valid paths list
  const toDelete = existingPaths.filter(ep => {
    //ignore special files
    if (isASpecialFile(ep)) {
      return false;
    }
    // otherwise we only want to find paths that are not on the newest list
    return !validPaths.find(vp => vp.fsPath === ep.fsPath);
  });
  // delete all unused paths
  for (const del of toDelete) {
    console.log("Deleting unused path:", del.fsPath);
    vscode.workspace.fs.delete(del, { recursive: true, useTrash: false });
  }
}
/**
 * determines if a file is a "special" file that should not be deleted during cleanup.
 * @param path 
 * @returns 
 */
function isASpecialFile(path: vscode.Uri) {
  //TODO consider making this configurable
  const specialFiles = ['.git', '.gitignore', '.b6p_metadata.json'];
  return specialFiles.some(sf => path.fsPath.endsWith(sf));
}

/**
 * gets the URL for the pull operation. if we don't get an override URI we ask the user to provide one.
 * @param overrideFormulaUri 
 * @returns 
 */
async function getStartingURL(overrideFormulaUri?: string) {
  const formulaURI = overrideFormulaUri || await vscode.window.showInputBox({ prompt: 'Paste in the desired formula URI' });
  if (formulaURI === undefined) {
    vscode.window.showErrorMessage('No formula URI provided');
    return;
  }
  return parseUpstairsUrl(formulaURI);
}

async function createOrUpdateIndividualFileOrFolder(downstairsRest: string, sourceUrl: URL): Promise<vscode.Uri> {
  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  if (!activeFolder) {
    vscode.window.showErrorMessage('No active file found');
    throw new Error('No active file found');
  }
  const curPath = activeFolder.uri;
  const ultimatePath = vscode.Uri.joinPath(curPath, sourceUrl.host, downstairsRest);

  const isDirectory = ultimatePath.toString().endsWith("/");

  if (isDirectory) {
    let dirExists = false;
    try {
      const stat = await vscode.workspace.fs.stat(ultimatePath);
      dirExists = stat.type === vscode.FileType.Directory;
    } catch (e) {
      // swallow this error. We need to find a better way to determine
      // if the reason for this error is that the directory exists or not, but I couldn't
      // find some analog of `optFolderExists()`
    }
    if (!dirExists) {
      await vscode.workspace.fs.createDirectory(ultimatePath);
    }
  } else {
    const sf = new RemoteScriptFile({ downstairsUri: ultimatePath });
    if (await sf.fileExists() && await sf.integrityMatches()) {
      App.logger.info("File integrity matches; skipping:", ultimatePath.fsPath);
      await sf.getScriptRoot().touchFile(sf, "lastPulled");
      return sf.toDownstairsUri();
    }
    await sf.download();
  }
  return ultimatePath;
}