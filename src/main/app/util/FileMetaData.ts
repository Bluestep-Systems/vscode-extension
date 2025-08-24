import * as vscode from 'vscode';
import * as path from 'path';

//file:///home/brendan/test/extensiontest/bst3.bluestep.net/1433413/draft/scripts/app.ts
//file:///home/brendan/test/extensiontest

export async function getFileMetaData({ workspaceUri, curUri }: { workspaceUri: vscode.Uri, curUri: vscode.Uri }) {
  const curUriString = curUri.toString();
  console.log("workspaceUri:", workspaceUri);
  const shavedName = curUriString.substring(`file://`.length, curUriString.indexOf("/draft/"));
  
  //TODO convert this to use a metadata file and read from it instead
  
  const scriptPath = path.parse(shavedName); // the webdav id (for now)
  const parentDir = path.dirname(shavedName);
  const parentDirName = path.basename(parentDir); // the domain (for now);

  return {
    webdavId: scriptPath.base,
    domain: parentDirName
  };
}

function getInfoFromPath(path: string) {
  const pathArr = path.split("/");
  const webdavId = pathArr.pop();
  const domain = pathArr.pop();
  return {
    webdavId,
    domain
  };
}