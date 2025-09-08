import * as path from 'path';
import * as vscode from 'vscode';
import { Alert } from '../ui/Alert';

/**
 * A utility class for dealing with IDs in the format `363769__FID_dummyTestEndpoint`.
 */
export class IdUtility {

  /**
   * The class ID extracted from the ID string.
   */
  classId: string;

  /**
   * The alt ID value extracted from the ID string.
   */
  altIdValue: string;

  /**
   * The alt ID key extracted from the ID string. Typically it is "FID" or "PID".
   */
  altIdKey?: string;

  /**
   * constructs this utility class
   * @param id The ID string to extract information from.
   */
  constructor(id: string) {
    // write a regex that takes id in the following patterh `363769__FID_dummyTestEndpoint` and extracts a regex
    const match = id.match(/^(\d+)__(\w*)_(.+)$/);
    if (match) {
      this.classId = match[1];
      this.altIdKey = match[2];
      this.altIdValue = match[3];
    } else {
      throw new Error("Invalid ID format: expected something like `363769__FID_dummyTestEndpoint` but got: `" + id + "`");
    }
  }

  /**
   * Converts the ID to a format that can be searched for in a file.
   * @returns The searchable string representation of the ID.
   */
  private toSearchableString() {
    return `${this.altIdKey}=${this.altIdValue}`;
  }

  /**
   * uses the vscode api to determine if the file contains the id
   * @param uri
   * @returns
   */
  private async isContainedIn(uri: vscode.Uri): Promise<boolean> {
    const fileContent = await vscode.workspace.fs.readFile(uri);
    const textContent = new TextDecoder().decode(fileContent);
    if (textContent.includes(this.toSearchableString())) {
      return true;
    }
    return false;
  }

  /**
   * Finds a metadata file containing the specified ID.
   * @param nodes The directory listing to search.
   * @param folderUri The URI of the folder to search within.
   * @param id The ID to search for.
   * @returns The URI of the file containing the ID, or null if not found.
   */
  async findFileContaining(folderUri: vscode.Uri): Promise<vscode.Uri | null> {
    const nodes = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [name, type] of nodes) {
      if (type === vscode.FileType.Directory) {
        const nestedFolderUri = vscode.Uri.file(path.join(folderUri.fsPath, name));

        try {
          const files = await vscode.workspace.findFiles(new vscode.RelativePattern(nestedFolderUri, '**/metadata.json'));
          for (const file of files) {
            const isContained = await this.isContainedIn(file);
            if (isContained) {
              return file;
            }
          }
        } catch (error) {
          Alert.warning(`Error reading directory ${nestedFolderUri.fsPath}: ${error}`);
        }
      }
    }
    return null;
  }
}
