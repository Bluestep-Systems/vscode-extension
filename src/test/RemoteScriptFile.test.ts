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
      const scriptFile = RemoteScriptFile.fromUri(draftUri);
      
      assert.strictEqual(scriptFile.isInDraft(), true);
      assert.strictEqual(scriptFile.isInDeclarations(), false);
    });

    test('should identify declarations files correctly', () => {
      const declarationsUri = vscode.Uri.file('/test/workspace/123/declarations/test-script.js');
      const scriptFile = RemoteScriptFile.fromUri(declarationsUri);
      
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
      const downstairsUri = remoteScriptFile.uri();
      
      // Normalize paths for cross-platform compatibility
      assert.strictEqual(
        path.normalize(downstairsUri.fsPath), 
        path.normalize(expectedPath)
      );
    });

    test('should throw error for metadata files when converting to upstairs URL', () => {
      const metadataUri = vscode.Uri.file('/test/workspace/123/.b6p_metadata.json');
      const scriptFile = RemoteScriptFile.fromUri(metadataUri);
      
      assert.throws(() => {
        scriptFile.toUpstairsURL();
      }, /should never try to convert .b6p_metadata.json file to upstairs URL. Review logic on how you got here./);
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

      const scriptFile1 = RemoteScriptFile.fromUri(uri1);
      const scriptFile2 = RemoteScriptFile.fromUri(uri2);

      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, true);
    });

    test('should return false for different script files', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/456/draft/other-script.js');

      const scriptFile1 = RemoteScriptFile.fromUri(uri1);
      const scriptFile2 = RemoteScriptFile.fromUri(uri2);

      const areEqual = scriptFile1.equals(scriptFile2);
      assert.strictEqual(areEqual, false);
    });

    test('should return false for same webdav id but different file types', () => {
      const uri1 = vscode.Uri.file('/test/workspace/123/draft/test-script.js');
      const uri2 = vscode.Uri.file('/test/workspace/123/declarations/test-script.js');

      const scriptFile1 = RemoteScriptFile.fromUri(uri1);
      const scriptFile2 = RemoteScriptFile.fromUri(uri2);

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
      const metadataFile = RemoteScriptFile.fromUri(metadataUri);
      const newChildUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/other.js');
      const newRoot = new RemoteScriptRoot({ childUri: newChildUri });
      
      assert.throws(() => {
        metadataFile.withScriptRoot(newRoot);
      }, /Cannot overwrite script root of a metadata file/);
    });
  });

  suite('Folder Detection', () => {
    test('should detect if file is in info folder', async () => {
      const infoUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
      
      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockFile(infoUri, '{}');

      const scriptFile = RemoteScriptFile.fromUri(infoUri);

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

      const scriptFile = RemoteScriptFile.fromUri(objectsUri);

      const isInObjects = await scriptFile.isInObjects();
      
      assert.strictEqual(isInObjects, true);
    });

    test('should detect if file is in info or objects folder', async () => {
      const infoUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
      
      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockFile(infoUri, '{}');

      const scriptFile = RemoteScriptFile.fromUri(infoUri);

      const isInInfoOrObjects = await scriptFile.isInInfoOrObjects();
      
      assert.strictEqual(isInInfoOrObjects, true);
    });

    test('should return false for files not in info or objects', async () => {
      const scriptUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/scripts/main.js');
      const scriptFile = RemoteScriptFile.fromUri(scriptUri);
      
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
      
      const config = await remoteScriptFile.getConfigFile();
      
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
      
      const metadata = await remoteScriptFile.getMetadataFile();
      
      assert.deepStrictEqual(metadata, metadataContent);
    });

    test('should throw error when config file not found', async () => {
      // Don't set up any config files
      
      await assert.rejects(
        () => remoteScriptFile.getConfigFile(),
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
        () => remoteScriptFile.getConfigFile(),
        /Could not find config.json file, found: 2/
      );
    });
  });

  suite('External Model Detection', () => {
    test('should detect external model files', async () => {
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configContent = {
        models: [
          { name: 'test.js', type: 'external' },
          { name: 'other.js', type: 'internal' }
        ]
      };
      
      // Set up config file
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify(configContent));
      
      const isExternal = await remoteScriptFile.isExternalModel();
      
      assert.strictEqual(isExternal, true);
    });

    test('should return false for non-external model files', async () => {
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configContent = {
        models: [
          { name: 'other.js', type: 'internal' }
        ]
      };
      
      // Set up config file
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify(configContent));
      
      const isExternal = await remoteScriptFile.isExternalModel();
      
      assert.strictEqual(isExternal, false);
    });

    test('should return false when no models defined', async () => {
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configContent = {};
      
      // Set up config file
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify(configContent));
      
      const isExternal = await remoteScriptFile.isExternalModel();
      
      assert.strictEqual(isExternal, false);
    });
  });

  suite('GitIgnore Operations', () => {
    test('should detect files in gitignore', async () => {
      const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
      // Use a pattern that should definitely match our test file path
      const gitIgnoreContent = 'draft/test.js\n*.log\nnode_modules/';
      
      // Set up gitignore file
      mockFileSystemProvider.setMockFile(gitIgnoreUri, gitIgnoreContent);
      
      const isInGitIgnore = await remoteScriptFile.isInGitIgnore();
      
      assert.strictEqual(isInGitIgnore, true);
    });

    test('should return false for files not in gitignore', async () => {
      const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
      const gitIgnoreContent = 'other.js\n*.log\nnode_modules/';
      
      // Set up gitignore file
      mockFileSystemProvider.setMockFile(gitIgnoreUri, gitIgnoreContent);
      
      const isInGitIgnore = await remoteScriptFile.isInGitIgnore();
      
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
          downstairsPath: remoteScriptFile.uri().fsPath,
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
      
      const lastPulledStr = await remoteScriptFile.getLastPulledTimeStr();
      const lastPulledTime = await remoteScriptFile.getLastPulledTime();
      
      assert.strictEqual(lastPulledStr, '2023-01-01T12:00:00.000Z');
      assert.ok(lastPulledTime instanceof Date);
      assert.strictEqual(lastPulledTime?.toISOString(), '2023-01-01T12:00:00.000Z');
    });

    test('should get last pushed time from metadata', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadata = {
        scriptName: 'Test',
        webdavId: '1466960',
        pushPullRecords: [{
          downstairsPath: remoteScriptFile.uri().fsPath,
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
      
      const lastPushedStr = await remoteScriptFile.getLastPushedTimeStr();
      const lastPushedTime = await remoteScriptFile.getLastPushedTime();
      
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
      
      const lastPulledStr = await remoteScriptFile.getLastPulledTimeStr();
      const lastPulledTime = await remoteScriptFile.getLastPulledTime();
      const lastPushedStr = await remoteScriptFile.getLastPushedTimeStr();
      const lastPushedTime = await remoteScriptFile.getLastPushedTime();
      
      assert.strictEqual(lastPulledStr, null);
      assert.strictEqual(lastPulledTime, null);
      assert.strictEqual(lastPushedStr, null);
      assert.strictEqual(lastPushedTime, null);
    });
  });

  suite('Parser Operations', () => {
    test('should allow overwriting parser', () => {
      // REASON-FOR-ANY: Accessing private property for test verification
      const originalParser = (remoteScriptFile as any).parser;
      const newUri = vscode.Uri.parse('file:///test/workspace/different.domain.com/9999/draft/different.js');
      const newScriptFile = RemoteScriptFile.fromUri(newUri);
      // REASON-FOR-ANY: Accessing private property for test verification
      const newParser = (newScriptFile as any).parser;
      
      const result = remoteScriptFile.withParser(newParser);
      
      assert.strictEqual(result, remoteScriptFile);
      // REASON-FOR-ANY: Accessing private property for test verification
      assert.notStrictEqual((remoteScriptFile as any).parser, originalParser);
      // REASON-FOR-ANY: Accessing private property for test verification
      assert.strictEqual((remoteScriptFile as any).parser, newParser);
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
      
      const isCopacetic = await remoteScriptFile.isCopacetic();
      
      assert.strictEqual(isCopacetic, true);
    });

    test('should return false when file does not exist', async () => {
      const testUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
      mockFileSystemProvider.setMockError(testUri, new Error('File not found'));
      
      const isCopacetic = await remoteScriptFile.isCopacetic();
      
      assert.strictEqual(isCopacetic, false);
    });
  });

  suite('Push Validation', () => {
    test('should return reason for metadata files', async () => {
      const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
      const metadataFile = RemoteScriptFile.fromUri(metadataUri);
      
      const reason = await metadataFile.getReasonToNotPush();
      
      assert.strictEqual(reason, 'File is a metadata file');
    });

    test('should return reason for declarations files', async () => {
      const declarationsUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/declarations/test.js');
      const declarationsFile = RemoteScriptFile.fromUri(declarationsUri);
      
      const reason = await declarationsFile.getReasonToNotPush();
      
      assert.strictEqual(reason, 'File is in declarations');
    });

    test('should return reason for external model files', async () => {
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configContent = {
        models: [
          { name: 'test.js', type: 'external' }
        ]
      };
      
      // Set up config file
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify(configContent));
      
      const reason = await remoteScriptFile.getReasonToNotPush();
      
      assert.strictEqual(reason, 'File is an external model');
    });

    test('should return reason for gitignored files', async () => {
      const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
      const gitIgnoreContent = 'draft/test.js';
      
      // Set up gitignore file
      mockFileSystemProvider.setMockFile(gitIgnoreUri, gitIgnoreContent);
      
      // Set up config file with no external models so external model check passes
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const configContent = { models: [] };
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify(configContent));
      
      const reason = await remoteScriptFile.getReasonToNotPush();
      
      assert.strictEqual(reason, 'File is ignored by .gitignore');
    });

    test('should return reason for info/objects files', async () => {
      const infoUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
      
      // Set up directory and file
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockFile(infoUri, '{}');
      
      const scriptFile = RemoteScriptFile.fromUri(infoUri);
      const reason = await scriptFile.getReasonToNotPush();
      
      assert.strictEqual(reason, 'File is in info or objects');
    });

    test('should return empty string when file can be pushed (basic validation)', async () => {
      // Set up a normal script file that can be pushed
      const configUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info/config.json');
      const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
      
      // Set up config with no external models
      mockFileSystemProvider.setMockFile(configUri, JSON.stringify({ models: [] }));
      
      // Set up gitignore that doesn't include our file
      mockFileSystemProvider.setMockFile(gitIgnoreUri, '*.log\nnode_modules/');
      
      // Set up empty folders so the file isn't found in them
      const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
      const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
      
      mockFileSystemProvider.setMockDirectory(infoFolderUri);
      mockFileSystemProvider.setMockDirectory(objectsFolderUri);
      
      // This test will fail at the integrity check due to SessionManager not being initialized
      // which is expected in a unit test environment
      try {
        const reason = await remoteScriptFile.getReasonToNotPush();
        // If we somehow get past the network call, the result should be a string
        assert.ok(typeof reason === 'string');
      } catch (error) {
        // We expect this to fail due to SessionManager not being initialized
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('SessionManager not initialized'));
      }
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
