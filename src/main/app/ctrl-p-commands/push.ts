import * as path from 'path';
import * as vscode from 'vscode';
import type { SourceOps } from '../../../../types';
import { App } from '../App';
import { SESSION_MANAGER as SM } from '../b6p_session/SessionManager';
import { Util } from '../util';
import { DownstairsUriParser } from '../util/data/DownstairsUrIParser';
import { flattenDirectory } from '../util/data/flattenDirectory';
import { getScript } from '../util/data/getScript';
import { UpstairsUrlParser } from '../util/data/UpstairsUrlParser';
import { Err } from '../util/Err';
import { ScriptFactory } from '../util/script/ScriptFactory';
import { ScriptFile } from '../util/script/ScriptFile';
import { ScriptRoot } from '../util/script/ScriptRoot';
import { Alert } from '../util/ui/Alert';
import { ProgressHelper } from '../util/ui/ProgressHelper';

/**
 * Pushes a script to a WebDAV location.
 * @param overrideFormulaUri The URI to override the default formula URI.
 * @param sourceOps The source operations to perform.
 * @returns A promise that resolves when the push is complete.
 */
export default async function ({ overrideFormulaUri, sourceOps }: { overrideFormulaUri?: string, sourceOps?: SourceOps }): Promise<void> {
  try {
    const sourceEditorUri = await Util.getDownstairsFileUri(sourceOps);
    if (sourceEditorUri === undefined) {
      Alert.error('No source path provided');
      return;
    }
    App.logger.info(Util.printLine({ ret: true }) as string + "Pushing script for: " + sourceEditorUri.toString());
    const targetFormulaOverride = overrideFormulaUri || await vscode.window.showInputBox({ prompt: 'Paste in the target formula URI' });
    if (targetFormulaOverride === undefined) {
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
    const sr = ScriptRoot.fromRootUri(downstairsRootFolderUri);
    await sr.compileDraftFolder();
    const detectedIssues = await sr.preflightCheck();
    if (detectedIssues) {
      Alert.error(detectedIssues);
      return;
    }
    const snList = await sr.getPushableDraftNodes();

    // Create tasks for progress helper
    const pushTasks = snList.map(sn => ({
      execute: () => sn.upload(targetFormulaOverride),
      description: `scripts`
    }));

    await ProgressHelper.withProgress(pushTasks, {
      title: "Pushing Script...",
      cleanupMessage: "Cleaning up the upstairs draft folder..."
    });

    await cleanupUnusedUpstairsPaths(downstairsRootFolderUri, targetFormulaOverride);

    if (!sourceOps?.skipMessage) {
      Alert.info('Push complete!');
    }
  } catch (e) {
    Alert.error(`Error pushing files: ${e}`);
    throw e;
  }
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
    throw new Err.CleanupParametersError();
  }
  const upstairsObj = new UpstairsUrlParser(upstairsRootUrlString);
  /**
   * this will give us a list of that are currently present upstairs
   */
  const getScriptRet = await getScript({ url: upstairsObj.url, webDavId: upstairsObj.webDavId });
  if (!getScriptRet) {
    throw new Err.CleanupScriptError();
  }
  const rawFilePaths = getScriptRet;
  const directory = ScriptFactory.createScriptFolderFromUri(downstairsRootFolderUri);
  const flattenedDownstairs = await flattenDirectory(directory);
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
      const parser = new DownstairsUriParser(downstairsRootFolderUri);
      const sf = new ScriptFile(vscode.Uri.joinPath(parser.prependingPathUri(), rawFilePath.downstairsPath));
      if (await sf.isInGitIgnore()) {
        App.logger.info(`File is in .gitignore; skipping deletion: ${rawFilePath.upstairsPath}`);
        continue;
      }
      // If there's no matching downstairs path, we need to delete the upstairs path
      App.logger.info(`No matching downstairs path found for upstairs path: ${rawFilePath.upstairsPath}. Deleting upstairs path.`);
      await SM.fetch(rawFilePath.upstairsPath, {
        method: "DELETE"
      });
    }
  }
}


