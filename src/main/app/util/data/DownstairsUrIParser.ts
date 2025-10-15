import * as path from 'path';
import * as vscode from 'vscode';
import { Err } from '../Err';
import { ScriptRoot } from '../script/ScriptRoot';

/**
 * A utility class to parse downstairs URIs into their components.
 */
export class DownstairsUriParser {

  public rawUri:vscode.Uri;
  /**
   * Regex to match and extract components from a downstairs URI.
   */
    private static readonly URI_DISAMBIGUATION_REGEX = /^(.*?)[\/\\]([\w ]+)[\/\\](draft|declarations|snapshot|\.b6p_metadata\.json|\.gitignore)?(?:[\/\\](.*))?$/;
  /**
   * The type of the downstairs file: "draft", "declarations", or "metadata" (for .b6p_metadata.json files)
   */
  public readonly type: "draft" | "declarations" | "metadata" | "root" | "snapshot";

  /**
   * the "rest" of the path after the type folder (draft, declarations, or .b6p_metadata.json)
   */
  public readonly rest: string;

  /**
   * the path portion before the WebDAV ID
   * 
   * This is everything from the start of the path up to (but not including) the WebDAV ID
   */
  public readonly prependingPath: string;

  /**
   * the scriptName portion of the path
   * 
   * This is the numeric ID that comes after the prepending path and before the type folder
   * e.g. in /some/path/12345/draft/script.b6p, the scriptName is "12345"
   * 
   */
  public readonly scriptName: string;

  constructor(downstairsUri: vscode.Uri) {
    const cleanPath = downstairsUri.fsPath;
    this.rawUri = downstairsUri;
    const match = cleanPath.match(DownstairsUriParser.URI_DISAMBIGUATION_REGEX);

    if (!match) {
      throw new Err.InvalidUriStructureError(downstairsUri.toString(), DownstairsUriParser.URI_DISAMBIGUATION_REGEX.toString());
    }

    this.prependingPath = match[1]; // Extract the path before the script name
    this.scriptName = match[2]; // Extract the scriptName
    
    const typeStr = match[3] as "draft" | "declarations" | ".b6p_metadata.json" | ".gitignore" | "snapshot" || undefined; // Extract the type string
    this.rest = match[4] || ""; // Extract the relative path after the type

    if (typeStr === undefined) {
      this.type = "root";
    } else if (typeStr === "draft" || typeStr === "declarations") {
      this.type = typeStr;
    } else if (typeStr === ScriptRoot.METADATA_FILENAME || typeStr === ScriptRoot.GITIGNORE_FILENAME) {
      // both of these are considered "metadata" files
      this.type = "metadata";
    } else if (typeStr === "snapshot") {
      this.type = "snapshot";
    } else {
      throw new Err.InvalidUriStructureError(downstairsUri.toString(), "valid type folder");
    }
    
  }

  /**
   * Returns the portion of the URI string from after "file://" up to the type folder
   *
   * This reconstructs the path using the extracted components instead of substring operations
   */
  public getShavedName(): string {
    return path.join(this.prependingPath, this.scriptName);
  }

  /**
   * Compares this parser with another for equality.
   * @param other The other parser to compare against.
   * @returns True if the parsers are equal, false otherwise.
   */
  public equals(other: DownstairsUriParser): boolean {
    return this.prependingPath === other.prependingPath &&
      this.scriptName === other.scriptName &&
      this.type === other.type &&
      this.rest === other.rest;
  }

  /**
   * Checks if the current parser is for a declarations or draft file.
   * @returns `true` if the parser is for a declarations or draft file, `false` otherwise.
   */
  public isDeclarationsOrDraft(): boolean {
    return ["draft", "declarations"].includes(this.type);
  }

  public isInDefinedFolders(): boolean {
    return ["draft", "declarations", "snapshot"].includes(this.type);
  }

  /**
   * Returns the {@link vscode.Uri} wrapper for the prepending path.
   */
  public prependingPathUri(): vscode.Uri {
    return vscode.Uri.file(this.prependingPath);
  }
}
