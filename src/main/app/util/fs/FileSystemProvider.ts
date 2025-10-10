import * as vscode from 'vscode';
import type { ScriptPathElement } from '../script/PathElement';
import type { ScriptFolder } from '../script/ScriptFolder';
import { Err } from '../Err';

/**
 * Interface defining the file system operations we need.
 * This allows us to create both real and mock implementations.
 * 
 * This interface mirrors the VS Code file system API to provide a consistent
 * abstraction layer for file operations that can be easily mocked for testing.
 */
export interface FileSystemProvider {
  /**
   * Read the entire contents of a file as bytes.
   * 
   * @param uri The URI of the file to read
   * @returns A promise that resolves to the file contents as a Uint8Array
   * @throws Error if the file does not exist or cannot be read
   * 
   * @example
   * ```typescript
   * const content = await fs.readFile(vscode.Uri.file('/path/to/file.txt'));
   * const text = Buffer.from(content).toString('utf8');
   * ```
   */
  readFile(uri: vscode.Uri): Promise<Uint8Array>;

  /**
   * Write data to a file, replacing its entire contents.
   * 
   * @param uri The URI of the file to write to
   * @param content The data to write as a Uint8Array
   * @returns A promise that resolves when the write operation completes
   * @throws Error if the file cannot be written (e.g., permission denied)
   * 
   * @example
   * ```typescript
   * const content = Buffer.from('Hello, world!', 'utf8');
   * await fs.writeFile(vscode.Uri.file('/path/to/file.txt'), content);
   * ```
   */
  writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void>;

  /**
   * Retrieve metadata about a file or directory.
   * 
   * @param uri The URI of the file or directory to stat
   * @returns A promise that resolves to file metadata including type, size, and timestamps
   * @throws Error if the file/directory does not exist
   * 
   * @example
   * ```typescript
   * const stat = await fs.stat(vscode.Uri.file('/path/to/file.txt'));
   * console.log(`File size: ${stat.size} bytes`);
   * console.log(`Modified: ${new Date(stat.mtime)}`);
   * ```
   */
  stat(uri: vscode.Uri): Promise<vscode.FileStat>;

  /**
   * Search for files in the workspace using glob patterns.
   * 
   * @param include A glob pattern that defines the files to search for
   * @param exclude Optional glob pattern that defines files and folders to exclude
   * @param maxResults Optional upper bound for the result count
   * @param token Optional cancellation token to cancel the search
   * @returns A promise that resolves to an array of matching file URIs
   * 
   * @example
   * ```typescript
   * // Find all TypeScript files
   * const tsFiles = await fs.findFiles('**\/*.ts');
   * 
   * // Find all JSON files except in node_modules
   * const jsonFiles = await fs.findFiles('**\/*.json', '**\/node_modules\/**');
   * 
   * // Find at most 10 JavaScript files
   * const jsFiles = await fs.findFiles('**\/*.js', null, 10);
   * ```
   */
  findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number, token?: vscode.CancellationToken): Promise<vscode.Uri[]>;

  /**
   * Retrieve all entries of a directory.
   * 
   * @param uri The URI of the directory to read
   * @returns A promise that resolves to an array of [name, type] tuples for each entry
   * @throws Error if the directory does not exist or cannot be read
   * 
   * @example
   * ```typescript
   * const entries = await fs.readDirectory(vscode.Uri.file('/path/to/dir'));
   * for (const [name, type] of entries) {
   *   if (type === vscode.FileType.File) {
   *     console.log(`File: ${name}`);
   *   } else if (type === vscode.FileType.Directory) {
   *     console.log(`Directory: ${name}`);
   *   }
   * }
   * ```
   */
  readDirectory(folder: ScriptFolder): Promise<[string, vscode.FileType][]>;

  /**
   * Delete a file or directory.
   * 
   * @param uri The URI of the file or directory to delete
   * @param options Optional deletion options
   * @param options.recursive If true, recursively delete directory contents (default: true)
   * @param options.useTrash If true, move to trash instead of permanent deletion (default: false)
   * @returns A promise that resolves when the deletion completes
   * @throws Error if the file/directory does not exist or cannot be deleted
   * 
   * @example
   * ```typescript
   * // Delete a file
   * await fs.delete(vscode.Uri.file('/path/to/file.txt'));
   * 
   * // Delete a directory and all its contents
   * await fs.delete(vscode.Uri.file('/path/to/dir'), { recursive: true });
   * 
   * // Move to trash instead of permanent deletion
   * await fs.delete(vscode.Uri.file('/path/to/file.txt'), { useTrash: true });
   * ```
   */
  delete(element: ScriptPathElement, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void>;

  /**
   * Create a directory.
   * 
   * @param uri The URI of the directory to create
   * @returns A promise that resolves when the directory is created
   * @throws Error if the directory already exists or cannot be created
   * 
   * @example
   * ```typescript
   * await fs.createDirectory(vscode.Uri.file('/path/to/new/dir'));
   * ```
   */
  createDirectory(uri: vscode.Uri): Promise<void>;

  /**
   * Rename or move a file or directory.
   * 
   * @param source The current URI of the file or directory
   * @param target The new URI for the file or directory
   * @param options Optional rename options
   * @param options.overwrite If true, overwrite the target if it exists (default: false)
   * @returns A promise that resolves when the rename/move completes
   * @throws Error if source doesn't exist, target exists and overwrite is false, or operation fails
   * 
   * @example
   * ```typescript
   * // Rename a file
   * await fs.rename(
   *   vscode.Uri.file('/path/to/oldname.txt'),
   *   vscode.Uri.file('/path/to/newname.txt')
   * );
   * 
   * // Move a file to a different directory
   * await fs.rename(
   *   vscode.Uri.file('/path/to/file.txt'),
   *   vscode.Uri.file('/different/path/file.txt')
   * );
   * 
   * // Rename with overwrite
   * await fs.rename(source, target, { overwrite: true });
   * ```
   */
  rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void>;

  /**
   * Copy a file or directory.
   * 
   * @param source The URI of the file or directory to copy
   * @param target The URI where the copy should be created
   * @param options Optional copy options
   * @param options.overwrite If true, overwrite the target if it exists (default: false)
   * @returns A promise that resolves when the copy operation completes
   * @throws Error if source doesn't exist, target exists and overwrite is false, or operation fails
   * 
   * @example
   * ```typescript
   * // Copy a file
   * await fs.copy(
   *   vscode.Uri.file('/path/to/source.txt'),
   *   vscode.Uri.file('/path/to/copy.txt')
   * );
   * 
   * // Copy with overwrite
   * await fs.copy(source, target, { overwrite: true });
   * ```
   */
  copy(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void>;

  /**
   * Check if a file system scheme supports write operations.
   * 
   * @param scheme The URI scheme to check (e.g., 'file', 'https', 'vscode-vfs')
   * @returns true if writable, false if read-only, undefined if unknown
   * 
   * @example
   * ```typescript
   * const isWritable = fs.isWritableFileSystem('file'); // true
   * const isHttpWritable = fs.isWritableFileSystem('https'); // false or undefined
   * ```
   */
  isWritableFileSystem(scheme: string): boolean | undefined;

  /**
   * Recursively search for a file with a specific name, starting from sibling files
   * and then moving up through parent directories.
   * 
   * @param startUri The URI to start the search from (typically current file's directory)
   * @param fileName The name of the file to search for (e.g., 'tsconfig.json', 'package.json')
   * @param maxDepth Optional maximum number of parent directories to search (default: 10)
   * @returns A promise that resolves to the URI of the found file, or null if not found
   * 
   * @example
   * ```typescript
   * // Search for tsconfig.json starting from current file's directory
   * const currentFile = vscode.Uri.file('/project/src/components/Button.tsx');
   * const tsconfig = await fs.closest(
   *   vscode.Uri.file(path.dirname(currentFile.fsPath)), 
   *   'tsconfig.json'
   * );
   * 
   * // Search for package.json with limited depth
   * const packageJson = await fs.closest(
   *   startDir,
   *   'package.json',
   *   5
   * );
   * ```
   */
  closest(startUri: vscode.Uri, fileName: string, maxDepth?: number): Promise<vscode.Uri | null>;
}

/**
 * Real implementation that delegates to VS Code's file system API.
 */
export class VSCodeFileSystem implements FileSystemProvider {
  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(uri);
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    return vscode.workspace.fs.writeFile(uri, content);
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    return vscode.workspace.fs.stat(uri);
  }

  async findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number, token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(include, exclude, maxResults, token);
  }
  async readDirectory(folder: ScriptFolder): Promise<[string, vscode.FileType][]> {
    return vscode.workspace.fs.readDirectory(folder.uri());
  }
  async delete(element: ScriptPathElement, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
    return vscode.workspace.fs.delete(element.uri(), { recursive: options?.recursive ?? true, useTrash: options?.useTrash ?? false });
  }
  async createDirectory(uri: vscode.Uri): Promise<void> {
    return vscode.workspace.fs.createDirectory(uri);
  }
  async rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
    return vscode.workspace.fs.rename(source, target, { overwrite: options?.overwrite ?? false });
  }
  async copy(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
    try {
      return vscode.workspace.fs.copy(source, target, { overwrite: options?.overwrite ?? false });
    } catch (e) {
      throw new Err.FileSystemError(e instanceof Error ? e.message : String(e));  
    }
  }
  isWritableFileSystem(scheme: string): boolean | undefined {
    return vscode.workspace.fs.isWritableFileSystem(scheme);
  }

  /**
   * Recursively search for a file with a specific name, starting from sibling files
   * and then moving up through parent directories.
   */
  async closest(startUri: vscode.Uri, fileName: string, maxDepth: number = 10): Promise<vscode.Uri | null> {
    let currentDir = startUri;
    let depth = 0;

    while (depth < maxDepth) {
      try {
        // Check if the target file exists in the current directory
        const targetFile = vscode.Uri.joinPath(currentDir, fileName);
        
        try {
          await this.stat(targetFile);
          // File exists, return its URI
          return targetFile;
        } catch {
          // File doesn't exist in this directory, continue searching
        }

        // Get the parent directory
        const parentDir = vscode.Uri.joinPath(currentDir, '..');
        
        // Check if we've reached the root (parent is same as current)
        if (parentDir.path === currentDir.path || currentDir.path === '/' || currentDir.path === '') {
          break;
        }

        currentDir = parentDir;
        depth++;
      } catch (error) {
        // Error accessing directory, stop searching
        console.error(`Error searching in directory ${currentDir.path}:`, error);
        break;
      }
    }

    return null; // File not found
  }
}

/**
 * Mock implementation for testing purposes.
 */
export class MockFileSystem implements FileSystemProvider {
  private files = new Map<string, Uint8Array | Error>();
  private stats = new Map<string, vscode.FileStat | Error>();
  
  constructor() {
    // Initialize with some default behavior
  }

  /**
   * Set up a mock file with specific content for testing.
   * This is the primary method for preparing test data.
   * 
   * @param uri The URI where the mock file should be created
   * @param content The content as either a string or Uint8Array
   * 
   * @example
   * ```typescript
   * mockFs.setMockFile(vscode.Uri.file('/test/file.txt'), 'Hello, world!');
   * mockFs.setMockFile(vscode.Uri.file('/test/data.bin'), new Uint8Array([1, 2, 3]));
   * ```
   */
  setMockFile(uri: vscode.Uri, content: string | Uint8Array): void {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    this.files.set(uri.toString(), buffer);
    
    // Also set up a default stat
    this.setMockStat(uri, {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: buffer.length
    });
  }

  /**
   * Set up mock file stat for testing.
   * Use this to customize file metadata without setting content.
   * 
   * @param uri The URI of the file to set metadata for
   * @param stat The file stat object with type, timestamps, and size
   * 
   * @example
   * ```typescript
   * mockFs.setMockStat(vscode.Uri.file('/test/file.txt'), {
   *   type: vscode.FileType.File,
   *   ctime: Date.now(),
   *   mtime: Date.now(),
   *   size: 1024
   * });
   * ```
   */
  setMockStat(uri: vscode.Uri, stat: vscode.FileStat): void {
    this.stats.set(uri.toString(), stat);
  }

  /**
   * Set up a mock directory for testing.
   * Creates a directory entry that can be listed and used as a parent for files.
   * 
   * @param uri The URI of the directory to create
   * 
   * @example
   * ```typescript
   * mockFs.setMockDirectory(vscode.Uri.file('/test/dir'));
   * // Now you can add files under this directory
   * mockFs.setMockFile(vscode.Uri.file('/test/dir/file.txt'), 'content');
   * ```
   */
  setMockDirectory(uri: vscode.Uri): void {
    this.stats.set(uri.toString(), {
      type: vscode.FileType.Directory,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    });
  }

  /**
   * Configure a file to throw an error when accessed.
   * Useful for testing error handling scenarios.
   * 
   * @param uri The URI of the file that should throw an error
   * @param error The error to throw when the file is accessed
   * 
   * @example
   * ```typescript
   * mockFs.setMockError(
   *   vscode.Uri.file('/test/broken.txt'),
   *   new Error('Permission denied')
   * );
   * // Now any operation on this file will throw the error
   * ```
   */
  setMockError(uri: vscode.Uri, error: Error): void {
    this.files.set(uri.toString(), error);
    this.stats.set(uri.toString(), error);
  }

  /**
   * Clear all mock data.
   * Resets the mock file system to an empty state.
   * 
   * @example
   * ```typescript
   * // Set up some test files
   * mockFs.setMockFile(vscode.Uri.file('/test1.txt'), 'content1');
   * mockFs.setMockFile(vscode.Uri.file('/test2.txt'), 'content2');
   * 
   * // Clear everything for the next test
   * mockFs.clearMocks();
   * ```
   */
  clearMocks(): void {
    this.files.clear();
    this.stats.clear();
  }

  /**
   * Get all mock file URIs for testing purposes.
   * Useful for debugging or verifying what files are in the mock file system.
   * 
   * @returns Array of URI strings for all mock files
   * 
   * @example
   * ```typescript
   * mockFs.setMockFile(vscode.Uri.file('/test1.txt'), 'content1');
   * mockFs.setMockFile(vscode.Uri.file('/test2.txt'), 'content2');
   * 
   * const files = mockFs.getMockFiles();
   * console.log(files); // ['file:///test1.txt', 'file:///test2.txt']
   * ```
   */
  getMockFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Check if a mock file exists.
   * Useful for test assertions and setup verification.
   * 
   * @param uri The URI to check for existence
   * @returns true if the mock file exists, false otherwise
   * 
   * @example
   * ```typescript
   * mockFs.setMockFile(vscode.Uri.file('/test.txt'), 'content');
   * 
   * assert.strictEqual(mockFs.hasMockFile(vscode.Uri.file('/test.txt')), true);
   * assert.strictEqual(mockFs.hasMockFile(vscode.Uri.file('/missing.txt')), false);
   * ```
   */
  hasMockFile(uri: vscode.Uri): boolean {
    return this.files.has(uri.toString());
  }

  /**
   * Get mock file content as string for testing.
   * Convenient method to retrieve file content for assertions.
   * 
   * @param uri The URI of the file to get content from
   * @returns The file content as a string, or undefined if file doesn't exist or is an error
   * 
   * @example
   * ```typescript
   * mockFs.setMockFile(vscode.Uri.file('/test.txt'), 'Hello, world!');
   * 
   * const content = mockFs.getMockFileContent(vscode.Uri.file('/test.txt'));
   * assert.strictEqual(content, 'Hello, world!');
   * 
   * const missing = mockFs.getMockFileContent(vscode.Uri.file('/missing.txt'));
   * assert.strictEqual(missing, undefined);
   * ```
   */
  getMockFileContent(uri: vscode.Uri): string | undefined {
    const content = this.files.get(uri.toString());
    if (content && !(content instanceof Error)) {
      return Buffer.from(content).toString();
    }
    return undefined;
  }

  /**
   * Set up multiple mock files at once for testing.
   */
  setMockFiles(files: Record<string, string>): void {
    Object.entries(files).forEach(([path, content]) => {
      this.setMockFile(vscode.Uri.file(path), content);
    });
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const key = uri.toString();
    const content = this.files.get(key);
    
    if (!content) {
      throw new Err.FileNotFoundError(uri.toString());
    }
    
    if (content instanceof Error) {
      throw content;
    }
    
    return content;
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    this.files.set(uri.toString(), content);
    
    // Update stat if it exists
    const existingStat = this.stats.get(uri.toString());
    if (existingStat && !(existingStat instanceof Error)) {
      this.stats.set(uri.toString(), {
        ...existingStat,
        mtime: Date.now(),
        size: content.length
      });
    } else {
      // Create new stat
      this.setMockStat(uri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: content.length
      });
    }
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const key = uri.toString();
    const stat = this.stats.get(key);
    
    if (!stat) {
      throw new Err.FileNotFoundError(uri.toString());
    }
    
    if (stat instanceof Error) {
      throw stat;
    }
    
    return stat;
  }

  async findFiles(include: vscode.GlobPattern, _exclude?: vscode.GlobPattern | null, maxResults?: number, _token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    // Simple mock implementation - in real tests you'd set up specific files to be "found"
    const results: vscode.Uri[] = [];
    
    // Handle RelativePattern objects
    let baseUri: vscode.Uri;
    let pattern: string;
    
    if (include instanceof vscode.RelativePattern) {
      baseUri = include.baseUri;
      pattern = include.pattern;
    } else {
      // For string patterns, assume workspace root
      baseUri = vscode.Uri.file('');
      pattern = include.toString();
    }
    
    // For patterns like "**/config.json", we want to find any file ending with the target filename
    const targetFile = pattern.replace('**/', '');
    
    for (const [uriStr] of this.files) {
      const uri = vscode.Uri.parse(uriStr);
      
      // Check if the file is under the base URI and matches the pattern
      const isUnderBase = baseUri.path === '' || uri.path.startsWith(baseUri.path);
      const matchesPattern = uri.path.endsWith('/' + targetFile) || uri.path.endsWith(targetFile);
      
      if (isUnderBase && matchesPattern) {
        results.push(uri);
        
        if (maxResults && results.length >= maxResults) {
          break;
        }
      }
    }
    
    return results;
  }
  async readDirectory(folder: ScriptFolder): Promise<[string, vscode.FileType][]> {
    const key = folder.uri().toString();
    const stat = this.stats.get(key);
    
    if (!stat || stat instanceof Error || stat.type !== vscode.FileType.Directory) {
      throw new Err.DirectoryNotFoundError(folder.uri().toString());
    }
    
    // Simple mock implementation - in real tests you'd set up specific files/directories
    const entries: [string, vscode.FileType][] = [];
    
    for (const [fileUriStr, _fileContent] of this.files) {
      const fileUri = vscode.Uri.parse(fileUriStr);
      if (fileUri.path.startsWith(folder.uri().path) && fileUri.path !== folder.uri().path) {
        const relativePath = fileUri.path.slice(folder.uri().path.length + 1).split('/')[0];
        if (!entries.find(entry => entry[0] === relativePath)) {
          const fileStat = this.stats.get(fileUriStr);
          entries.push([relativePath, fileStat ? (fileStat as vscode.FileStat).type : vscode.FileType.File]);
        }
      }
    }
    
    return entries;
  }

  async delete(element: ScriptPathElement, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
    const key = element.uri().toString();

    // In a more sophisticated mock, we could handle recursive deletion of directories
    // and simulate trash behavior, but for now we'll just acknowledge the options exist
    const recursive = options?.recursive ?? true;
    // useTrash option is acknowledged but not implemented in this mock
    
    if (this.files.has(key)) {
      this.files.delete(key);
      this.stats.delete(key);
      
      // If recursive, we could delete all files under this path
      if (recursive) {
        const pathToDelete = element.uri().path;
        const keysToDelete: string[] = [];
        
        for (const [fileKey] of this.files) {
          const fileUri = vscode.Uri.parse(fileKey);
          if (fileUri.path.startsWith(pathToDelete + '/')) {
            keysToDelete.push(fileKey);
          }
        }
        
        keysToDelete.forEach(keyToDelete => {
          this.files.delete(keyToDelete);
          this.stats.delete(keyToDelete);
        });
      }
    } else {
      throw new Err.FileNotFoundError(element.uri().toString());
    }
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    this.setMockDirectory(uri);
  }

  async rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
    const sourceKey = source.toString();
    const targetKey = target.toString();
    
    // Check if source exists
    const sourceContent = this.files.get(sourceKey);
    const sourceStat = this.stats.get(sourceKey);
    
    if (!sourceContent || !sourceStat) {
      throw new Err.FileNotFoundError(source.toString());
    }
    
    // Check if target exists and overwrite is not allowed
    if (!options?.overwrite && (this.files.has(targetKey) || this.stats.has(targetKey))) {
      throw new Err.FileAlreadyExistsError(target.toString());
    }
    
    // Move the file
    if (!(sourceContent instanceof Error) && !(sourceStat instanceof Error)) {
      this.files.set(targetKey, sourceContent);
      this.stats.set(targetKey, sourceStat);
    }
    
    // Remove from source
    this.files.delete(sourceKey);
    this.stats.delete(sourceKey);
  }

  async copy(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
    const sourceKey = source.toString();
    const targetKey = target.toString();
    
    // Check if source exists
    const sourceContent = this.files.get(sourceKey);
    const sourceStat = this.stats.get(sourceKey);
    
    if (!sourceContent || !sourceStat) {
      throw new Err.FileNotFoundError(source.toString());
    }
    
    // Check if target exists and overwrite is not allowed
    if (!options?.overwrite && (this.files.has(targetKey) || this.stats.has(targetKey))) {
      throw new Err.FileAlreadyExistsError(target.toString());
    }
    
    // Copy the file
    if (!(sourceContent instanceof Error) && !(sourceStat instanceof Error)) {
      // Create a copy of the content
      const contentCopy = new Uint8Array(sourceContent);
      this.files.set(targetKey, contentCopy);
      
      // Create a copy of the stat with updated times
      this.stats.set(targetKey, {
        ...sourceStat,
        ctime: Date.now(),
        mtime: Date.now()
      });
    }
  }

  isWritableFileSystem(scheme: string): boolean | undefined {
    // Mock implementation - return true for file scheme, undefined for others
    if (scheme === 'file') {
      return true;
    }
    return undefined;
  }

  /**
   * Recursively search for a file with a specific name in the mock file system.
   * This implementation searches through the mock files for the target filename.
   */
  async closest(startUri: vscode.Uri, fileName: string, maxDepth: number = 10): Promise<vscode.Uri | null> {
    let currentPath = startUri.path;
    let depth = 0;

    while (depth < maxDepth) {
      // Normalize the path to ensure it ends with '/' for directory operations
      const searchPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
      const targetPath = searchPath + fileName;
      const targetUri = vscode.Uri.file(targetPath);

      // Check if the target file exists in our mock files
      if (this.files.has(targetUri.toString())) {
        return targetUri;
      }

      // Move to parent directory
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
      
      // Check if we've reached the root
      if (parentPath === currentPath || parentPath === '' || currentPath === '/') {
        break;
      }

      currentPath = parentPath;
      depth++;
    }

    return null; // File not found
  }
}