import * as vscode from 'vscode';
import { Converter } from "./Converter";
import { ExtensionConfig } from '../../core/constants';

export const REQUIRED_CONVERTERS: Converter[] = [
  // future converters go here; make sure they are in order.
];

export async function runConverts() {
  const extension = vscode.extensions.getExtension(ExtensionConfig.EXTENSION_ID);
  const curVersion:string = extension && extension.packageJSON && extension.packageJSON.version;
  if (!curVersion) {
    throw new Error("Could not determine current extension version");
  }
  for (const converter of REQUIRED_CONVERTERS) {
    if (converter.fromVersion >= curVersion) {
      await converter.convert();
    }
  }
}