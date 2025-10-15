import { DownstairsUriParser } from "../util/data/DownstairsUrIParser";
import * as vscode from 'vscode';
import * as path from 'path';
export default async function () {
  const TEST_URI = "/home/brendan/test/extensiontest/U131364/Typedoc Check/draft/static/index.html";
  const parser = new DownstairsUriParser(vscode.Uri.parse(TEST_URI));
  path.relative("/home/brendan/test/extensiontest/U131364/Typedoc Check/draft/static/index.html","/home/brendan/test/extensiontest/U131364/Typedoc Check/draft/static/test2/thing");
  console.log(parser);
  debugger;
  
}