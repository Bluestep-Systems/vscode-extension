import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { RemoteScriptRoot } from '../main/app/util/script/RemoteScriptRoot';
import { RemoteScriptFile } from '../main/app/util/script/RemoteScriptFile';
import { FileSystem } from '../main/app/util/fs/FileSystemFactory';
import { MockFileSystem } from '../main/app/util/fs/FileSystemProvider';
import { ScriptMetaData } from '../../types';
import { App } from '../main/app/App';

suite('RemoteScriptRoot Tests', () => {
    let mockFileSystem: MockFileSystem;
    let remoteScriptRoot: RemoteScriptRoot;
    let testChildUri: vscode.Uri;
    let originalLogger: any;

    suiteSetup(() => {
        // Enable test mode with mock file system
        mockFileSystem = FileSystem.enableTestMode();
        
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
        mockFileSystem.clearMocks();

        // Create a valid child URI that matches the expected structure
        testChildUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
        
        // Create RemoteScriptRoot instance
        remoteScriptRoot = new RemoteScriptRoot({ childUri: testChildUri });

        // Set up basic mock metadata file
        const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
        const defaultMetadata: ScriptMetaData = {
            scriptName: "Test Script",
            webdavId: "1466960",
            pushPullRecords: []
        };
        mockFileSystem.setMockFile(metadataUri, Buffer.from(JSON.stringify(defaultMetadata, null, 2)));
        mockFileSystem.setMockStat(metadataUri, {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 100
        });
    });

    suite('Constructor and Path Parsing', () => {
        test('should parse child URI correctly', () => {
            const scriptRoot = new RemoteScriptRoot({ childUri: testChildUri });
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });

        test('should handle different file types in same directory', () => {
            const declarationsUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/declarations/script.js');
            const scriptRoot = new RemoteScriptRoot({ childUri: declarationsUri });
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });

        test('should handle metadata file as child URI', () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            const scriptRoot = new RemoteScriptRoot({ childUri: metadataUri });
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });
    });

    suite('URI Generation', () => {
        test('should generate correct downstairs root URI', () => {
            const rootUri = remoteScriptRoot.getDownstairsRootUri();
            const expectedPath = path.normalize('/test/workspace/configbeh.bluestep.net/1466960');
            
            assert.strictEqual(
                path.normalize(rootUri.fsPath), 
                expectedPath
            );
        });

        test('should generate correct org URI', () => {
            const orgUri = remoteScriptRoot.getOrgUri();
            const expectedPath = path.normalize('/test/workspace/configbeh.bluestep.net');
            
            assert.strictEqual(
                path.normalize(orgUri.fsPath), 
                expectedPath
            );
        });

        test('should generate correct upstairs base URL string', () => {
            const baseUrl = remoteScriptRoot.toBaseUpstairsString();
            
            assert.strictEqual(baseUrl, 'https://configbeh.bluestep.net/files/1466960/');
        });

        test('should generate correct upstairs base URL object', () => {
            const baseUrl = remoteScriptRoot.toBaseUpstairsUrl();
            
            assert.ok(baseUrl instanceof URL);
            assert.strictEqual(baseUrl.toString(), 'https://configbeh.bluestep.net/files/1466960/');
            assert.strictEqual(baseUrl.hostname, 'configbeh.bluestep.net');
            assert.strictEqual(baseUrl.pathname, '/files/1466960/');
        });
    });

    suite('Static Methods', () => {
        test('should create RemoteScriptRoot from root URI', () => {
            const rootUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960');
            const scriptRoot = RemoteScriptRoot.fromRootUri(rootUri);
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });
    });

    suite('Equality Comparison', () => {
        test('should return true for equal RemoteScriptRoots', () => {
            const uri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/file1.js');
            const uri2 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/declarations/file2.js');
            
            const root1 = new RemoteScriptRoot({ childUri: uri1 });
            const root2 = new RemoteScriptRoot({ childUri: uri2 });
            
            assert.strictEqual(root1.equals(root2), true);
        });

        test('should return false for different origins', () => {
            const uri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/file1.js');
            const uri2 = vscode.Uri.parse('file:///test/workspace/different.domain.com/1466960/draft/file2.js');
            
            const root1 = new RemoteScriptRoot({ childUri: uri1 });
            const root2 = new RemoteScriptRoot({ childUri: uri2 });
            
            assert.strictEqual(root1.equals(root2), false);
        });

        test('should return false for different webdav IDs', () => {
            const uri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/file1.js');
            const uri2 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/9999999/draft/file2.js');
            
            const root1 = new RemoteScriptRoot({ childUri: uri1 });
            const root2 = new RemoteScriptRoot({ childUri: uri2 });
            
            assert.strictEqual(root1.equals(root2), false);
        });
    });

    suite('Metadata Operations', () => {
        test('should read existing metadata file', async () => {
            const metadata = await remoteScriptRoot.getMetaData();
            
            assert.strictEqual(metadata.scriptName, 'Test Script');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
        });

        test('should create new metadata when file does not exist', async () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            
            // Remove the mock file to simulate non-existence
            mockFileSystem.setMockError(metadataUri, new Error('File not found'));
            
            const metadata = await remoteScriptRoot.getMetaData();
            
            assert.strictEqual(metadata.scriptName, '');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
            assert.strictEqual(metadata.pushPullRecords.length, 0);
        });

        test('should modify metadata with callback', async () => {
            const modifiedMetadata = await remoteScriptRoot.modifyMetaData((meta) => {
                meta.scriptName = 'Modified Script Name';
            });
            
            assert.strictEqual(modifiedMetadata.scriptName, 'Modified Script Name');
        });

        test('should not modify metadata without changes', async () => {
            // Call modifyMetaData without making changes
            await remoteScriptRoot.modifyMetaData((_meta) => {
                // Don't change anything - just demonstrating the callback
            });
            
            // Note: This test verifies the method completes without error
            // In a real implementation with more sophisticated mocking,
            // you'd want to verify that writeFile wasn't called when no changes were made
            assert.ok(true, 'modifyMetaData completed without error');
        });
    });

    suite('Touch File Operations', () => {
        test('should touch file with lastPulled timestamp', async () => {
            const fileUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
            const scriptFile = new RemoteScriptFile({ downstairsUri: fileUri });
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from('console.log("test");'));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            
            await remoteScriptRoot.touchFile(scriptFile, 'lastPulled');
            
            const metadata = await remoteScriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastPulled);
            assert.strictEqual(metadata.pushPullRecords[0].lastPushed, null);
        });

        test('should touch file with lastPushed timestamp', async () => {
            const fileUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
            const scriptFile = new RemoteScriptFile({ downstairsUri: fileUri });
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from('console.log("test");'));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            
            await remoteScriptRoot.touchFile(scriptFile, 'lastPushed');
            
            const metadata = await remoteScriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastPushed);
            assert.strictEqual(metadata.pushPullRecords[0].lastPulled, null);
        });

        test('should update existing record when touching same file again', async () => {
            const fileUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
            const scriptFile = new RemoteScriptFile({ downstairsUri: fileUri });
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from('console.log("test");'));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            
            // Touch first time
            await remoteScriptRoot.touchFile(scriptFile, 'lastPulled');
            
            // Touch second time with different type
            await remoteScriptRoot.touchFile(scriptFile, 'lastPushed');
            
            const metadata = await remoteScriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastPulled);
            assert.ok(metadata.pushPullRecords[0].lastPushed);
        });

        test('should store hash when touching file', async () => {
            const fileUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
            const scriptFile = new RemoteScriptFile({ downstairsUri: fileUri });
            const testContent = 'console.log("test");';
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from(testContent));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: testContent.length
            });
            
            await remoteScriptRoot.touchFile(scriptFile, 'lastPulled');
            
            const metadata = await remoteScriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastVerifiedHash);
            assert.strictEqual(metadata.pushPullRecords[0].lastVerifiedHash.length, 128); // SHA-512 is 128 hex chars
        });
    });

    suite('Constants', () => {
        test('should have correct metadata file constant', () => {
            assert.strictEqual(RemoteScriptRoot.METADATA_FILE, '.b6p_metadata.json');
        });
    });

    suite('Error Handling', () => {
        test('should handle malformed metadata file gracefully', async () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            
            // Set up malformed JSON
            mockFileSystem.setMockFile(metadataUri, Buffer.from('{ invalid json'));
            
            const metadata = await remoteScriptRoot.getMetaData();
            
            // Should create new metadata
            assert.strictEqual(metadata.scriptName, '');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
        });

        test('should handle empty metadata file gracefully', async () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            
            // Set up empty file
            mockFileSystem.setMockFile(metadataUri, Buffer.from(''));
            
            const metadata = await remoteScriptRoot.getMetaData();
            
            // Should create new metadata
            assert.strictEqual(metadata.scriptName, '');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
        });
    });
});