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
  delete(uri: vscode.Uri): Promise<void>; 

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
  async delete(uri: vscode.Uri): Promise<void> {
    return vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
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
  
  async delete(uri: vscode.Uri): Promise<void> {
    const key = uri.toString();
    if (this.files.has(key)) {
      this.files.delete(key);
      this.stats.delete(key);
    } else {
      throw new Error(`File not found: ${uri.toString()}`);
    }
  }
}