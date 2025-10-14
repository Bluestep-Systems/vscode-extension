import { DownstairsUriParser } from "../util/data/DownstairsUrIParser";
import * as vscode from 'vscode';

export default async function () {
  const TEST_URI = "/home/brendan/test/extensiontest/U131364/Typedoc Check/draft/static/index.html";
  const parser = new DownstairsUriParser(vscode.Uri.parse(TEST_URI));
  console.log(parser);
  debugger;
  
}