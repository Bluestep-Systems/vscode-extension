import * as path from 'path';
import * as vscode from 'vscode';

/**
 * A utility class to match file URIs against glob patterns relative to a base URI.
 */
export class GlobMatcher {

  public readonly baseUri: vscode.Uri;
  private readonly matchers: RegExp[];

  /**
   * Creates a matcher for the given base URI and glob patterns.
   * @param baseUri The base directory URI that patterns are relative to
   * @param patterns Glob patterns (gitignore-style) to match against
   */
  constructor(baseUri: vscode.Uri, patterns: string[]) {
    this.baseUri = baseUri;
    this.matchers = patterns.map(GlobMatcher.globToRegex);
  }

  /**
   * Determines if the given URI matches any of the glob patterns.
   * @param uri The URI to test
   * @returns `true` if the URI matches any pattern with respect to the base URI, `false` otherwise.
   */
  public matches(uri: vscode.Uri): boolean {
    const relativePath = path.relative(this.baseUri.fsPath, uri.fsPath).split(path.sep).join('/');
    return this.matchers.some(re => re.test(relativePath));
  }

  /**
   * Converts a gitignore-style glob pattern to a RegExp.
   *
   * Supports: `*` (any segment chars), `**` (any path), `?` (single char),
   * leading `/` (anchored to root), trailing `/` (directories only, treated as prefix).
   */
  private static globToRegex(pattern: string): RegExp {
    // Strip leading/trailing whitespace
    let p = pattern.trim();

    // Anchored if starts with /
    const anchored = p.startsWith('/');
    if (anchored) {
      p = p.slice(1);
    }

    // Directory-only patterns match anything inside them
    if (p.endsWith('/')) {
      p = p + '**';
    }

    // Escape regex special chars (except our glob chars)
    let regex = '';
    let i = 0;
    while (i < p.length) {
      const c = p[i];
      if (c === '*' && p[i + 1] === '*') {
        // ** matches everything including /
        if (p[i + 2] === '/') {
          regex += '(?:.*/)?';
          i += 3;
        } else {
          regex += '.*';
          i += 2;
        }
      } else if (c === '*') {
        // * matches everything except /
        regex += '[^/]*';
        i++;
      } else if (c === '?') {
        regex += '[^/]';
        i++;
      } else if (c === '.' || c === '+' || c === '^' || c === '$' ||
                 c === '{' || c === '}' || c === '(' || c === ')' ||
                 c === '|' || c === '[' || c === ']' || c === '\\') {
        regex += '\\' + c;
        i++;
      } else {
        regex += c;
        i++;
      }
    }

    // If not anchored, the pattern can match at any path depth
    if (!anchored) {
      regex = '(?:^|.*/)?' + regex;
    } else {
      regex = '^' + regex;
    }

    regex += '$';
    return new RegExp(regex);
  }
}
