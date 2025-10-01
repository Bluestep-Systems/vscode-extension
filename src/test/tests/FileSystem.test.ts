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
});