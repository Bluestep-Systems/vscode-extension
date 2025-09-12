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
    
    // Convert the pattern to a simple string match for mocking
    const includeStr = include.toString();
    
    for (const [uriStr] of this.files) {
      const uri = vscode.Uri.parse(uriStr);
      
      // Simple pattern matching - you could make this more sophisticated
      if (uriStr.includes(includeStr.replace('**/', '').replace('*', ''))) {
        results.push(uri);
        
        if (maxResults && results.length >= maxResults) {
          break;
        }
      }
    }
    
    return results;
  }
}