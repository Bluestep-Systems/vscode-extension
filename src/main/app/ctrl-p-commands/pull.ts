import * as vscode from 'vscode';
import { App } from '../App';
import { flattenDirectory } from '../util/data/flattenDirectory';
import { getHostFolderUri } from '../util/data/getHostFolderUri';
import { getScript } from "../util/data/getScript";
import { UpstairsUrlParser } from "../util/data/UpstairsUrlParser";
import { ScriptNode } from '../util/script/ScriptNode';
import { Alert } from '../util/ui/Alert';
import { ProgressHelper } from '../util/ui/ProgressHelper';
import { ScriptRoot } from '../util/script/ScriptRoot';
import { Err } from '../util/Err';
import { ScriptFolder } from '../util/script/ScriptFolder';
import { ScriptFile } from '../util/script/ScriptFile';
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
    if (fetchedScriptObject === null) {
      return;
    }
    const rawFilePaths = fetchedScriptObject;
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
    const directory = await ScriptFolder.fromUri(vscode.Uri.joinPath(getHostFolderUri(url), webDavId));
    const flattenedDirectory = await flattenDirectory(directory);
    await cleanUnusedDownstairsPaths(flattenedDirectory, ultimateUris);

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
async function cleanUnusedDownstairsPaths(existingPaths: vscode.Uri[], validPaths: vscode.Uri[]) {
  // find all existing paths that are not in the valid paths list
  const toDelete: vscode.Uri[] = [];
  for (const ep of existingPaths) {
    //ignore special files
    if (await new ScriptNode(ep).isInGitIgnore()) {
      continue;
    }
    if ([ScriptRoot.METADATA_FILENAME, ScriptRoot.GITIGNORE_FILENAME].some(special => ep.fsPath.endsWith(special))) {
      continue;
    }
    if (!validPaths.find(vp => vp.fsPath === ep.fsPath)) {
      toDelete.push(ep);
    }
  }
  // delete all unused paths
  for (const del of toDelete) {
    App.logger.warn("Deleting unused path:" +  del.fsPath);
    vscode.workspace.fs.delete(del, { recursive: true, useTrash: false });
  }
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
  return new UpstairsUrlParser(formulaURI);
}

async function createOrUpdateIndividualFileOrFolder(downstairsRest: string, sourceUrl: URL): Promise<vscode.Uri> {
  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  if (!activeFolder) {
    vscode.window.showErrorMessage('No active file found');
    throw new Err.NoActiveFileError();
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
    const sf = new ScriptFile(ultimatePath);
    if (await sf.exists() && await sf.integrityMatches()) {
      App.logger.info("File integrity matches; skipping:", ultimatePath.fsPath);
      await sf.touch("lastPulled");
      return sf.uri();
    }
    await sf.download();
  }
  return ultimatePath;
}