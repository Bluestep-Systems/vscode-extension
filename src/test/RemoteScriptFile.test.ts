import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { RemoteScriptFile } from '../main/app/util/script/RemoteScriptFile';
import { RemoteScriptRoot } from '../main/app/util/script/RemoteScriptRoot';
import { FileSystem } from '../main/app/util/fs/FileSystemFactory';
import { MockFileSystem } from '../main/app/util/fs/FileSystemProvider';
import { App } from '../main/app/App';

suite('RemoteScriptFile Tests', () => {
    let mockFileSystemProvider: MockFileSystem;
    let remoteScriptFile: RemoteScriptFile;
    let originalLogger: any;

    suiteSetup(() => {
        // Enable test mode with mock file system
        mockFileSystemProvider = FileSystem.enableTestMode();
        
        // Mock the App logger by overriding the getter
        const mockLogger = {
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            trace: () => {}
        };
        
        // Override the logger getter
        originalLogger = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(App), 'logger');
        Object.defineProperty(App, 'logger', {
            get: () => mockLogger,
            configurable: true
        });
    });

    suiteTeardown(() => {
        // Restore production mode and original logger
        FileSystem.enableProductionMode();
        if (originalLogger) {
            Object.defineProperty(App, 'logger', originalLogger);
        }
    });

    setup(() => {
        // Clear any previous mock data
        mockFileSystemProvider.clearMocks();

        // Create a mock file URI for the RemoteScriptRoot constructor
        // This must match the expected structure: /path/webdavid/(draft|declarations|.b6p_metadata.json)/filename
        const mockChildUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');

        // Create test RemoteScriptFile
        remoteScriptFile = new RemoteScriptFile({
            downstairsUri: mockChildUri
        });

        // Set up some default mock files
        const testContent = Buffer.from('console.log("test");');
        mockFileSystemProvider.setMockFile(mockChildUri, testContent);
        mockFileSystemProvider.setMockStat(mockChildUri, {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: testContent.length
        });
    });

  suite('File Type Detection', () => {
    test('should identify draft files correctly', () => {
      const draftUri = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const scriptFile = new RemoteScriptFile({ downstairsUri: draftUri });
      
      assert.strictEqual(scriptFile.isInDraft(), true);
      assert.strictEqual(scriptFile.isInDeclarations(), false);
    });

    test('should identify declarations files correctly', () => {
      const declarationsUri = vscode.Uri.file('/test/workspace/123/declarations/test-script.js');
      const scriptFile = new RemoteScriptFile({ downstairsUri: declarationsUri });
      
      assert.strictEqual(scriptFile.isInDeclarations(), true);
      assert.strictEqual(scriptFile.isInDraft(), false);
    });

    test('should get filename correctly', () => {
      const filename = remoteScriptFile.getFileName();
      
      assert.strictEqual(filename, 'test.js');
    });
  });

  suite('URI Operations', () => {
    test('should convert to downstairs URI correctly', () => {
      const expectedPath = path.join('/test/workspace/configbeh.bluestep.net/1466960', 'draft', 'test.js');
      const downstairsUri = remoteScriptFile.toDownstairsUri();
      
      // Normalize paths for cross-platform compatibility
      assert.strictEqual(
        path.normalize(downstairsUri.fsPath), 
        path.normalize(expectedPath)
      );
    });

    test('should throw error for metadata files when converting to upstairs URL', () => {
      const metadataUri = vscode.Uri.file('/test/workspace/123/.b6p_metadata.json');
      const scriptFile = new RemoteScriptFile({ downstairsUri: metadataUri });
      
      assert.throws(() => {
        scriptFile.toUpstairsURL();
      }, /Cannot determine the type of this file/);
    });
  });

  suite('Hash Calculation', () => {
    test('should calculate SHA-512 hash with correct format', async () => {
      // Test with known content to verify hash format
      const testContent = 'console.log("test");';
      
      // Calculate expected hash manually for verification
      const expectedHash = await calculateExpectedHash(testContent);
      
      // Set up mock file content
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      mockFileSystemProvider.setMockFile(testUri, Buffer.from(testContent));
      
      const hash = await remoteScriptFile.getHash();
      
      // Verify hash format (64 hex characters, lowercase)
      assert.ok(/^[a-f0-9]{128}$/.test(hash), 'Hash should be 128 lowercase hex characters');
      assert.strictEqual(hash, expectedHash);
    });

    test('should throw error if hash calculation fails', async () => {
      // Set up mock file to throw error
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      mockFileSystemProvider.setMockError(testUri, new Error('File read failed'));
      
      await assert.rejects(
        () => remoteScriptFile.getHash(),
        /File read failed/
      );
    });
  });

  suite('File Existence Checks', () => {
    test('should return true when file exists', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      const mockStat: vscode.FileStat = {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      };
      
      // Set up mock file stat
      mockFileSystemProvider.setMockStat(testUri, mockStat);
      
      const exists = await remoteScriptFile.exists();
      assert.strictEqual(exists, true);
    });

    test('should return false for directory when checking exists', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      const mockStat: vscode.FileStat = {
        type: vscode.FileType.Directory,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
      };
      
      // Set up mock directory stat
      mockFileSystemProvider.setMockStat(testUri, mockStat);
      
      const exists = await remoteScriptFile.exists();
      assert.strictEqual(exists, false);
    });

    test('should return false when file does not exist', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      
      // Set up mock to throw error for non-existent file
      mockFileSystemProvider.setMockError(testUri, new Error('File not found'));
      
      const exists = await remoteScriptFile.exists();
      assert.strictEqual(exists, false);
      
      const doesNotExist = await remoteScriptFile.fileDoesNotExist();
      assert.strictEqual(doesNotExist, true);
    });
  });

  suite('Content Operations', () => {
    test('should get downstairs content successfully', async () => {
      const testContent = 'console.log("test content");';
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      
      // Set up mock file content
      mockFileSystemProvider.setMockFile(testUri, Buffer.from(testContent));
      
      const content = await remoteScriptFile.getDownstairsContent();
      assert.strictEqual(content, testContent);
    });

    test('should handle error when reading downstairs content', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      
      // Set up mock to throw error
      mockFileSystemProvider.setMockError(testUri, new Error('Read failed'));
      
      await assert.rejects(
        () => remoteScriptFile.getDownstairsContent(),
        /Error reading downstairs file: Error: Read failed/
      );
    });

    test('should write content to file system', async () => {
      const testContent = 'test file content';
      const testBuffer = Buffer.from(testContent);
      
      // This test verifies that writeContent calls the file system wrapper
      await remoteScriptFile.writeContent(testBuffer.buffer);
      
      // Since we're using a mock, we can't easily verify the written content
      // but we can verify the call didn't throw an error
      assert.ok(true, 'writeContent should complete without error');
    });
  });

  suite('Equality Comparison', () => {
    test('should return true for equal script files with same path', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      
      const scriptFile1 = new RemoteScriptFile({ downstairsUri: uri1 });
      const scriptFile2 = new RemoteScriptFile({ downstairsUri: uri2 });
      
      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, true);
    });

    test('should return false for different script files', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/456/draft/other-script.js');
      
      const scriptFile1 = new RemoteScriptFile({ downstairsUri: uri1 });
      const scriptFile2 = new RemoteScriptFile({ downstairsUri: uri2 });
      
      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, false);
    });

    test('should return false for same webdav id but different file types', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/123/declarations/test-script.js');
      
      const scriptFile1 = new RemoteScriptFile({ downstairsUri: uri1 });
      const scriptFile2 = new RemoteScriptFile({ downstairsUri: uri2 });
      
      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, false);
    });
  });

  suite('ScriptRoot Operations', () => {
    test('should get script root', () => {
      const scriptRoot = remoteScriptFile.getScriptRoot();
      
      assert.ok(scriptRoot instanceof RemoteScriptRoot);
    });

    test('should allow overwriting script root for non-metadata files', () => {
      const newUri = vscode.Uri.file('/test/workspace/456/draft/new-script.js');
      const newRoot = new RemoteScriptRoot({ childUri: newUri });
      
      const result = remoteScriptFile.withScriptRoot(newRoot);
      
      assert.strictEqual(result, remoteScriptFile);
      assert.strictEqual(remoteScriptFile.getScriptRoot(), newRoot);
    });

    test('should throw error when trying to overwrite script root of metadata file', () => {
      const metadataUri = vscode.Uri.file('/test/workspace/configbeh.bluestep.net/123/.b6p_metadata.json');
      const metadataFile = new RemoteScriptFile({ downstairsUri: metadataUri });
      const newChildUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/other.js');
      const newRoot = new RemoteScriptRoot({ childUri: newChildUri });
      
      assert.throws(() => {
        metadataFile.withScriptRoot(newRoot);
      }, /Cannot overwrite script root of a metadata file/);
    });
  });

  suite('Time Operations', () => {
    test('should get last modified time from file stat', async () => {
      const testTime = Date.now();
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      const mockStat: vscode.FileStat = {
        type: vscode.FileType.File,
        ctime: testTime - 1000,
        mtime: testTime,
        size: 100
      };
      
      // Set up mock file stat
      mockFileSystemProvider.setMockStat(testUri, mockStat);
      
      const lastModified = await remoteScriptFile.lastModifiedTime();
      assert.strictEqual(lastModified.getTime(), testTime);
    });

    test('should throw error when getting last modified time of non-existent file', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      
      // Set up mock to throw error for non-existent file
      mockFileSystemProvider.setMockError(testUri, new Error('File not found'));
      
      await assert.rejects(
        () => remoteScriptFile.lastModifiedTime(),
        /File does not exist/
      );
    });
  });

  // Helper function to calculate expected hash for testing
  async function calculateExpectedHash(content: string): Promise<string> {
    const bufferSource = Buffer.from(content);
    const hashBuffer = await crypto.subtle.digest('SHA-512', bufferSource);
    const hexArray = Array.from(new Uint8Array(hashBuffer));
    return hexArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }
});
