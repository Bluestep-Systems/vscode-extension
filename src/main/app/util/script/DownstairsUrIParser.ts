import * as vscode from 'vscode';
import * as path from 'path';


/**
 * A utility class to parse downstairs URIs into their components.
 */
export class DownstairsUriParser {

  /**
   * Regex to match and extract components from a downstairs URI.
   */
  private static readonly URI_DISAMBIGUATION_REGEX = /^(.*?)[\/\\](\d+)[\/\\](draft|declarations|\.b6p_metadata\.json)(?:[\/\\](.*))?$/;

  /**
   * The type of the downstairs file: "draft", "declarations", or "metadata" (for .b6p_metadata.json files)
   */
  public readonly type: "draft" | "declarations" | "metadata";

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
   * the WebDAV ID portion of the path
   * 
   * This is the numeric ID that comes after the prepending path and before the type folder
   * e.g. in /some/path/12345/draft/script.b6p, the WebDAV ID is "12345"
   * 
   * //TODO this will ultimately replaced with the name of the folder in order to clean up the readability of the user's filesystem
   */
  public readonly webDavId: string;

  constructor(downstairsUri: vscode.Uri) {
    const cleanPath = downstairsUri.fsPath;

    const match = cleanPath.match(DownstairsUriParser.URI_DISAMBIGUATION_REGEX);

    if (!match) {
      throw new Error("The provided URI does not conform to expected structure: " + downstairsUri.toString() + ", expected /^(.*?)[/\\\\](\\d+)[/\\\\](draft|declarations|\\.b6p_metadata\\.json)(?:[/\\\\](.*))?$/");
    }

    this.prependingPath = match[1]; // Extract the path before the WebDAV ID
    this.webDavId = match[2]; // Extract the WebDAV ID
    const typeStr = match[3] as "draft" | "declarations" | ".b6p_metadata.json"; // Extract the type string
    this.rest = match[4] || ""; // Extract the relative path after the type

    this.type = typeStr === '.b6p_metadata.json' ? 'metadata' : typeStr;
  }

  /**
   * Returns the portion of the URI string from after "file://" up to the type folder
   * 
   * This reconstructs the path using the extracted components instead of substring operations
   */
  public getShavedName(): string {
    return this.prependingPath + path.sep + this.webDavId;
  }

  /**
   * Compares this parser with another for equality.
   * @param other The other parser to compare against.
   * @returns True if the parsers are equal, false otherwise.
   */
  public equals(other: DownstairsUriParser): boolean {
    return this.prependingPath === other.prependingPath &&
      this.webDavId === other.webDavId &&
      this.type === other.type &&
      this.rest === other.rest;
  }
}
