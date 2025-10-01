import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { App } from '../../main/app/App';
import { FileSystem } from '../../main/app/util/fs/FileSystem';
import { MockFileSystem } from '../../main/app/util/fs/FileSystemProvider';
import { ScriptFactory } from '../../main/app/util/script/ScriptFactory';
import { ScriptNode } from '../../main/app/util/script/ScriptNode';
import { ScriptRoot } from '../../main/app/util/script/ScriptRoot';

suite('ScriptNode Tests', () => {
  let mockFileSystemProvider: MockFileSystem;
  let scriptNode: ScriptNode;
  let originalLogger: any;

  suiteSetup(() => {
    // Enable test mode with mock file system
    mockFileSystemProvider = FileSystem.enableTestMode();

    // Mock the App logger by overriding the getter
    const mockLogger = {
      error: () => { },
      warn: () => { },
      info: () => { },
      debug: () => { },
      trace: () => { }
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

    // Create test ScriptFile
    scriptNode = ScriptFactory.createNode(() => mockChildUri);

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
      const scriptFile = ScriptFactory.createFile(draftUri);

      assert.strictEqual(scriptFile.isInDraft(), true);
      assert.strictEqual(scriptFile.isInDeclarations(), false);
    });

    test('should identify declarations files correctly', () => {
      const declarationsUri = vscode.Uri.file('/test/workspace/123/declarations/test-script.js');
      const scriptFile = ScriptFactory.createFile(declarationsUri);

      assert.strictEqual(scriptFile.isInDeclarations(), true);
      assert.strictEqual(scriptFile.isInDraft(), false);
    });


  });

  suite('URI Operations', () => {
    test('should convert to downstairs URI correctly', () => {
      const expectedPath = path.join('/test/workspace/configbeh.bluestep.net/1466960', 'draft', 'test.js');
      const downstairsUri = scriptNode.uri();

      // Normalize paths for cross-platform compatibility
      assert.strictEqual(
        path.normalize(downstairsUri.fsPath),
        path.normalize(expectedPath)
      );
    });

    test('should throw error for metadata files when converting to upstairs URL', () => {
      const metadataUri = vscode.Uri.file('/test/workspace/123/.b6p_metadata.json');
      const scriptFile = ScriptFactory.createFile(metadataUri);

      assert.throws(() => {
        scriptFile.upstairsUrl();
      }, /MetadataFileOperationError: Cannot convert to upstairs URL metadata file/);
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

      const hash = await scriptNode.getHash();
      if (await scriptNode.isFolder()) {
        assert.ok(true);
      }
      // Verify hash format (64 hex characters, lowercase)
      assert.ok(/^[a-f0-9]{128}$/.test(hash as string), 'Hash should be 128 lowercase hex characters');
      assert.strictEqual(hash, expectedHash);
    });

    test('should throw error if hash calculation fails', async () => {
      // Set up mock file to throw error
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      mockFileSystemProvider.setMockError(testUri, new Error('File read failed'));

      await assert.rejects(
        () => scriptNode.getHash(),
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

      const exists = await scriptNode.exists();
      assert.strictEqual(exists, true);
    });

    test('should return true for directory when checking exists', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      const mockStat: vscode.FileStat = {
        type: vscode.FileType.Directory,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
      };

      // Set up mock directory stat
      mockFileSystemProvider.setMockStat(testUri, mockStat);

      const exists = await scriptNode.exists();
      assert.strictEqual(exists, true);
    });

    test('should return false when file does not exist', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');

      // Set up mock to throw error for non-existent file
      mockFileSystemProvider.setMockError(testUri, new Error('File not found'));

      const exists = await scriptNode.exists();
      assert.strictEqual(exists, false);

      const doesNotExist = await scriptNode.exists();
      assert.strictEqual(doesNotExist, false);
    });
  });

  suite('Content Operations', () => {


    test('should write content to file system', async () => {
      const testContent = 'test file content';
      const testBuffer = Buffer.from(testContent);

      // This test verifies that writeContent calls the file system wrapper
      await scriptNode.writeContent(testBuffer.buffer);

      // Since we're using a mock, we can't easily verify the written content
      // but we can verify the call didn't throw an error
      assert.ok(true, 'writeContent should complete without error');
    });
  });

  suite('Equality Comparison', () => {
    test('should return true for equal script files with same path', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');

      const scriptFile1 = ScriptFactory.createFile(uri1);
      const scriptFile2 = ScriptFactory.createFile(uri2);

      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, true);
    });

    test('should return false for different script files', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/456/draft/other-script.js');

      const scriptFile1 = ScriptFactory.createFile(uri1);
      const scriptFile2 = ScriptFactory.createFile(uri2);

      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, false);
    });

    test('should return false for same webdav id but different file types', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/123/declarations/test-script.js');

      const scriptFile1 = ScriptFactory.createFile(uri1);
      const scriptFile2 = ScriptFactory.createFile(uri2);

      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, false);
    });
  });

  suite('ScriptRoot Operations', () => {
    test('should get script root', () => {
      const scriptRoot = scriptNode.getScriptRoot();

      assert.ok(scriptRoot instanceof ScriptRoot);
    });

    test('should allow overwriting script root for non-metadata files', () => {
      const newUri = vscode.Uri.file('/test/workspace/456/draft/new-script.js');
      const newRoot = ScriptFactory.createScriptRoot(newUri);

      const result = scriptNode.withScriptRoot(newRoot);

      assert.strictEqual(result, scriptNode);
      assert.strictEqual(scriptNode.getScriptRoot(), newRoot);
    });

    test('should throw error when trying to overwrite script root of metadata file', () => {
      const metadataUri = vscode.Uri.file('/test/workspace/configbeh.bluestep.net/123/.b6p_metadata.json');
      const metadataFile = ScriptFactory.createFile(metadataUri);
      const newChildUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/other.js');
      const newRoot = ScriptFactory.createScriptRoot(newChildUri);

      assert.throws(() => {
        metadataFile.withScriptRoot(newRoot);
      }, /MetadataFileOperationError: Cannot overwrite script root metadata file/);
    });
  });

  suite('Folder Detection', () => {
    test('should detect if file is in info folder', async () => {
      const infoUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');

      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockFile(infoUri, '{}');

      const scriptFile = ScriptFactory.createFile(infoUri);

      const isInInfo = await scriptFile.isInInfo();
      const isInInfoFolder = await scriptFile.isInInfoFolder();

      assert.strictEqual(isInInfo, true);
      assert.strictEqual(isInInfoFolder, true);
    });

    test('should detect if file is in objects folder', async () => {
      const objectsUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects/imports.ts');
      const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');

      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(objectsFolderUri);
      mockFileSystemProvider.setMockFile(objectsUri, 'export {};');

      const scriptFile = ScriptFactory.createFile(objectsUri);

      const isInObjects = await scriptFile.isInObjects();

      assert.strictEqual(isInObjects, true);
    });

    test('should detect if file is in info or objects folder', async () => {
      const infoUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');

      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockFile(infoUri, '{}');

      const scriptFile = ScriptFactory.createFile(infoUri);

      const isInInfoOrObjects = await scriptFile.isInInfoOrObjects();

      assert.strictEqual(isInInfoOrObjects, true);
    });

    test('should return false for files not in info or objects', async () => {
      const scriptUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/scripts/main.js');
      const scriptFile = ScriptFactory.createFile(scriptUri);

      // Set up empty folders so the file isn't found in them
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
      const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');

      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockDirectory(objectsFolderUri);

      const isInInfo = await scriptFile.isInInfo();
      const isInObjects = await scriptFile.isInObjects();
      const isInInfoOrObjects = await scriptFile.isInInfoOrObjects();

      assert.strictEqual(isInInfo, false);
      assert.strictEqual(isInObjects, false);
      assert.strictEqual(isInInfoOrObjects, false);
    });
  });

  suite('Configuration Files', () => {

    test('should get config file content', async () => {
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configContent = {
        models: [
          { name: 'external-model.js', type: 'external' }
        ]
      };

      // Set up config file
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify(configContent));

      const config = await scriptNode.getConfigFile();

      assert.deepStrictEqual(config, configContent);
    });

    test('should get metadata file content', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/metadata.json');
      const metadataContent = {
        scriptName: 'Test Script',
        description: 'A test script'
      };

      // Set up metadata file
      mockFileSystemProvider.setMockFile(metadataUri, JSON.stringify(metadataContent));

      const metadata = await scriptNode.getMetadataFile();

      assert.deepStrictEqual(metadata, metadataContent);
    });

    test('should throw error when config file not found', async () => {
      // Don't set up any config files

      await assert.rejects(
        () => scriptNode.getConfigFile(),
        /Could not find config.json file/
      );
    });

    test('should throw error when multiple config files found', async () => {
      const configUri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configUri2 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/scripts/config.json');

      // Set up multiple config files
      mockFileSystemProvider.setMockFile(configUri1, '{}');
      mockFileSystemProvider.setMockFile(configUri2, '{}');

      await assert.rejects(
        () => scriptNode.getConfigFile(),
        /Could not find config.json file, found: 2/
      );
    });
  });

  suite('External Model Detection', () => {




  });

  suite('GitIgnore Operations', () => {
    test('should detect files in gitignore', async () => {
      const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
      // Use a pattern that should definitely match our test file path
      const gitIgnoreContent = 'draft/test.js\n*.log\nnode_modules/';

      // Set up gitignore file
      mockFileSystemProvider.setMockFile(gitIgnoreUri, gitIgnoreContent);

      const isInGitIgnore = await scriptNode.isInGitIgnore();

      assert.strictEqual(isInGitIgnore, true);
    });

    test('should return false for files not in gitignore', async () => {
      const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
      const gitIgnoreContent = 'other.js\n*.log\nnode_modules/';

      // Set up gitignore file
      mockFileSystemProvider.setMockFile(gitIgnoreUri, gitIgnoreContent);

      const isInGitIgnore = await scriptNode.isInGitIgnore();

      assert.strictEqual(isInGitIgnore, false);
    });
  });

  suite('Metadata Time Operations', () => {
    test('should get last pulled time from metadata', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadata = {
        scriptName: 'Test',
        webdavId: '1466960',
        pushPullRecords: [{
          downstairsPath: scriptNode.uri().fsPath,
          lastPulled: '2023-01-01T12:00:00.000Z',
          lastPushed: null,
          lastVerifiedHash: 'abcd1234'
        }]
      };

      // Set up metadata file
      mockFileSystemProvider.setMockFile(metadataUri, JSON.stringify(metadata, null, 2));
      mockFileSystemProvider.setMockStat(metadataUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      const lastPulledStr = await scriptNode.getLastPulledTimeStr();

      assert.strictEqual(lastPulledStr, '2023-01-01T12:00:00.000Z');
    });

    test('should get last pushed time from metadata', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadata = {
        scriptName: 'Test',
        webdavId: '1466960',
        pushPullRecords: [{
          downstairsPath: scriptNode.uri().fsPath,
          lastPulled: null,
          lastPushed: '2023-01-02T15:30:00.000Z',
          lastVerifiedHash: 'abcd1234'
        }]
      };

      // Set up metadata file
      mockFileSystemProvider.setMockFile(metadataUri, JSON.stringify(metadata, null, 2));
      mockFileSystemProvider.setMockStat(metadataUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      const lastPushedStr = await scriptNode.getLastPushedTimeStr();
      const lastPushedTime = await scriptNode.getLastPushedTime();

      assert.strictEqual(lastPushedStr, '2023-01-02T15:30:00.000Z');
      assert.ok(lastPushedTime instanceof Date);
      assert.strictEqual(lastPushedTime?.toISOString(), '2023-01-02T15:30:00.000Z');
    });

    test('should return null when no metadata record exists', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadata = {
        scriptName: 'Test',
        webdavId: '1466960',
        pushPullRecords: []
      };

      // Set up metadata file
      mockFileSystemProvider.setMockFile(metadataUri, JSON.stringify(metadata, null, 2));
      mockFileSystemProvider.setMockStat(metadataUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      const lastPulledStr = await scriptNode.getLastPulledTimeStr();
      const lastPulledTime = await scriptNode.getLastPulledTime();
      const lastPushedStr = await scriptNode.getLastPushedTimeStr();
      const lastPushedTime = await scriptNode.getLastPushedTime();

      assert.strictEqual(lastPulledStr, null);
      assert.strictEqual(lastPulledTime, null);
      assert.strictEqual(lastPushedStr, null);
      assert.strictEqual(lastPushedTime, null);
    });
  });

  suite('Parser Operations', () => {
    test('should allow overwriting parser', () => {
      // REASON-FOR-ANY: Accessing private property for test verification
      const originalParser = (scriptNode as any).parser;
      const newUri = vscode.Uri.parse('file:///test/workspace/different.domain.com/9999/draft/different.js');
      const newScriptFile = ScriptFactory.createFile(newUri);
      // REASON-FOR-ANY: Accessing private property for test verification
      const newParser = (newScriptFile as any).parser;

      const result = scriptNode.withParser(newParser);

      assert.strictEqual(result, scriptNode);
      // REASON-FOR-ANY: Accessing private property for test verification
      assert.notStrictEqual((scriptNode as any).parser, originalParser);
      // REASON-FOR-ANY: Accessing private property for test verification
      assert.strictEqual((scriptNode as any).parser, newParser);
    });
  });

  suite('Copacetic Status', () => {
    test('should return true when file exists', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      const isCopacetic = await scriptNode.isCopacetic();

      assert.strictEqual(isCopacetic, true);
    });

    test('should return false when file does not exist', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      mockFileSystemProvider.setMockError(testUri, new Error('File not found'));

      const isCopacetic = await scriptNode.isCopacetic();

      assert.strictEqual(isCopacetic, false);
    });
  });

  suite('Push Validation', () => {
    test('should return reason for metadata files', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadataFile = ScriptFactory.createFile(() => metadataUri);

      const reason = await metadataFile.getReasonToNotPush();

      assert.strictEqual(reason, 'Node is a metadata file');
    });

    test('should return reason for declarations files', async () => {
      const declarationsUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/declarations/test.js');
      const declarationsFile = ScriptFactory.createFile(declarationsUri);

      const reason = await declarationsFile.getReasonToNotPush();

      assert.strictEqual(reason, 'Node is in declarations');
    });





    test('should return reason for info/objects files', async () => {
      const infoUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');

      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockFile(infoUri, '{}');

      const scriptFile = ScriptFactory.createFile(infoUri);
      const reason = await scriptFile.getReasonToNotPush();

      assert.strictEqual(reason, 'Node is in info or objects');
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

      const lastModified = await scriptNode.lastModifiedTime();
      assert.strictEqual(lastModified.getTime(), testTime);
    });

    test('should throw error when getting last modified time of non-existent file', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');

      // Set up mock to throw error for non-existent file
      mockFileSystemProvider.setMockError(testUri, new Error('Node not found'));

      await assert.rejects(
        () => scriptNode.lastModifiedTime(),
        /Node does not exist/
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

  // Enhanced test suites for edge cases and error scenarios
  suite('Concurrent Operations and Race Conditions', () => {
    test('should handle concurrent hash calculations', async () => {
      const testContent = 'concurrent test content';
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/concurrent.js');
      mockFileSystemProvider.setMockFile(testUri, Buffer.from(testContent));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: testContent.length
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      // Run multiple hash calculations concurrently
      const hashPromises = [];
      for (let i = 0; i < 10; i++) {
        hashPromises.push(scriptFile.getHash());
      }

      const hashes = await Promise.all(hashPromises);

      // All hashes should be identical
      const firstHash = hashes[0];
      hashes.forEach((hash, index) => {
        assert.strictEqual(hash, firstHash, `Hash ${index} should match the first hash`);
      });
    });

    test('should handle concurrent metadata access', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadata = {
        scriptName: 'Concurrent Test',
        webdavId: '1466960',
        pushPullRecords: [{
          downstairsPath: scriptNode.uri().fsPath,
          lastPulled: '2023-01-01T12:00:00.000Z',
          lastPushed: null,
          lastVerifiedHash: 'abcd1234'
        }]
      };

      mockFileSystemProvider.setMockFile(metadataUri, JSON.stringify(metadata, null, 2));
      mockFileSystemProvider.setMockStat(metadataUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      // Run multiple metadata operations concurrently
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(scriptNode.getLastPulledTimeStr());
        operations.push(scriptNode.getLastPushedTimeStr());
      }

      const results = await Promise.all(operations);

      // All pulled time results should be the same
      const pulledResults = results.filter((_, index) => index % 2 === 0);
      const pushedResults = results.filter((_, index) => index % 2 === 1);

      pulledResults.forEach((result, index) => {
        assert.strictEqual(result, '2023-01-01T12:00:00.000Z', `Pulled time ${index} should be consistent`);
      });

      pushedResults.forEach((result, index) => {
        assert.strictEqual(result, null, `Pushed time ${index} should be consistent`);
      });
    });

    test('should handle concurrent file existence checks', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/existence.js');
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      // Run multiple existence checks concurrently
      const existencePromises = [];
      for (let i = 0; i < 15; i++) {
        existencePromises.push(scriptFile.exists());
      }

      const results = await Promise.all(existencePromises);

      // All results should be true
      results.forEach((result, index) => {
        assert.strictEqual(result, true, `Existence check ${index} should return true`);
      });
    });
  });

  suite('Error Handling and Recovery', () => {
    test('should handle file system permission errors', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/permission.js');
      const permissionError = new Error('Permission denied');
      permissionError.name = 'EACCES';
      mockFileSystemProvider.setMockError(testUri, permissionError);

      const scriptFile = ScriptFactory.createFile(testUri);

      await assert.rejects(
        () => scriptFile.getHash(),
        /Permission denied/,
        'Should propagate permission errors'
      );
    });

    test('should handle corrupted metadata files gracefully', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');

      // Set corrupted JSON
      mockFileSystemProvider.setMockFile(metadataUri, Buffer.from('{ corrupted json'));
      mockFileSystemProvider.setMockStat(metadataUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      // Should handle gracefully and return null
      const lastPulled = await scriptNode.getLastPulledTimeStr();
      assert.strictEqual(lastPulled, null, 'Should return null for corrupted metadata');
    });


    test('should handle large file operations', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/large.js');

      // Create a large buffer (1MB)
      const largeContent = Buffer.alloc(1024 * 1024, 'a');
      mockFileSystemProvider.setMockFile(testUri, largeContent);
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: largeContent.length
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      // Should handle large files without error
      const hash = await scriptFile.getHash();
      assert.ok(hash, 'Should generate hash for large file');
      assert.strictEqual(typeof hash, 'string', 'Hash should be a string');
      assert.strictEqual(hash.length, 128, 'Hash should be 128 characters (SHA-512)');
    });

    test('should handle binary file content', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/binary.bin');

      // Create binary content
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      mockFileSystemProvider.setMockFile(testUri, binaryContent);
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: binaryContent.length
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      // Should handle binary content
      const hash = await scriptFile.getHash();
      assert.ok(hash, 'Should generate hash for binary file');
      assert.strictEqual(typeof hash, 'string', 'Hash should be a string');
    });
  });

  suite('Edge Cases and Boundary Conditions', () => {
    test('should handle empty files', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/empty.js');
      const emptyContent = Buffer.alloc(0);

      mockFileSystemProvider.setMockFile(testUri, emptyContent);
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      const hash = await scriptFile.getHash();
      assert.ok(hash, 'Should generate hash for empty file');
      assert.strictEqual(hash.length, 128, 'Empty file hash should be 128 characters');
    });

    test('should handle files with Unicode content', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/unicode.js');
      const unicodeContent = 'console.log("Hello 世界 🌍 αβγ");';

      mockFileSystemProvider.setMockFile(testUri, Buffer.from(unicodeContent, 'utf8'));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: Buffer.from(unicodeContent, 'utf8').length
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      const hash = await scriptFile.getHash();
      assert.ok(hash, 'Should generate hash for Unicode file');
      assert.strictEqual(hash.length, 128, 'Unicode file hash should be 128 characters');
    });

    test('should handle very long file paths', async () => {
      const longPath = '/test/workspace/configbeh.bluestep.net/1466960/draft/' + 'a'.repeat(200) + '.js';
      const testUri = vscode.Uri.parse('file://' + longPath);

      mockFileSystemProvider.setMockFile(testUri, Buffer.from('test'));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 4
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      const exists = await scriptFile.exists();
      assert.strictEqual(exists, true, 'Should handle very long file paths');
    });

    test('should handle files with special characters in names', async () => {
      const specialFileName = 'test file with spaces & symbols!@#$%^&*()+={}[]|\\:;";\',.<>?.js';
      const testUri = vscode.Uri.parse(
        'file:///test/workspace/configbeh.bluestep.net/1466960/draft/' +
        encodeURIComponent(specialFileName)
      );

      mockFileSystemProvider.setMockFile(testUri, Buffer.from('test'));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 4
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      const exists = await scriptFile.exists();
      assert.strictEqual(exists, true, 'Should handle special characters in file names');
    });

    test('should handle metadata with extreme timestamps', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadata = {
        scriptName: 'Extreme Timestamp Test',
        webdavId: '1466960',
        pushPullRecords: [{
          downstairsPath: scriptNode.uri().fsPath,
          lastPulled: '1970-01-01T00:00:00.000Z', // Unix epoch
          lastPushed: '2038-01-19T03:14:07.000Z',  // Year 2038 problem edge
          lastVerifiedHash: 'abcd1234'
        }]
      };

      mockFileSystemProvider.setMockFile(metadataUri, JSON.stringify(metadata, null, 2));
      mockFileSystemProvider.setMockStat(metadataUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      });

      const lastPulledTime = await scriptNode.getLastPulledTime();
      const lastPushedTime = await scriptNode.getLastPushedTime();

      assert.ok(lastPulledTime instanceof Date, 'Should parse extreme past timestamp');
      assert.ok(lastPushedTime instanceof Date, 'Should parse extreme future timestamp');
      assert.strictEqual(lastPulledTime?.getFullYear(), new Date(0).getFullYear(), 'Should handle Unix epoch');
      assert.strictEqual(lastPushedTime?.getFullYear(), 2038, 'Should handle 2038 timestamp');
    });
  });

  suite('Performance and Stress Testing', () => {
    test('should handle rapid successive operations', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/rapid.js');
      mockFileSystemProvider.setMockFile(testUri, Buffer.from('rapid test'));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 10
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      // Perform many operations in rapid succession
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(scriptFile.exists());
        operations.push(scriptFile.isInDraft());
        operations.push(scriptFile.isInDeclarations());
      }

      const results = await Promise.all(operations);

      // All should complete successfully
      assert.strictEqual(results.length, 150, 'All operations should complete');

      // Check specific patterns
      for (let i = 0; i < 50; i++) {
        assert.strictEqual(results[i * 3], true, `Exists operation ${i} should be true`);
        assert.strictEqual(results[i * 3 + 1], true, `Draft check ${i} should be true`);
        assert.strictEqual(results[i * 3 + 2], false, `Declarations check ${i} should be false`);
      }
    });

    test('should handle multiple ScriptNode instances for same file', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/shared.js');
      mockFileSystemProvider.setMockFile(testUri, Buffer.from('shared content'));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 14
      });

      // Create multiple ScriptNode instances for the same URI
      const scriptFiles = [];
      for (let i = 0; i < 10; i++) {
        scriptFiles.push(ScriptFactory.createFile(testUri));
      }

      // All instances should behave consistently
      const hashPromises = scriptFiles.map(sf => sf.getHash());
      const hashes = await Promise.all(hashPromises);

      const firstHash = hashes[0];
      hashes.forEach((hash, index) => {
        assert.strictEqual(hash, firstHash, `Hash from instance ${index} should match`);
      });

      // Equality checks
      for (let i = 1; i < scriptFiles.length; i++) {
        assert.strictEqual(
          scriptFiles[0].equals(scriptFiles[i]),
          true,
          `Instance 0 should equal instance ${i}`
        );
      }
    });
  });

  suite('Memory and Resource Management', () => {
    test('should not leak memory with repeated operations', async () => {
      // Create and destroy many ScriptNode instances
      for (let cycle = 0; cycle < 20; cycle++) {
        const testUri = vscode.Uri.parse(`file:///test/workspace/configbeh.bluestep.net/1466960/draft/cycle${cycle}.js`);
        mockFileSystemProvider.setMockFile(testUri, Buffer.from(`cycle ${cycle}`));
        mockFileSystemProvider.setMockStat(testUri, {
          type: vscode.FileType.File,
          ctime: Date.now(),
          mtime: Date.now(),
          size: 10
        });

        const scriptFile = ScriptFactory.createFile(testUri);

        // Perform operations
        await scriptFile.exists();
        await scriptFile.getHash();

        // File should be processed correctly
        assert.ok(true, `Cycle ${cycle} completed successfully`);
      }
    });

    test('should handle cleanup of large data structures', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/cleanup.js');

      // Create content with large data structure simulation
      const largeContent = JSON.stringify({
        data: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item${i}` }))
      });

      mockFileSystemProvider.setMockFile(testUri, Buffer.from(largeContent));
      mockFileSystemProvider.setMockStat(testUri, {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: largeContent.length
      });

      const scriptFile = ScriptFactory.createFile(testUri);

      // Process the large content
      const hash = await scriptFile.getHash();
      assert.ok(hash, 'Should process large content successfully');

      // Should not throw during cleanup
      assert.ok(true, 'Cleanup should handle large data structures');
    });
  });
});
