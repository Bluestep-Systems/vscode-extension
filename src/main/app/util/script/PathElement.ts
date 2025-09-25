import * as vscode from 'vscode';

/**
 * Interface representing an element with a file system path and URI.
 * @lastreviewed null
 */
export interface PathElement {
  /**
   * Gets the file system path of this element.
   * @returns The file system path as a string
   * @lastreviewed null
   */
  path(): string;
  
  /**
   * Gets the URI of this element.
   * @returns The VS Code URI
   * @lastreviewed null
   */
  uri(): vscode.Uri;
  
  /**
   * Checks if this element is equal to another element of the same type.
   * @param other The element to compare with
   * @returns True if the elements are equal, false otherwise
   * @lastreviewed null
   */
  equals(other: PathElement): boolean;
  
}

