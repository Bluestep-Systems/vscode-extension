import * as vscode from 'vscode';
import { Converter } from "./Converter";
import { Converter1_0_1_to_1_1_0 } from "./Converter_1.0.1_1.1.0";
import { ExtensionConfig } from '../resources/constants';

export const REQUIRED_CONVERTERS: Converter[] = [
  new Converter1_0_1_to_1_1_0(),
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