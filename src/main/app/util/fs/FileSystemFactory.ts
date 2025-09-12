import { FileSystemProvider, VSCodeFileSystem, MockFileSystem } from './FileSystemProvider';

/**
 * Namespace for managing the file system provider.
 * This allows us to switch between real and mock implementations for testing.
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
}