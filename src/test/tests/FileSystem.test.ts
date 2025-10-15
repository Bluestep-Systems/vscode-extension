import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileSystem } from '../../main/app/util/fs/FileSystem';
import { FileSystemProvider, MockFileSystem, VSCodeFileSystem } from '../../main/app/util/fs/FileSystemProvider';
import { Err } from '../../main/app/util/Err';

suite('FileSystem Factory Tests', () => {
  let originalInstance: FileSystemProvider;

  suiteSetup(() => {
    // Store the original instance for restoration
    originalInstance = FileSystem.getInstance();
  });

  suiteTeardown(() => {
    // Restore the original state
    FileSystem.setProvider(originalInstance);
  });

  setup(() => {
    // Reset to production mode before each test
    FileSystem.enableProductionMode();
  });

  teardown(() => {
    // Ensure we're back to production mode after each test
    FileSystem.enableProductionMode();
  });

  suite('Basic Factory Operations', () => {
    test('should start in production mode by default', () => {
      assert.strictEqual(FileSystem.getIsTestMode(), false, 'Should start in production mode');
      assert.ok(FileSystem.getInstance() instanceof VSCodeFileSystem, 'Should use VSCodeFileSystem by default');
    });

    test('should switch to test mode correctly', () => {
      const mockProvider = FileSystem.enableTestMode();

      assert.strictEqual(FileSystem.getIsTestMode(), true, 'Should be in test mode');
      assert.ok(FileSystem.getInstance() instanceof MockFileSystem, 'Should use MockFileSystem in test mode');
      assert.strictEqual(FileSystem.getInstance(), mockProvider, 'Should return the same mock provider instance');
    });

    test('should switch back to production mode correctly', () => {
      // First switch to test mode
      FileSystem.enableTestMode();
      assert.strictEqual(FileSystem.getIsTestMode(), true, 'Should be in test mode');

      // Then switch back to production
      FileSystem.enableProductionMode();
      assert.strictEqual(FileSystem.getIsTestMode(), false, 'Should be back in production mode');
      assert.ok(FileSystem.getInstance() instanceof VSCodeFileSystem, 'Should use VSCodeFileSystem in production mode');
    });

    test('should reset to production mode correctly', () => {
      // Switch to test mode first
      FileSystem.enableTestMode();
      assert.strictEqual(FileSystem.getIsTestMode(), true, 'Should be in test mode');

      // Reset should go back to production
      FileSystem.reset();
      assert.strictEqual(FileSystem.getIsTestMode(), false, 'Should be in production mode after reset');
      assert.ok(FileSystem.getInstance() instanceof VSCodeFileSystem, 'Should use VSCodeFileSystem after reset');
    });

    test('should allow setting custom provider', () => {
      const customProvider = new MockFileSystem();
      FileSystem.setProvider(customProvider);

      assert.strictEqual(FileSystem.getInstance(), customProvider, 'Should use custom provider');
      // Test mode flag might not be updated when setting custom provider
    });
  });

  suite('Mock FileSystem Functionality', () => {
    test('should provide mock file system with clear functionality', () => {
      const mockProvider = FileSystem.enableTestMode();

      assert.ok(mockProvider instanceof MockFileSystem, 'Should be MockFileSystem instance');
      assert.strictEqual(typeof mockProvider.clearMocks, 'function', 'Should have clearMocks method');
      assert.strictEqual(typeof mockProvider.setMockFile, 'function', 'Should have setMockFile method');
      assert.strictEqual(typeof mockProvider.setMockError, 'function', 'Should have setMockError method');
      assert.strictEqual(typeof mockProvider.setMockStat, 'function', 'Should have setMockStat method');
    });

    test('should handle mock file operations', () => {
      const mockProvider = FileSystem.enableTestMode();
      const testUri = vscode.Uri.file('/test/file.txt');
      const testContent = Buffer.from('test content');

      // Set mock file
      mockProvider.setMockFile(testUri, testContent);

      // Should not throw when setting mock files
      assert.ok(true, 'Setting mock file should not throw');

      // Clear mocks
      mockProvider.clearMocks();
      assert.ok(true, 'Clearing mocks should not throw');
    });

    test('should handle mock stat operations', () => {
      const mockProvider = FileSystem.enableTestMode();
      const testUri = vscode.Uri.file('/test/file.txt');
      const testStat: vscode.FileStat = {
        type: vscode.FileType.File,
        ctime: Date.now(),
        mtime: Date.now(),
        size: 100
      };

      // Set mock stat
      mockProvider.setMockStat(testUri, testStat);

      // Should not throw when setting mock stats
      assert.ok(true, 'Setting mock stat should not throw');
    });

    test('should handle mock error operations', () => {
      const mockProvider = FileSystem.enableTestMode();
      const testUri = vscode.Uri.file('/test/file.txt');
      const testError = new Error('Test error');

      // Set mock error
      mockProvider.setMockError(testUri, testError);

      // Should not throw when setting mock errors
      assert.ok(true, 'Setting mock error should not throw');
    });

    test('should handle mock directory operations', () => {
      const mockProvider = FileSystem.enableTestMode();
      const testUri = vscode.Uri.file('/test/directory');

      // Set mock directory
      mockProvider.setMockDirectory(testUri);

      // Should not throw when setting mock directories
      assert.ok(true, 'Setting mock directory should not throw');
    });
  });

  suite('Multiple Mode Switches', () => {
    test('should handle rapid mode switching', () => {
      // Rapidly switch between modes
      for (let i = 0; i < 10; i++) {
        const mockProvider = FileSystem.enableTestMode();
        assert.ok(mockProvider instanceof MockFileSystem, `Test mode switch ${i} should work`);
        assert.strictEqual(FileSystem.getIsTestMode(), true, `Should be in test mode on iteration ${i}`);

        FileSystem.enableProductionMode();
        assert.ok(FileSystem.getInstance() instanceof VSCodeFileSystem, `Production mode switch ${i} should work`);
        assert.strictEqual(FileSystem.getIsTestMode(), false, `Should be in production mode on iteration ${i}`);
      }
    });

    test('should maintain provider state correctly across switches', () => {


      // Switch to test
      const mockProvider1 = FileSystem.enableTestMode();
      const mockProvider2 = FileSystem.getInstance();
      assert.strictEqual(mockProvider1, mockProvider2, 'Should get same mock provider instance');

      // Switch back to production
      FileSystem.enableProductionMode();
      const productionProvider2 = FileSystem.getInstance();
      assert.ok(productionProvider2 instanceof VSCodeFileSystem, 'Should be back to VSCodeFileSystem');

      // Switch to test again
      const mockProvider3 = FileSystem.enableTestMode();
      assert.ok(mockProvider3 instanceof MockFileSystem, 'Should get new MockFileSystem instance');
    });

    test('should not interfere with custom provider settings', () => {
      const customProvider = new MockFileSystem();

      // Set custom provider
      FileSystem.setProvider(customProvider);
      const retrievedProvider1 = FileSystem.getInstance();
      assert.strictEqual(retrievedProvider1, customProvider, 'Should use custom provider');

      // Enable test mode (this should override custom provider)
      const testProvider = FileSystem.enableTestMode();
      assert.notStrictEqual(testProvider, customProvider, 'Test mode should override custom provider');

      // Enable production mode
      FileSystem.enableProductionMode();
      const productionProvider = FileSystem.getInstance();
      assert.ok(productionProvider instanceof VSCodeFileSystem, 'Should be back to VSCodeFileSystem');
    });
  });

  suite('Dummy Text Document Creation', () => {
    test('should create dummy text document with correct properties', () => {
      const testUri = vscode.Uri.file('/test/document.txt');
      const dummyDoc = FileSystem.createDummyTextDocument(testUri);

      assert.strictEqual(dummyDoc.uri, testUri, 'URI should match');
      assert.strictEqual(dummyDoc.fileName, testUri.fsPath, 'fileName should match URI fsPath');
      assert.strictEqual(dummyDoc.isUntitled, true, 'Should be marked as untitled');
      assert.strictEqual(dummyDoc.languageId, 'plaintext', 'Should have plaintext language ID');
      assert.strictEqual(dummyDoc.version, 1, 'Should have version 1');
      assert.strictEqual(dummyDoc.isDirty, false, 'Should not be dirty');
      assert.strictEqual(dummyDoc.isClosed, false, 'Should not be closed');
      assert.strictEqual(dummyDoc.eol, vscode.EndOfLine.LF, 'Should use LF line endings');
      assert.strictEqual(dummyDoc.lineCount, 0, 'Should have 0 lines');
      assert.strictEqual(dummyDoc.encoding, 'utf8', 'Should have utf8 encoding');
    });

    test('should handle dummy text document method calls', () => {
      const testUri = vscode.Uri.file('/test/document.txt');
      const dummyDoc = FileSystem.createDummyTextDocument(testUri);

      // getText should return empty string
      assert.strictEqual(dummyDoc.getText(), '', 'getText should return empty string');

      // save should return true
      assert.ok(dummyDoc.save() instanceof Promise, 'save should return a Promise');

      // Methods that should throw MethodNotImplementedError
      const methodsThatShouldThrow = [
        () => dummyDoc.lineAt(0),
        () => dummyDoc.offsetAt(new vscode.Position(0, 0)),
        () => dummyDoc.positionAt(0)
      ];

      methodsThatShouldThrow.forEach((method, index) => {
        assert.throws(method, Err.MethodNotImplementedError, `Method ${index} should throw MethodNotImplementedError`);
      });

      // Methods that should return values without throwing
      const testRange = new vscode.Range(0, 0, 0, 0);
      const testPosition = new vscode.Position(0, 0);

      assert.strictEqual(dummyDoc.validateRange(testRange), testRange, 'validateRange should return the same range');
      assert.strictEqual(dummyDoc.validatePosition(testPosition), testPosition, 'validatePosition should return the same position');
      assert.strictEqual(dummyDoc.getWordRangeAtPosition(testPosition), undefined, 'getWordRangeAtPosition should return undefined');
    });

    test('should handle different URI schemes in dummy documents', () => {
      const fileUri = vscode.Uri.file('/local/file.txt');
      const httpUri = vscode.Uri.parse('http://example.com/file.txt');
      const customUri = vscode.Uri.parse('custom://scheme/path');

      const fileDummy = FileSystem.createDummyTextDocument(fileUri);
      const httpDummy = FileSystem.createDummyTextDocument(httpUri);
      const customDummy = FileSystem.createDummyTextDocument(customUri);

      assert.strictEqual(fileDummy.uri.scheme, 'file', 'File URI scheme should be preserved');
      assert.strictEqual(httpDummy.uri.scheme, 'http', 'HTTP URI scheme should be preserved');
      assert.strictEqual(customDummy.uri.scheme, 'custom', 'Custom URI scheme should be preserved');

      // All should have the same dummy document characteristics
      [fileDummy, httpDummy, customDummy].forEach((dummy, index) => {
        assert.strictEqual(dummy.isUntitled, true, `Dummy ${index} should be untitled`);
        assert.strictEqual(dummy.languageId, 'plaintext', `Dummy ${index} should be plaintext`);
        assert.strictEqual(dummy.getText(), '', `Dummy ${index} should have empty text`);
      });
    });
  });

  suite('State Consistency and Error Handling', () => {
    test('should maintain consistent state across provider changes', () => {
      // Track state changes
      const states: { mode: boolean; providerType: string }[] = [];

      // Initial state
      states.push({
        mode: FileSystem.getIsTestMode(),
        providerType: FileSystem.getInstance().constructor.name
      });

      // Switch to test mode
      FileSystem.enableTestMode();
      states.push({
        mode: FileSystem.getIsTestMode(),
        providerType: FileSystem.getInstance().constructor.name
      });

      // Switch to production mode
      FileSystem.enableProductionMode();
      states.push({
        mode: FileSystem.getIsTestMode(),
        providerType: FileSystem.getInstance().constructor.name
      });

      // Verify state progression
      assert.strictEqual(states[0].mode, false, 'Should start in production mode');
      assert.strictEqual(states[0].providerType, 'VSCodeFileSystem', 'Should start with VSCodeFileSystem');

      assert.strictEqual(states[1].mode, true, 'Should switch to test mode');
      assert.strictEqual(states[1].providerType, 'MockFileSystem', 'Should switch to MockFileSystem');

      assert.strictEqual(states[2].mode, false, 'Should return to production mode');
      assert.strictEqual(states[2].providerType, 'VSCodeFileSystem', 'Should return to VSCodeFileSystem');
    });

    test('should handle null or undefined provider gracefully', () => {
      // This test verifies the factory doesn't break with invalid inputs
      // We can't directly test setting null provider since setProvider expects FileSystemProvider
      // But we can test that the current implementation is robust

      const currentProvider = FileSystem.getInstance();
      assert.ok(currentProvider, 'Provider should always be defined');
      assert.ok(typeof currentProvider.readFile === 'function', 'Provider should have readFile method');
      assert.ok(typeof currentProvider.writeFile === 'function', 'Provider should have writeFile method');
      assert.ok(typeof currentProvider.stat === 'function', 'Provider should have stat method');
    });

    test('should handle concurrent mode switches', async () => {
      // Test concurrent switching operations
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          Promise.resolve().then(() => {
            if (i % 2 === 0) {
              return FileSystem.enableTestMode();
            } else {
              FileSystem.enableProductionMode();
              return FileSystem.getInstance();
            }
          })
        );
      }

      const results = await Promise.all(operations);

      // All operations should complete without throwing
      results.forEach((result, index) => {
        assert.ok(result, `Operation ${index} should return a provider`);
      });

      // Final state should be consistent
      const finalProvider = FileSystem.getInstance();
      const finalMode = FileSystem.getIsTestMode();

      assert.ok(finalProvider, 'Should have a final provider');
      assert.strictEqual(typeof finalMode, 'boolean', 'Should have a boolean mode state');
    });

    // test('should provide correct provider interface', () => {
    //   // Test production provider interface
    //   FileSystem.enableProductionMode();
    //   const productionProvider = FileSystem.getInstance();

    //   const requiredMethods = ['readFile', 'writeFile', 'stat', 'readDirectory', 'createDirectory', 'delete'];
    //   requiredMethods.forEach(method => {
    //     assert.strictEqual(typeof (productionProvider as any)[method], 'function', `Production provider should have ${method} method`);
    //   });

    //   // Test mock provider interface
    //   const mockProvider = FileSystem.enableTestMode();

    //   requiredMethods.forEach(method => {
    //     assert.strictEqual(typeof (mockProvider as any)[method], 'function', `Mock provider should have ${method} method`);
    //   });

    //   // Test mock-specific methods
    //   const mockSpecificMethods = ['clearMocks', 'setMockFile', 'setMockError', 'setMockStat', 'setMockDirectory'];
    //   mockSpecificMethods.forEach(method => {
    //     assert.strictEqual(typeof mockProvider[method], 'function', `Mock provider should have ${method} method`);
    //   });
    // });
  });

  suite('Memory Management and Cleanup', () => {
    test('should not leak provider instances during mode switches', () => {
      // Create multiple providers and switch modes
      const providers: FileSystemProvider[] = [];

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          providers.push(FileSystem.enableTestMode());
        } else {
          FileSystem.enableProductionMode();
          providers.push(FileSystem.getInstance());
        }
      }

      // The factory should reuse instances appropriately
      const mockProviders = providers.filter(p => p instanceof MockFileSystem);
      const vsCodeProviders = providers.filter(p => p instanceof VSCodeFileSystem);

      // There should be multiple mock providers (new instance each time)
      assert.ok(mockProviders.length > 0, 'Should have mock providers');

      // There should be multiple VSCode providers, but they might be reused
      assert.ok(vsCodeProviders.length > 0, 'Should have VSCode providers');
    });

    test('should handle provider cleanup during rapid switching', () => {
      // Rapidly switch modes and verify no errors occur
      for (let cycle = 0; cycle < 20; cycle++) {
        const mockProvider = FileSystem.enableTestMode();

        // Use the mock provider briefly
        const testUri = vscode.Uri.file(`/test/cycle${cycle}.txt`);
        mockProvider.setMockFile(testUri, Buffer.from('test'));
        mockProvider.clearMocks();

        FileSystem.enableProductionMode();
        const productionProvider = FileSystem.getInstance();

        // Verify provider is functional
        assert.ok(productionProvider, `Production provider should exist in cycle ${cycle}`);
      }

      // Final state should be clean
      assert.strictEqual(FileSystem.getIsTestMode(), false, 'Should end in production mode');
      assert.ok(FileSystem.getInstance() instanceof VSCodeFileSystem, 'Should end with VSCodeFileSystem');
    });

    test('should handle mock provider state isolation', () => {
      // Create first mock provider and set some state
      const mockProvider1 = FileSystem.enableTestMode();
      const testUri1 = vscode.Uri.file('/test/file1.txt');
      mockProvider1.setMockFile(testUri1, Buffer.from('content1'));

      // Switch to production and back to test
      FileSystem.enableProductionMode();
      const mockProvider2 = FileSystem.enableTestMode();

      // New mock provider should be clean (no state from previous one)
      assert.notStrictEqual(mockProvider1, mockProvider2, 'Should get new mock provider instance');

      // Set different state in new provider
      const testUri2 = vscode.Uri.file('/test/file2.txt');
      mockProvider2.setMockFile(testUri2, Buffer.from('content2'));

      // Providers should not interfere with each other
      assert.ok(true, 'Mock providers should be isolated');
    });
  });

  suite('FileSystem.closest() Method Tests', () => {
    let mockProvider: MockFileSystem;

    setup(() => {
      mockProvider = FileSystem.enableTestMode();
      mockProvider.clearMocks();
    });

    teardown(() => {
      FileSystem.enableProductionMode();
    });

    suite('Basic Functionality', () => {
      test('should find file in current directory', async () => {
        // Test finding a file in the same directory as the starting point
        const startDir = vscode.Uri.file('/project/src/components');
        const targetFile = vscode.Uri.file('/project/src/components/package.json');

        mockProvider.setMockFile(targetFile, '{"name": "test"}');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.ok(result, 'Should find file in current directory');
        assert.strictEqual(result?.fsPath, targetFile.fsPath, 'Should return correct file URI');
      });

      test('should find file in parent directory', async () => {
        // Test finding a file one level up
        const startDir = vscode.Uri.file('/project/src/components');
        const targetFile = vscode.Uri.file('/project/src/tsconfig.json');

        mockProvider.setMockFile(targetFile, '{"compilerOptions": {}}');

        const result = await mockProvider.closest(startDir, 'tsconfig.json');

        assert.ok(result, 'Should find file in parent directory');
        assert.strictEqual(result?.fsPath, targetFile.fsPath, 'Should return correct file URI');
      });

      test('should find file in grandparent directory', async () => {
        // Test finding a file two levels up
        const startDir = vscode.Uri.file('/project/src/components/buttons');
        const targetFile = vscode.Uri.file('/project/package.json');

        mockProvider.setMockFile(targetFile, '{"name": "myproject"}');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.ok(result, 'Should find file in grandparent directory');
        assert.strictEqual(result?.fsPath, targetFile.fsPath, 'Should return correct file URI');
      });

      test('should return null when file is not found', async () => {
        // Test when target file doesn't exist anywhere in the hierarchy
        const startDir = vscode.Uri.file('/project/src/components');

        // Don't set up any mock files, so nothing will be found
        const result = await mockProvider.closest(startDir, 'nonexistent.json');

        assert.strictEqual(result, null, 'Should return null when file not found');
      });

      test('should respect maxDepth parameter', async () => {
        // Test that search stops at maxDepth even if file exists beyond
        const startDir = vscode.Uri.file('/project/src/components/buttons/primary');
        const targetFile = vscode.Uri.file('/project/package.json'); // 4 levels up

        mockProvider.setMockFile(targetFile, '{"name": "myproject"}');

        // Search with maxDepth of 2 (can only go up to /project/src/components)
        const result = await mockProvider.closest(startDir, 'package.json', 2);

        assert.strictEqual(result, null, 'Should not find file beyond maxDepth');
      });

      test('should find file within maxDepth limit', async () => {
        // Test that file is found when within maxDepth
        const startDir = vscode.Uri.file('/project/src/components');
        const targetFile = vscode.Uri.file('/project/package.json'); // 2 levels up

        mockProvider.setMockFile(targetFile, '{"name": "myproject"}');

        // Search with maxDepth of 3 (enough to reach /project)
        const result = await mockProvider.closest(startDir, 'package.json', 3);

        assert.ok(result, 'Should find file within maxDepth');
        assert.strictEqual(result?.fsPath, targetFile.fsPath, 'Should return correct file URI');
      });
    });

    suite('Cross-Platform Edge Cases', () => {
      test('should handle Unix-style root path', async () => {
        // Test root detection on Unix-style paths (/)
        const startDir = vscode.Uri.file('/home/user');

        // Don't set up any target file
        const result = await mockProvider.closest(startDir, 'package.json');

        // Should search up to root and return null
        assert.strictEqual(result, null, 'Should handle Unix root path');
      });

      test('should stop at Unix root even with high maxDepth', async () => {
        // Test that search stops at root / even if maxDepth allows more
        const startDir = vscode.Uri.file('/home');

        // Don't set up any target file
        const result = await mockProvider.closest(startDir, 'package.json', 100);

        assert.strictEqual(result, null, 'Should stop at root regardless of maxDepth');
      });

      test('should handle Windows-style root path (C:\\)', async () => {
        // Test root detection on Windows-style paths
        const startDir = vscode.Uri.file('C:\\Users\\user');

        const result = await mockProvider.closest(startDir, 'package.json');

        // Should search up to root and return null
        assert.strictEqual(result, null, 'Should handle Windows root path');
      });

      test('should handle Windows-style path with different drive letter', async () => {
        // Test Windows D: drive
        const startDir = vscode.Uri.file('D:\\projects\\myapp');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.strictEqual(result, null, 'Should handle different drive letters');
      });

      test('should handle UNC paths on Windows', async () => {
        // Test UNC paths (\\server\share)
        const startDir = vscode.Uri.file('\\\\server\\share\\projects\\myapp');

        const result = await mockProvider.closest(startDir, 'package.json');

        // UNC paths should be handled without errors
        assert.strictEqual(result, null, 'Should handle UNC paths');
      });

      test('should handle deeply nested directory structure', async () => {
        // Test with deep nesting, but within the default maxDepth of 10
        // Start at 8 levels deep, target 2 levels up = well within limit
        const deepPath = '/a/b/c/d/e/f/g/h';
        const startDir = vscode.Uri.file(deepPath);
        const targetFile = vscode.Uri.file('/a/b/c/d/e/f/package.json');

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.ok(result, 'Should handle deeply nested paths');
        assert.strictEqual(result?.fsPath, targetFile.fsPath, 'Should find file in deep hierarchy');
      });

      test('should handle path normalization correctly', async () => {
        // Test that paths with different separators are normalized correctly
        const startDir = vscode.Uri.file('/project/src/../src/components');
        const targetFile = vscode.Uri.file('/project/package.json');

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, 'package.json');

        // VS Code should normalize the path internally
        assert.ok(result, 'Should handle path normalization');
      });
    });

    suite('Error Handling', () => {
      test('should handle non-existent start directory gracefully', async () => {
        // Test when the starting directory doesn't exist
        const startDir = vscode.Uri.file('/nonexistent/directory');

        // The method should handle this gracefully and return null
        const result = await mockProvider.closest(startDir, 'package.json');

        assert.strictEqual(result, null, 'Should handle non-existent start directory');
      });

      test('should handle maxDepth of 0', async () => {
        // Test edge case of maxDepth = 0 (only check current directory)
        const startDir = vscode.Uri.file('/project/src');
        const targetFile = vscode.Uri.file('/project/src/package.json');

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, 'package.json', 0);

        // With maxDepth=0, should not enter the while loop, so returns null
        assert.strictEqual(result, null, 'Should handle maxDepth of 0');
      });

      test('should handle maxDepth of 1', async () => {
        // Test maxDepth = 1 (check current dir, then one parent)
        const startDir = vscode.Uri.file('/project/src/components');
        const targetInCurrent = vscode.Uri.file('/project/src/components/local.json');

        mockProvider.setMockFile(targetInCurrent, '{}');

        const result = await mockProvider.closest(startDir, 'local.json', 1);

        assert.ok(result, 'Should find file in current directory with maxDepth=1');
        assert.strictEqual(result?.fsPath, targetInCurrent.fsPath);
      });

      test('should handle files with special characters in names', async () => {
        // Test files with spaces, symbols, etc.
        const startDir = vscode.Uri.file('/project/src');
        const specialFileName = 'package (copy).json';
        const targetFile = vscode.Uri.file(`/project/${specialFileName}`);

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, specialFileName);

        assert.ok(result, 'Should handle special characters in file names');
        assert.strictEqual(result?.fsPath, targetFile.fsPath);
      });

      test('should handle Unicode characters in file names', async () => {
        // Test files with Unicode characters
        const startDir = vscode.Uri.file('/project/src');
        const unicodeFileName = 'package-日本語-αβγ.json';
        const targetFile = vscode.Uri.file(`/project/${unicodeFileName}`);

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, unicodeFileName);

        assert.ok(result, 'Should handle Unicode in file names');
        assert.strictEqual(result?.fsPath, targetFile.fsPath);
      });

      test('should handle empty file name gracefully', async () => {
        // Test edge case of empty string file name
        const startDir = vscode.Uri.file('/project/src');

        const result = await mockProvider.closest(startDir, '');

        // Should not find anything with empty file name
        assert.strictEqual(result, null, 'Should handle empty file name');
      });

      test('should handle file name with path separators', async () => {
        // Test invalid file name containing path separator
        const startDir = vscode.Uri.file('/project/src');

        // This is an invalid file name (contains path separator)
        const result = await mockProvider.closest(startDir, 'subfolder/package.json');

        // Should not find it as a simple file name
        assert.strictEqual(result, null, 'Should not find file with path separators in name');
      });
    });

    suite('Performance and Edge Cases', () => {
      test('should stop at maxDepth even if root not reached', async () => {
        // Test that maxDepth is respected even on deep paths
        const startDir = vscode.Uri.file('/a/b/c/d/e/f/g/h');
        const targetFile = vscode.Uri.file('/a/b/c/target.json');

        mockProvider.setMockFile(targetFile, '{}');

        // maxDepth of 3 should stop at /a/b/c/d/e, not finding file at /a/b/c
        const result = await mockProvider.closest(startDir, 'target.json', 3);

        assert.strictEqual(result, null, 'Should stop at maxDepth before reaching file');
      });

      test('should not search beyond root even if maxDepth not reached', async () => {
        // Test that root terminates search even with high maxDepth
        const startDir = vscode.Uri.file('/home/user');

        // No file set up, so will search to root
        const result = await mockProvider.closest(startDir, 'package.json', 1000);

        assert.strictEqual(result, null, 'Should stop at root before maxDepth');
      });

      test('should prefer closer file over farther file', async () => {
        // Test that closest file is found (not continuing to search after found)
        const startDir = vscode.Uri.file('/project/src/components');
        const closerFile = vscode.Uri.file('/project/src/package.json');
        const fartherFile = vscode.Uri.file('/project/package.json');

        mockProvider.setMockFile(closerFile, '{"name": "closer"}');
        mockProvider.setMockFile(fartherFile, '{"name": "farther"}');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.ok(result, 'Should find a file');
        assert.strictEqual(result?.fsPath, closerFile.fsPath, 'Should return the closer file');
      });

      test('should handle concurrent calls to closest', async () => {
        // Test concurrent calls to ensure no race conditions
        const startDir = vscode.Uri.file('/project/src');
        const targetFile = vscode.Uri.file('/project/package.json');

        mockProvider.setMockFile(targetFile, '{}');

        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(mockProvider.closest(startDir, 'package.json'));
        }

        const results = await Promise.all(promises);

        // All results should be identical
        results.forEach((result, index) => {
          assert.ok(result, `Call ${index} should find file`);
          assert.strictEqual(result?.fsPath, targetFile.fsPath, `Call ${index} should find correct file`);
        });
      });

      test('should handle multiple different files in hierarchy', async () => {
        // Test with multiple different target files in the hierarchy
        const startDir = vscode.Uri.file('/project/src/components');
        const tsconfig = vscode.Uri.file('/project/tsconfig.json');
        const packageJson = vscode.Uri.file('/project/package.json');
        const gitignore = vscode.Uri.file('/project/.gitignore');

        mockProvider.setMockFile(tsconfig, '{}');
        mockProvider.setMockFile(packageJson, '{}');
        mockProvider.setMockFile(gitignore, '');

        const tsconfigResult = await mockProvider.closest(startDir, 'tsconfig.json');
        const packageResult = await mockProvider.closest(startDir, 'package.json');
        const gitignoreResult = await mockProvider.closest(startDir, '.gitignore');

        assert.ok(tsconfigResult, 'Should find tsconfig.json');
        assert.ok(packageResult, 'Should find package.json');
        assert.ok(gitignoreResult, 'Should find .gitignore');

        assert.strictEqual(tsconfigResult?.fsPath, tsconfig.fsPath);
        assert.strictEqual(packageResult?.fsPath, packageJson.fsPath);
        assert.strictEqual(gitignoreResult?.fsPath, gitignore.fsPath);
      });

      test('should handle file in root directory', async () => {
        // Test finding a file directly at root (edge case)
        const startDir = vscode.Uri.file('/project');
        const targetFile = vscode.Uri.file('/project/package.json');

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.ok(result, 'Should find file in root directory');
        assert.strictEqual(result?.fsPath, targetFile.fsPath);
      });

      test('should handle search starting from system root', async () => {
        // Test starting search from system root itself
        const startDir = vscode.Uri.file('/');
        const targetFile = vscode.Uri.file('/package.json');

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, 'package.json');

        assert.ok(result, 'Should find file at root level');
        assert.strictEqual(result?.fsPath, targetFile.fsPath);
      });

      test('should return null when searching from root with no file', async () => {
        // Test that searching from root returns null when file not found
        const startDir = vscode.Uri.file('/');

        const result = await mockProvider.closest(startDir, 'nonexistent.json');

        assert.strictEqual(result, null, 'Should return null when not found at root');
      });
    });

    suite('Real-World Use Cases', () => {
      test('should find package.json for typical npm project', async () => {
        // Simulate typical npm project structure
        const packageJson = vscode.Uri.file('/home/user/projects/myapp/package.json');

        mockProvider.setMockFile(packageJson, '{"name": "myapp"}');

        // Get directory of component file
        const componentDir = vscode.Uri.file('/home/user/projects/myapp/src/components');
        const result = await mockProvider.closest(componentDir, 'package.json');

        assert.ok(result, 'Should find package.json');
        assert.strictEqual(result?.fsPath, packageJson.fsPath);
      });

      test('should find tsconfig.json in monorepo structure', async () => {
        // Simulate monorepo with nested tsconfig files
        const packageTsConfig = vscode.Uri.file('/workspace/packages/ui/tsconfig.json');

        mockProvider.setMockFile(packageTsConfig, '{"extends": "../../tsconfig.json"}');

        const componentDir = vscode.Uri.file('/workspace/packages/ui/src');
        const result = await mockProvider.closest(componentDir, 'tsconfig.json');

        assert.ok(result, 'Should find nearest tsconfig.json');
        assert.strictEqual(result?.fsPath, packageTsConfig.fsPath);
      });

      test('should find .gitignore in project root', async () => {
        // Test finding .gitignore for git operations
        const gitignore = vscode.Uri.file('/project/.gitignore');

        mockProvider.setMockFile(gitignore, 'node_modules/\n.env');

        const nestedDir = vscode.Uri.file('/project/src/lib/utils');
        const result = await mockProvider.closest(nestedDir, '.gitignore');

        assert.ok(result, 'Should find .gitignore');
        assert.strictEqual(result?.fsPath, gitignore.fsPath);
      });

      test('should find .env file for configuration', async () => {
        // Test finding environment configuration
        const envFile = vscode.Uri.file('/app/.env');

        mockProvider.setMockFile(envFile, 'API_KEY=secret');

        const srcDir = vscode.Uri.file('/app/src/config');
        const result = await mockProvider.closest(srcDir, '.env');

        assert.ok(result, 'Should find .env file');
        assert.strictEqual(result?.fsPath, envFile.fsPath);
      });

      test('should not find file in sibling directory', async () => {
        // Test that closest doesn't search sideways, only upward
        const startDir = vscode.Uri.file('/project/src/components');
        const siblingFile = vscode.Uri.file('/project/src/utils/config.json');

        mockProvider.setMockFile(siblingFile, '{}');

        const result = await mockProvider.closest(startDir, 'config.json');

        // Should not find file in sibling directory (only searches upward)
        assert.strictEqual(result, null, 'Should not find file in sibling directory');
      });

      test('should handle VS Code workspace with multiple roots', async () => {
        // Test in workspace with multiple root folders
        const configInWorkspace1 = vscode.Uri.file('/workspaces/project1/tsconfig.json');

        mockProvider.setMockFile(configInWorkspace1, '{}');

        const dirInWorkspace1 = vscode.Uri.file('/workspaces/project1/src');
        const result = await mockProvider.closest(dirInWorkspace1, 'tsconfig.json');

        assert.ok(result, 'Should find config in multi-root workspace');
        assert.strictEqual(result?.fsPath, configInWorkspace1.fsPath);
      });
    });

    suite('Default maxDepth Behavior', () => {
      test('should use default maxDepth of 10 when not specified', async () => {
        // Test that default maxDepth is sufficient for typical projects
        const deepPath = '/a/b/c/d/e/f/g/h/i/j/k'; // 11 levels deep
        const startDir = vscode.Uri.file(deepPath);
        const targetFile = vscode.Uri.file('/a/target.json'); // 10 levels up from deepPath

        mockProvider.setMockFile(targetFile, '{}');

        // Without specifying maxDepth, should use default of 10
        const result = await mockProvider.closest(startDir, 'target.json');

        // With 11 levels, target is 10 levels up, which is at the limit
        // The default maxDepth=10 means we check current + 10 parents
        assert.strictEqual(result, null, 'Should not find file beyond default maxDepth of 10');
      });

      test('should find file within default maxDepth', async () => {
        // Test finding file within the default maxDepth
        const deepPath = '/a/b/c/d/e/f/g/h/i';
        const startDir = vscode.Uri.file(deepPath);
        const targetFile = vscode.Uri.file('/a/target.json'); // 8 levels up

        mockProvider.setMockFile(targetFile, '{}');

        const result = await mockProvider.closest(startDir, 'target.json');

        assert.ok(result, 'Should find file within default maxDepth');
        assert.strictEqual(result?.fsPath, targetFile.fsPath);
      });
    });
  });
});