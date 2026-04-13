import * as assert from 'assert';
import { MockFileSystem } from '@bluestep-systems/b6p-core';
import { B6PUri } from '@bluestep-systems/b6p-core';

suite('Core MockFileSystem Tests', () => {
  let mockFs: MockFileSystem;

  setup(() => {
    mockFs = new MockFileSystem();
  });

  suite('Basic File Operations', () => {
    test('should read a mock file', async () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      mockFs.setMockFile(uri, 'hello world');

      const content = await mockFs.readFile(uri);
      assert.strictEqual(Buffer.from(content).toString(), 'hello world');
    });

    test('should throw when reading non-existent file', async () => {
      const uri = B6PUri.fromFsPath('/test/missing.txt');
      await assert.rejects(() => mockFs.readFile(uri), /ENOENT/);
    });

    test('should write and read back a file', async () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      const content = Buffer.from('written content');

      await mockFs.writeFile(uri, content);
      const result = await mockFs.readFile(uri);

      assert.strictEqual(Buffer.from(result).toString(), 'written content');
    });

    test('should throw configured error', async () => {
      const uri = B6PUri.fromFsPath('/test/broken.txt');
      mockFs.setMockError(uri, new Error('disk failure'));

      await assert.rejects(() => mockFs.readFile(uri), /disk failure/);
      await assert.rejects(() => mockFs.stat(uri), /disk failure/);
    });
  });

  suite('Stat Operations', () => {
    test('should return file stat for mock file', async () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      mockFs.setMockFile(uri, 'content');

      const stat = await mockFs.stat(uri);
      assert.strictEqual(stat.type, 'file');
      assert.strictEqual(stat.size, 7);
      assert.ok(stat.mtime > 0);
    });

    test('should return directory stat for mock directory', async () => {
      const uri = B6PUri.fromFsPath('/test/dir');
      mockFs.setMockDirectory(uri);

      const stat = await mockFs.stat(uri);
      assert.strictEqual(stat.type, 'directory');
    });

    test('should allow custom stat values', async () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      mockFs.setMockFile(uri, 'content');
      mockFs.setMockStat(uri, { type: 'file', mtime: 12345, size: 999 });

      const stat = await mockFs.stat(uri);
      assert.strictEqual(stat.mtime, 12345);
      assert.strictEqual(stat.size, 999);
    });

    test('should throw for non-existent stat', async () => {
      const uri = B6PUri.fromFsPath('/test/missing.txt');
      await assert.rejects(() => mockFs.stat(uri), /ENOENT/);
    });
  });

  suite('Exists', () => {
    test('should return true for existing file', async () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      mockFs.setMockFile(uri, 'content');
      assert.strictEqual(await mockFs.exists(uri), true);
    });

    test('should return true for existing directory', async () => {
      const uri = B6PUri.fromFsPath('/test/dir');
      mockFs.setMockDirectory(uri);
      assert.strictEqual(await mockFs.exists(uri), true);
    });

    test('should return false for non-existent path', async () => {
      const uri = B6PUri.fromFsPath('/test/nope');
      assert.strictEqual(await mockFs.exists(uri), false);
    });
  });

  suite('Delete', () => {
    test('should delete a file', async () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      mockFs.setMockFile(uri, 'content');

      await mockFs.delete(uri);
      assert.strictEqual(await mockFs.exists(uri), false);
    });

    test('should delete recursively', async () => {
      const dir = B6PUri.fromFsPath('/test/dir');
      const child = B6PUri.fromFsPath('/test/dir/child.txt');
      mockFs.setMockDirectory(dir);
      mockFs.setMockFile(child, 'content');

      await mockFs.delete(dir, { recursive: true });
      assert.strictEqual(await mockFs.exists(dir), false);
      assert.strictEqual(await mockFs.exists(child), false);
    });

    test('should throw when deleting non-existent', async () => {
      const uri = B6PUri.fromFsPath('/test/nope');
      await assert.rejects(() => mockFs.delete(uri), /ENOENT/);
    });
  });

  suite('Copy and Rename', () => {
    test('should copy a file', async () => {
      const src = B6PUri.fromFsPath('/test/src.txt');
      const dst = B6PUri.fromFsPath('/test/dst.txt');
      mockFs.setMockFile(src, 'original');

      await mockFs.copy(src, dst);

      assert.strictEqual(Buffer.from(await mockFs.readFile(dst)).toString(), 'original');
      assert.strictEqual(await mockFs.exists(src), true);
    });

    test('should throw when copying to existing without overwrite', async () => {
      const src = B6PUri.fromFsPath('/test/src.txt');
      const dst = B6PUri.fromFsPath('/test/dst.txt');
      mockFs.setMockFile(src, 'original');
      mockFs.setMockFile(dst, 'existing');

      await assert.rejects(() => mockFs.copy(src, dst), /EEXIST/);
    });

    test('should rename a file', async () => {
      const src = B6PUri.fromFsPath('/test/old.txt');
      const dst = B6PUri.fromFsPath('/test/new.txt');
      mockFs.setMockFile(src, 'content');

      await mockFs.rename(src, dst);

      assert.strictEqual(await mockFs.exists(src), false);
      assert.strictEqual(Buffer.from(await mockFs.readFile(dst)).toString(), 'content');
    });
  });

  suite('Closest', () => {
    test('should find file in same directory', async () => {
      const start = B6PUri.fromFsPath('/project/src');
      const target = B6PUri.fromFsPath('/project/src/tsconfig.json');
      mockFs.setMockFile(target, '{}');

      const result = await mockFs.closest(start, 'tsconfig.json');
      assert.ok(result);
      assert.strictEqual(result.fsPath, target.fsPath);
    });

    test('should find file in parent directory', async () => {
      const start = B6PUri.fromFsPath('/project/src/components');
      const target = B6PUri.fromFsPath('/project/tsconfig.json');
      mockFs.setMockFile(target, '{}');

      const result = await mockFs.closest(start, 'tsconfig.json');
      assert.ok(result);
      assert.strictEqual(result.fsPath, target.fsPath);
    });

    test('should return null when not found', async () => {
      const start = B6PUri.fromFsPath('/project/src');
      const result = await mockFs.closest(start, 'nonexistent.json');
      assert.strictEqual(result, null);
    });

    test('should respect maxDepth', async () => {
      const start = B6PUri.fromFsPath('/a/b/c/d/e');
      const target = B6PUri.fromFsPath('/a/tsconfig.json');
      mockFs.setMockFile(target, '{}');

      const result = await mockFs.closest(start, 'tsconfig.json', 2);
      assert.strictEqual(result, null);
    });
  });

  suite('IsWritableFileSystem', () => {
    test('should return true for file scheme', () => {
      assert.strictEqual(mockFs.isWritableFileSystem('file'), true);
    });

    test('should return undefined for other schemes', () => {
      assert.strictEqual(mockFs.isWritableFileSystem('https'), undefined);
    });
  });

  suite('Helper Methods', () => {
    test('clearMocks should remove all files', async () => {
      mockFs.setMockFile(B6PUri.fromFsPath('/a.txt'), 'a');
      mockFs.setMockFile(B6PUri.fromFsPath('/b.txt'), 'b');

      mockFs.clearMocks();

      assert.strictEqual(await mockFs.exists(B6PUri.fromFsPath('/a.txt')), false);
      assert.strictEqual(await mockFs.exists(B6PUri.fromFsPath('/b.txt')), false);
    });

    test('setMockFiles should set multiple files', async () => {
      mockFs.setMockFiles({
        '/test/a.txt': 'alpha',
        '/test/b.txt': 'bravo',
      });

      assert.strictEqual(mockFs.getMockFileContent(B6PUri.fromFsPath('/test/a.txt')), 'alpha');
      assert.strictEqual(mockFs.getMockFileContent(B6PUri.fromFsPath('/test/b.txt')), 'bravo');
    });

    test('hasMockFile should check existence', () => {
      const uri = B6PUri.fromFsPath('/test/file.txt');
      assert.strictEqual(mockFs.hasMockFile(uri), false);
      mockFs.setMockFile(uri, 'content');
      assert.strictEqual(mockFs.hasMockFile(uri), true);
    });

    test('getMockFiles should list all file URIs', () => {
      mockFs.setMockFile(B6PUri.fromFsPath('/a.txt'), 'a');
      mockFs.setMockFile(B6PUri.fromFsPath('/b.txt'), 'b');

      const files = mockFs.getMockFiles();
      assert.strictEqual(files.length, 2);
    });
  });
});
