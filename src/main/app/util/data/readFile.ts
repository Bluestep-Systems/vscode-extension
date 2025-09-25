import * as vscode from 'vscode';
import { FileSystem } from "../fs/FileSystem";
const fs = FileSystem.getInstance;
/**
 * Reads the text content of a file.
 * @param uri The URI of the file to read.
 * @returns The text content of the file.
 */
export async function readFileText(uri: vscode.Uri) {
  const fileData = await readFileRaw(uri);
  const textContent = Buffer.from(fileData).toString('utf8');
  return textContent;
}

/**
 * Reads the raw binary content of a file.
 * @param uri The URI of the file to read.
 * @returns The raw binary content of the file.
 */
export async function readFileRaw(uri: vscode.Uri) {
  const fileData = await fs().readFile(uri);
  return fileData;
}
