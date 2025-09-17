import * as vscode from 'vscode';

/**
 * Interface defining the file system operations we need.
 * This allows us to create both real and mock implementations.
 */
export interface FileSystemProvider {
  readFile(uri: vscode.Uri): Promise<Uint8Array>;
  writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void>;
  stat(uri: vscode.Uri): Promise<vscode.FileStat>;
  findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number, token?: vscode.CancellationToken): Promise<vscode.Uri[]>;
  readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]>;
  delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void>;
  createDirectory(uri: vscode.Uri): Promise<void>;
  rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void>;
  copy(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void>;
  isWritableFileSystem(scheme: string): boolean | undefined;
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
  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    return vscode.workspace.fs.readDirectory(uri);
  }
  async delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
    return vscode.workspace.fs.delete(uri, { recursive: options?.recursive ?? true, useTrash: options?.useTrash ?? false });
  }
  async createDirectory(uri: vscode.Uri): Promise<void> {
    return vscode.workspace.fs.createDirectory(uri);
  }
  async rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
    return vscode.workspace.fs.rename(source, target, { overwrite: options?.overwrite ?? false });
  }
  async copy(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
    return vscode.workspace.fs.copy(source, target, { overwrite: options?.overwrite ?? false });
  }
  isWritableFileSystem(scheme: string): boolean | undefined {
    return vscode.workspace.fs.isWritableFileSystem(scheme);
  }
}

/**
 * Mock implementation for testing purposes.
 */
export class MockFileSystem implements FileSystemProvider {
  private files = new Map<string, Uint8Array>();
  private stats = new Map<string, vscode.FileStat>();
  
  constructor() {
    // Initialize with some default behavior
  }

  /**
   * Set up a mock file with specific content for testing.
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
   */
  setMockStat(uri: vscode.Uri, stat: vscode.FileStat): void {
    this.stats.set(uri.toString(), stat);
  }

  /**
   * Set up a mock directory for testing.
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
   */
  setMockError(uri: vscode.Uri, error: Error): void {
    this.files.set(uri.toString(), error as any);
    this.stats.set(uri.toString(), error as any);
  }

  /**
   * Clear all mock data.
   */
  clearMocks(): void {
    this.files.clear();
    this.stats.clear();
  }

  /**
   * Get all mock file URIs for testing purposes.
   */
  getMockFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Check if a mock file exists.
   */
  hasMockFile(uri: vscode.Uri): boolean {
    return this.files.has(uri.toString());
  }

  /**
   * Get mock file content as string for testing.
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
      throw new Error(`File not found: ${uri.toString()}`);
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
      throw new Error(`File not found: ${uri.toString()}`);
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
  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const key = uri.toString();
    const stat = this.stats.get(key);
    
    if (!stat || stat instanceof Error || stat.type !== vscode.FileType.Directory) {
      throw new Error(`Directory not found: ${uri.toString()}`);
    }
    
    // Simple mock implementation - in real tests you'd set up specific files/directories
    const entries: [string, vscode.FileType][] = [];
    
    for (const [fileUriStr, _fileContent] of this.files) {
      const fileUri = vscode.Uri.parse(fileUriStr);
      if (fileUri.path.startsWith(uri.path) && fileUri.path !== uri.path) {
        const relativePath = fileUri.path.slice(uri.path.length + 1).split('/')[0];
        if (!entries.find(entry => entry[0] === relativePath)) {
          const fileStat = this.stats.get(fileUriStr);
          entries.push([relativePath, fileStat ? fileStat.type : vscode.FileType.File]);
        }
      }
    }
    
    return entries;
  }
  
  async delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
    const key = uri.toString();
    
    // In a more sophisticated mock, we could handle recursive deletion of directories
    // and simulate trash behavior, but for now we'll just acknowledge the options exist
    const recursive = options?.recursive ?? true;
    // useTrash option is acknowledged but not implemented in this mock
    
    if (this.files.has(key)) {
      this.files.delete(key);
      this.stats.delete(key);
      
      // If recursive, we could delete all files under this path
      if (recursive) {
        const pathToDelete = uri.path;
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
      throw new Error(`File not found: ${uri.toString()}`);
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
      throw new Error(`Source file not found: ${source.toString()}`);
    }
    
    // Check if target exists and overwrite is not allowed
    if (!options?.overwrite && (this.files.has(targetKey) || this.stats.has(targetKey))) {
      throw new Error(`Target file already exists: ${target.toString()}`);
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
      throw new Error(`Source file not found: ${source.toString()}`);
    }
    
    // Check if target exists and overwrite is not allowed
    if (!options?.overwrite && (this.files.has(targetKey) || this.stats.has(targetKey))) {
      throw new Error(`Target file already exists: ${target.toString()}`);
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
}