import * as path from 'path';
import * as vscode from 'vscode';
import type { SourceOps } from '../../../../types';
import { App } from '../App';
import { SESSION_MANAGER as SM } from '../b6p_session/SessionManager';
import { Util } from '../util';
import { DownstairsUriParser } from '../util/data/DownstairsUrIParser';
import { flattenDirectory } from '../util/data/flattenDirectory';
import { getScript } from '../util/data/getScript';
import { ScriptUrlParser } from '../util/data/ScriptUrlParser';
import { Err } from '../util/Err';
import { ScriptFactory } from '../util/script/ScriptFactory';
import { Alert } from '../util/ui/Alert';
import { ProgressHelper } from '../util/ui/ProgressHelper';

/**
 * Pushes a script to a WebDAV location.
 * @param overrideFormulaUri The URI to override the default formula URI.
 * @param sourceOps The options for oveerriding the source location
 * @returns A promise that resolves when the push is complete.
 */
export default async function ({ overrideFormulaUrl, sourceOps, skipMessage, isSnapshot }: { overrideFormulaUrl?: string, sourceOps?: SourceOps, skipMessage?: boolean, isSnapshot?: boolean }): Promise<void> {
  try {
    const sourceEditorUri = await Util.getDownstairsFileUri(sourceOps);
    if (sourceEditorUri === undefined) {
      Alert.error('No source path provided');
      return;
    }
    App.logger.info(Util.printLine({ ret: true }) as string + "Pushing script for: " + sourceEditorUri.toString());
    const targetFormulaOverride = overrideFormulaUrl || await vscode.window.showInputBox({ prompt: 'Paste in the target formula URI' });
    if (targetFormulaOverride === undefined) {
      Alert.error('No target formula URI provided');
      return;
    }
    const sr = ScriptFactory.createScriptRoot(sourceEditorUri);
    const detectedIssues = await sr.preflightCheck();
    if (detectedIssues) {
      Alert.error(detectedIssues);
      return;
    }
    const snList = await sr.getPushableDraftNodes(isSnapshot);

    // Create tasks for progress helper
    const pushTasks = snList.map(sn => ({
      execute: () => sn.upload(targetFormulaOverride),
      description: `scripts`
    }));

    await ProgressHelper.withProgress(pushTasks, {
      title: "Pushing Script...",
      cleanupMessage: "Cleaning up the upstairs draft folder..."
    });

    await cleanupUnusedUpstairsPaths(sr.getRootUri(), targetFormulaOverride, isSnapshot);

    if (!skipMessage) {
      Alert.popup('Push complete!');
    }
  } catch (e) {
    if (!(e instanceof Err.AlreadyAlertedError)) {
      Alert.error(`Error pushing files: ${e}`);
    }
    throw e;
  }
}

/**
 * the objective of this function is to remove upstairs paths that no longer have a downstairs counterpart
 * @param downstairsRootFolderUri 
 * @param upstairsRootUrlString 
 */
async function cleanupUnusedUpstairsPaths(downstairsRootFolderUri?: vscode.Uri, upstairsRootUrlString?: string, isSnapshot: boolean = false): Promise<void> {
  if (!downstairsRootFolderUri || !upstairsRootUrlString) {
    throw new Err.CleanupParametersError();
  }
  const upstairsObj = new ScriptUrlParser(upstairsRootUrlString);
  /**
   * this will give us a list of that are currently present upstairs
   */
  const getScriptRet = await getScript(upstairsObj);
  if (!getScriptRet) {
    throw new Err.CleanupScriptError();
  }
  const rawFilePaths = getScriptRet;
  const directory = ScriptFactory.createFolder(downstairsRootFolderUri);
  const flattenedDownstairs = await flattenDirectory(directory);
  // here's where the clever part comes in. We've just fetched the upstairs paths AFTER we pushed the new stuff.
  // which gives us the definitive list of what is upstairs and also where they should be located downstairs.
  // So we simply use what is downstairs as a "source of truth" and then send a webdav DELETE request for
  // any unmatched brothers.

  const pathsToDelete = new Set<string>();
  for (const rawFilePath of rawFilePaths) {
    // note that the only thing with an undefined trailing should be the root itself
    const curPath = vscode.Uri.joinPath(downstairsRootFolderUri, rawFilePath.trailing || path.sep);
    const downstairsPath = flattenedDownstairs.find(dp => dp.fsPath === curPath.fsPath);
    if (!downstairsPath) {
      // we don't want to delete stuff that is in gitignore
      const parser = new DownstairsUriParser(downstairsRootFolderUri);
      const sf = ScriptFactory.createFile(vscode.Uri.joinPath(parser.prependingPathUri(), rawFilePath.downstairsPath));
      if (await sf.isInGitIgnore()) {
        App.logger.info(`File is in .gitignore; skipping deletion: ${rawFilePath.upstairsPath}`);
        continue;
      }
      if (!isSnapshot && await sf.isInItsRespectiveBuildFolder()) {
        App.logger.info(`File is in build folder; skipping deletion: ${rawFilePath.upstairsPath}`);
        continue;
      } else if (isSnapshot && await sf.isInInfoOrObjects()) {
        App.logger.info(`File is in Info or Objects folder; skipping deletion: ${rawFilePath.upstairsPath}`);
        continue;
      }
      // If there's no matching downstairs path, we need to delete the upstairs path
      App.logger.info(`No matching downstairs path found for upstairs path: ${rawFilePath.upstairsPath}. Deleting upstairs path.`);
      pathsToDelete.add(rawFilePath.upstairsPath);
    }
  }

  if (pathsToDelete.size === 0) {
    App.logger.info("No unused upstairs paths to delete.");
    return;
  }

  const YES_OPTION = "Yes";
  const NO_OPTION = "No";
  const prompt = await Alert.prompt(
    `The following upstairs paths are unused and will be deleted:
    
    ${Array.from(pathsToDelete).join('\n')}
    
    Do you want to proceed?`, 
    [YES_OPTION, NO_OPTION]
  );

  if (prompt !== YES_OPTION) {
    Alert.info("User chose not to delete unused upstairs paths. Consider cleaning up manually.");
    return;
  }

  for (const upstairsPath of pathsToDelete) {
    App.logger.info("Deleting unused upstairs path:" + upstairsPath);
    SM.fetch(upstairsPath, {
      method: "DELETE"
    });
  }
}


