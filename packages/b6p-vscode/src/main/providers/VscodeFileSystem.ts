import * as vscode from 'vscode';
import type { IFileSystem, FileStat } from '../../core/providers';
import { B6PUri } from '../../core/B6PUri';

/**
 * VSCode implementation of the file system provider.
 * Wraps vscode.workspace.fs APIs.
 */
export class VscodeFileSystem implements IFileSystem {
  /** Convert B6PUri to vscode.Uri */
  private toVscodeUri(uri: B6PUri): vscode.Uri {
    if (uri.isFile) {
      return vscode.Uri.file(uri.fsPath);
    }
    return vscode.Uri.parse(uri.toString());
  }

  /** Convert vscode.Uri to B6PUri */
  private fromVscodeUri(uri: vscode.Uri): B6PUri {
    if (uri.scheme === 'file') {
      return B6PUri.fromFsPath(uri.fsPath);
    }
    return B6PUri.fromUrl(uri.toString());
  }

  async readFile(uri: B6PUri): Promise<Uint8Array> {
    return await vscode.workspace.fs.readFile(this.toVscodeUri(uri));
  }

  async writeFile(uri: B6PUri, content: Uint8Array): Promise<void> {
    await vscode.workspace.fs.writeFile(this.toVscodeUri(uri), content);
  }

  async stat(uri: B6PUri): Promise<FileStat> {
    const stat = await vscode.workspace.fs.stat(this.toVscodeUri(uri));
    return {
      type: stat.type === vscode.FileType.File ? 'file' : 'directory',
      mtime: stat.mtime,
      size: stat.size,
    };
  }

  async readDirectory(uri: B6PUri): Promise<[string, 'file' | 'directory'][]> {
    const entries = await vscode.workspace.fs.readDirectory(this.toVscodeUri(uri));
    return entries.map(([name, type]) => [
      name,
      type === vscode.FileType.File ? 'file' as const : 'directory' as const,
    ]);
  }

  async delete(uri: B6PUri, options?: { recursive?: boolean }): Promise<void> {
    await vscode.workspace.fs.delete(this.toVscodeUri(uri), options);
  }

  async createDirectory(uri: B6PUri): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.toVscodeUri(uri));
  }

  async exists(uri: B6PUri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.toVscodeUri(uri));
      return true;
    } catch {
      return false;
    }
  }

  async copy(source: B6PUri, target: B6PUri, options?: { overwrite?: boolean }): Promise<void> {
    await vscode.workspace.fs.copy(this.toVscodeUri(source), this.toVscodeUri(target), options);
  }

  async rename(source: B6PUri, target: B6PUri, options?: { overwrite?: boolean }): Promise<void> {
    await vscode.workspace.fs.rename(this.toVscodeUri(source), this.toVscodeUri(target), options);
  }

  async findFiles(base: B6PUri, include: string, exclude?: string): Promise<B6PUri[]> {
    const pattern = new vscode.RelativePattern(this.toVscodeUri(base), include);
    const excludePattern = exclude ? new vscode.RelativePattern(this.toVscodeUri(base), exclude) : undefined;
    const files = await vscode.workspace.findFiles(pattern, excludePattern);
    return files.map(uri => this.fromVscodeUri(uri));
  }

  async closest(startUri: B6PUri, fileName: string, maxDepth: number = 10): Promise<B6PUri | null> {
    let currentDir = this.toVscodeUri(startUri);
    let depth = 0;

    while (depth < maxDepth) {
      const targetFile = vscode.Uri.joinPath(currentDir, fileName);
      try {
        await vscode.workspace.fs.stat(targetFile);
        return this.fromVscodeUri(targetFile);
      } catch {
        // File doesn't exist in this directory, continue searching
      }

      const parentDir = vscode.Uri.joinPath(currentDir, '..');
      if (parentDir.path === currentDir.path) {
        break;
      }

      currentDir = parentDir;
      depth++;
    }

    return null;
  }

  isWritableFileSystem(scheme: string): boolean | undefined {
    return vscode.workspace.fs.isWritableFileSystem(scheme);
  }
}
