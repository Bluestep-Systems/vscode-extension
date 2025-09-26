import * as vscode from 'vscode';
import { Err } from '../Err';

/**
 * Gets the host folder URI from the provided URL.
 *
 * eventually we will want this to be doing a lookup to find the U's folder
 * @param url
 * @returns
 */
export function getHostFolderUri(url: URL): vscode.Uri {
  const activeFolder = vscode.workspace.workspaceFolders?.[0];
  if (!activeFolder) {
    vscode.window.showErrorMessage('No active file found');
    throw new Err.NoActiveFileError();
  }
  const activeFolderUri = activeFolder.uri;
  // this will be replaced with the U rather than the url host.
  const hostFolder = vscode.Uri.joinPath(activeFolderUri, url.host);
  return hostFolder;
}
