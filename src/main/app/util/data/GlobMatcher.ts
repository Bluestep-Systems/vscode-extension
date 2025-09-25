import * as vscode from 'vscode';
import { FileSystem } from '../fs/FileSystem';

/**
 * A utility class to match file URIs against glob patterns.
 */
export class GlobMatcher {

  public readonly baseUri: vscode.Uri;
  /**
   * The list of compiled glob patterns.
   */
  public readonly patterns: vscode.RelativePattern[];

  /**
   * Creates a matcher for the given base URI and glob patterns.
   * @param baseUri 
   * @param patterns 
   */
  constructor(baseUri: vscode.Uri, patterns: string[]) {
    this.baseUri = baseUri;
    this.patterns = patterns.map(pattern => new vscode.RelativePattern(this.baseUri, pattern));
  }

  /**
   * Determines if the given URI matches any of the glob patterns.
   * @param uri 
   * @returns `true` if the URI matches any pattern with respect to the base URI, `false` otherwise.
   */
  public matches(uri: vscode.Uri): boolean {
    for (const pattern of this.patterns) {
      if (vscode.languages.match({ pattern }, FileSystem.createDummyTextDocument(uri)) > 0) {
        return true;
      }
    }
    return false;
  }
}

