import * as vscode from 'vscode';


/**
 * A utility class to parse downstairs URIs into their components.
 */
export class DownstairsUriParser {
  private static readonly URI_DISAMBIGUATION_REGEX = /^(.*?)\/(\d+)\/(draft|declarations|\.b6p_metadata\.json)(?:\/(.*))?$/;

  public readonly type: "draft" | "declarations" | "metadata";
  public readonly rest: string;
  public readonly prependingPath: string;
  public readonly webDavId: string;

  constructor(downstairsUri: vscode.Uri) {
    const cleanPath = downstairsUri.fsPath;

    const match = cleanPath.match(DownstairsUriParser.URI_DISAMBIGUATION_REGEX);

    if (!match) {
      throw new Error("The provided URI does not conform to expected structure: " + downstairsUri.toString() + ", expected /^(.*?)\/(\d+)\/(draft|declarations|\.b6p_metadata\.json)(?:\/(.*))?$/");
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
    return this.prependingPath + `/${this.webDavId}`;
  }
}
