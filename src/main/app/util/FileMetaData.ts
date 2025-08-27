import * as vscode from 'vscode';
import * as path from 'path';

//file:///home/brendan/test/extensiontest/bst3.bluestep.net/1433413/draft/scripts/app.ts
//file:///home/brendan/test/extensiontest

export async function getFileMetaData({ curUri }: { curUri: vscode.Uri }) {
  const curUriString = curUri.toString();
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