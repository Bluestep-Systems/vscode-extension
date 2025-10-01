import * as vscode from 'vscode';
import { FileSystemProvider, MockFileSystem, VSCodeFileSystem } from './FileSystemProvider';
import { Err } from '../Err';
import type { TestableFactoryStatic, TestableFactory } from '../../../../test/TestableFactory';

/**
 * Namespace for managing the file system provider.
 * This allows us to switch between real and mock implementations for testing.
 * Conforms to the {@link TestableFactory} pattern.
 */
export namespace FileSystem {
  let instance: FileSystemProvider = new VSCodeFileSystem();
  let isTestMode = false;

  /**
   * Get the current file system provider instance.
   */
  export function getInstance(): FileSystemProvider {
    return instance;
  }

  /**
   * Set a custom file system provider (mainly for testing).
   */
  export function setProvider(provider: FileSystemProvider): void {
    instance = provider;
  }

  /**
   * Switch to mock mode for testing.
   */
  export function enableTestMode(): MockFileSystem {
    const mockProvider = new MockFileSystem();
    instance = mockProvider;
    isTestMode = true;
    return mockProvider;
  }

  /**
   * Switch back to real VS Code file system.
   */
  export function enableProductionMode(): void {
    instance = new VSCodeFileSystem();
    isTestMode = false;
  }

  /**
   * Check if we're currently in test mode.
   */
  export function getIsTestMode(): boolean {
    return isTestMode;
  }

  /**
   * Reset to default state (production mode).
   */
  export function reset(): void {
    enableProductionMode();
  }

  /**
   * Creates a dummy text document from the provided URI. Useful for glob matching.
   * @param uri
   * @returns a dummy text document.
   */
  export function createDummyTextDocument(uri: vscode.Uri): vscode.TextDocument {
    return {
      uri,
      get fileName() { return this.uri.fsPath; },
      get isUntitled() { return true; },
      get languageId() { return 'plaintext'; },
      get version() { return 1; },
      get isDirty() { return false; },
      get isClosed() { return false; },
      get eol() { return vscode.EndOfLine.LF; },
      get lineCount() { return 0; },
      lineAt: (_line: number | vscode.Position) => {
        throw new Err.MethodNotImplementedError();
      },
      offsetAt: (_position: vscode.Position) => {
        throw new Err.MethodNotImplementedError();
      },
      positionAt: (_offset: number) => {
        throw new Err.MethodNotImplementedError();
      },
      getText: (_range?: vscode.Range) => {
        return '';
      },
      getWordRangeAtPosition: (_position: vscode.Position, _regex?: RegExp) => {
        return undefined;
      },
      validateRange: (range: vscode.Range) => {
        return range;
      },
      validatePosition: (position: vscode.Position) => {
        return position;
      },
      save: async () => { return true; },
      encoding: "utf8",
    };
  }
}

/**
 * Type assertion to ensure FileSystem conforms to {@link TestableFactory} pattern
 */
const _typeCheck: TestableFactoryStatic<FileSystemProvider, MockFileSystem> = FileSystem;
// Prevent unused variable warning
void _typeCheck;
