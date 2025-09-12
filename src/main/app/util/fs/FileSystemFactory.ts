import { IFileSystemProvider, VSCodeFileSystemProvider, MockFileSystemProvider } from './FileSystemProvider';

/**
 * Namespace for managing the file system provider.
 * This allows us to switch between real and mock implementations for testing.
 */
export namespace FileSystemFactory {
  let instance: IFileSystemProvider = new VSCodeFileSystemProvider();
  let isTestMode = false;

  /**
   * Get the current file system provider instance.
   */
  export function getInstance(): IFileSystemProvider {
    return instance;
  }

  /**
   * Set a custom file system provider (mainly for testing).
   */
  export function setProvider(provider: IFileSystemProvider): void {
    instance = provider;
  }

  /**
   * Switch to mock mode for testing.
   */
  export function enableTestMode(): MockFileSystemProvider {
    const mockProvider = new MockFileSystemProvider();
    instance = mockProvider;
    isTestMode = true;
    return mockProvider;
  }

  /**
   * Switch back to real VS Code file system.
   */
  export function enableProductionMode(): void {
    instance = new VSCodeFileSystemProvider();
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