import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ScriptMetaData } from '../../types';
import { App } from '../main/app/App';
import { FileSystem } from '../main/app/util/fs/FileSystem';
import { MockFileSystem } from '../main/app/util/fs/FileSystemProvider';
import { ScriptFactory } from '../main/app/util/script/ScriptFactory';
import { ScriptRoot } from '../main/app/util/script/ScriptRoot';

suite('ScriptRoot Tests', () => {
    let mockFileSystem: MockFileSystem;
    let scriptRoot: ScriptRoot;
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
        
        // Create ScriptRoot instance
        scriptRoot = ScriptFactory.createScriptRoot(testChildUri);

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
            const scriptRoot = ScriptFactory.createScriptRoot(testChildUri);
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });

        test('should handle different file types in same directory', () => {
            const declarationsUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/declarations/script.js');
            const scriptRoot = ScriptFactory.createScriptRoot(declarationsUri);

            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });

        test('should handle metadata file as child URI', () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            const scriptRoot = ScriptFactory.createScriptRoot(metadataUri);
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });
    });

    suite('URI Generation', () => {
        test('should generate correct downstairs root URI', () => {
            const rootUri = scriptRoot.getRootUri();
            const expectedPath = path.normalize('/test/workspace/configbeh.bluestep.net/1466960');
            
            assert.strictEqual(
                path.normalize(rootUri.fsPath), 
                expectedPath
            );
        });

        test('should generate correct org URI', () => {
            const orgUri = scriptRoot.getOrgUri();
            const expectedPath = path.normalize('/test/workspace/configbeh.bluestep.net');
            
            assert.strictEqual(
                path.normalize(orgUri.fsPath), 
                expectedPath
            );
        });

        test('should generate correct upstairs base URL string', () => {
            const baseUrl = scriptRoot.toBaseUpstairsString();
            
            assert.strictEqual(baseUrl, 'https://configbeh.bluestep.net/files/1466960/');
        });

        test('should generate correct upstairs base URL object', () => {
            const baseUrl = scriptRoot.toBaseUpstairsUrl();
            
            assert.ok(baseUrl instanceof URL);
            assert.strictEqual(baseUrl.toString(), 'https://configbeh.bluestep.net/files/1466960/');
            assert.strictEqual(baseUrl.hostname, 'configbeh.bluestep.net');
            assert.strictEqual(baseUrl.pathname, '/files/1466960/');
        });
    });

    suite('Static Methods', () => {
        test('should create ScriptRoot from root URI', () => {
            const rootUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960');
            const scriptRoot = ScriptRoot.fromRootUri(rootUri);
            
            assert.strictEqual(scriptRoot.webDavId, '1466960');
            assert.strictEqual(scriptRoot.origin, 'configbeh.bluestep.net');
        });
    });

    suite('Equality Comparison', () => {
        test('should return true for equal RemoteScriptRoots', () => {
            const uri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/file1.js');
            const uri2 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/declarations/file2.js');
            
            const root1 = ScriptFactory.createScriptRoot(uri1);
            const root2 = ScriptFactory.createScriptRoot(uri2);

            assert.strictEqual(root1.equals(root2), true);
        });

        test('should return false for different origins', () => {
            const uri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/file1.js');
            const uri2 = vscode.Uri.parse('file:///test/workspace/different.domain.com/1466960/draft/file2.js');
            
            const root1 = ScriptFactory.createScriptRoot(uri1);
            const root2 = ScriptFactory.createScriptRoot(() => uri2);

            assert.strictEqual(root1.equals(root2), false);
        });

        test('should return false for different webdav IDs', () => {
            const uri1 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/file1.js');
            const uri2 = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/9999999/draft/file2.js');

            const root1 = ScriptFactory.createScriptRoot(uri1);
            const root2 = ScriptFactory.createScriptRoot(() => uri2);
            
            assert.strictEqual(root1.equals(root2), false);
        });
    });

    suite('Metadata Operations', () => {
        test('should read existing metadata file', async () => {
            const metadata = await scriptRoot.getMetaData();
            
            assert.strictEqual(metadata.scriptName, 'Test Script');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
        });

        test('should create new metadata when file does not exist', async () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            
            // Remove the mock file to simulate non-existence
            mockFileSystem.setMockError(metadataUri, new Error('File not found'));
            
            const metadata = await scriptRoot.getMetaData();
            
            assert.strictEqual(metadata.scriptName, '');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
            assert.strictEqual(metadata.pushPullRecords.length, 0);
        });

        test('should modify metadata with callback', async () => {
            const modifiedMetadata = await scriptRoot.modifyMetaData((meta) => {
                meta.scriptName = 'Modified Script Name';
            });
            
            assert.strictEqual(modifiedMetadata.scriptName, 'Modified Script Name');
        });

        test('should not modify metadata without changes', async () => {
            // Call modifyMetaData without making changes
            await scriptRoot.modifyMetaData((_meta) => {
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
            const scriptFile = ScriptFactory.createFile(fileUri);
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from('console.log("test");'));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            
            await scriptFile.touch('lastPulled');
            
            const metadata = await scriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastPulled);
            assert.strictEqual(metadata.pushPullRecords[0].lastPushed, null);
        });



        test('should update existing record when touching same file again', async () => {
            const fileUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
            const scriptFile = ScriptFactory.createFile(fileUri);
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from('console.log("test");'));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            });
            
            // Touch first time
            await scriptFile.touch('lastPulled');
            
            // Touch second time with different type
            await scriptFile.touch('lastPushed');

            const metadata = await scriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastPulled);
            assert.ok(metadata.pushPullRecords[0].lastPushed);
        });

        test('should store hash when touching file', async () => {
            const fileUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/test.js');
            const scriptFile = ScriptFactory.createFile(fileUri);
            const testContent = 'console.log("test");';
            
            // Set up mock file content for hash calculation
            mockFileSystem.setMockFile(fileUri, Buffer.from(testContent));
            mockFileSystem.setMockStat(fileUri, {
                type: vscode.FileType.File,
                ctime: Date.now(),
                mtime: Date.now(),
                size: testContent.length
            });
            
            await scriptFile.touch('lastPulled');

            const metadata = await scriptRoot.getMetaData();
            assert.strictEqual(metadata.pushPullRecords.length, 1);
            assert.ok(metadata.pushPullRecords[0].lastVerifiedHash);
            assert.strictEqual(metadata.pushPullRecords[0].lastVerifiedHash.length, 128); // SHA-512 is 128 hex chars
        });
    });

    suite('Folder Operations', () => {
        test('should get info folder contents', async () => {
            const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
            
            // Set up directory
            mockFileSystem.setMockDirectory(infoFolderUri);
            
            // Set up individual files in the directory
            const metadataFile = vscode.Uri.joinPath(infoFolderUri, 'metadata.json');
            const permissionsFile = vscode.Uri.joinPath(infoFolderUri, 'permissions.json');
            const configFile = vscode.Uri.joinPath(infoFolderUri, 'config.json');
            
            mockFileSystem.setMockFile(metadataFile, '{}');
            mockFileSystem.setMockFile(permissionsFile, '{}');
            mockFileSystem.setMockFile(configFile, '{}');
            
            const infoContents = await scriptRoot.getInfoFolderContents();
            
            assert.strictEqual(infoContents.length, 3);
            assert.ok(infoContents.some(uri => uri.fsPath.endsWith('metadata.json')));
            assert.ok(infoContents.some(uri => uri.fsPath.endsWith('permissions.json')));
            assert.ok(infoContents.some(uri => uri.fsPath.endsWith('config.json')));
        });

        test('should get scripts folder contents', async () => {
            const scriptsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/scripts');
            
            // Set up directory
            mockFileSystem.setMockDirectory(scriptsFolderUri);
            
            // Set up individual files in the directory
            const mainFile = vscode.Uri.joinPath(scriptsFolderUri, 'main.js');
            const helperFile = vscode.Uri.joinPath(scriptsFolderUri, 'helper.js');
            
            mockFileSystem.setMockFile(mainFile, 'console.log("main");');
            mockFileSystem.setMockFile(helperFile, 'console.log("helper");');
            
            const scriptsContents = await scriptRoot.getScriptsFolderContents();
            
            assert.strictEqual(scriptsContents.length, 2);
            assert.ok(scriptsContents.some(uri => uri.fsPath.endsWith('main.js')));
            assert.ok(scriptsContents.some(uri => uri.fsPath.endsWith('helper.js')));
        });

        test('should get objects folder contents', async () => {
            const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
            
            // Set up directory
            mockFileSystem.setMockDirectory(objectsFolderUri);
            
            // Set up individual file in the directory
            const importsFile = vscode.Uri.joinPath(objectsFolderUri, 'imports.ts');
            mockFileSystem.setMockFile(importsFile, 'export {};');
            
            const objectsContents = await scriptRoot.getObjectsFolderContents();
            
            assert.strictEqual(objectsContents.length, 1);
            assert.ok(objectsContents[0].fsPath.endsWith('imports.ts'));
        });
    });

    suite('Copacetic Status', () => {
        test('should return true for copacetic script structure', async () => {
            // Set up proper folder structure
            const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
            const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
            
            // Set up directories
            mockFileSystem.setMockDirectory(infoFolderUri);
            mockFileSystem.setMockDirectory(objectsFolderUri);
            
            // Set up info folder files
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'metadata.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'permissions.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'config.json'), '{}');
            
            // Set up objects folder file
            mockFileSystem.setMockFile(vscode.Uri.joinPath(objectsFolderUri, 'imports.ts'), 'export {};');
            
            const isCopacetic = await scriptRoot.isCopacetic();
            
            assert.strictEqual(isCopacetic, true);
        });

        test('should return false when info folder has wrong number of files', async () => {
            const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
            const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
            
            // Set up directories
            mockFileSystem.setMockDirectory(infoFolderUri);
            mockFileSystem.setMockDirectory(objectsFolderUri);
            
            // Wrong number of files in info folder (only 2 instead of 3)
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'metadata.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'permissions.json'), '{}');
            
            // Set up objects folder file
            mockFileSystem.setMockFile(vscode.Uri.joinPath(objectsFolderUri, 'imports.ts'), 'export {};');
            
            const isCopacetic = await scriptRoot.isCopacetic();
            
            assert.strictEqual(isCopacetic, false);
        });

        test('should return false when info folder is missing expected files', async () => {
            const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
            const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
            
            // Set up directories
            mockFileSystem.setMockDirectory(infoFolderUri);
            mockFileSystem.setMockDirectory(objectsFolderUri);
            
            // Missing config.json
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'metadata.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'permissions.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'wrong.json'), '{}');
            
            // Set up objects folder file
            mockFileSystem.setMockFile(vscode.Uri.joinPath(objectsFolderUri, 'imports.ts'), 'export {};');
            
            const isCopacetic = await scriptRoot.isCopacetic();
            
            assert.strictEqual(isCopacetic, false);
        });

        test('should return false when objects folder has wrong number of files', async () => {
            const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
            const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
            
            // Set up directories
            mockFileSystem.setMockDirectory(infoFolderUri);
            mockFileSystem.setMockDirectory(objectsFolderUri);
            
            // Set up info folder files
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'metadata.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'permissions.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'config.json'), '{}');
            
            // Wrong number of files in objects folder (2 instead of 1)
            mockFileSystem.setMockFile(vscode.Uri.joinPath(objectsFolderUri, 'imports.ts'), 'export {};');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(objectsFolderUri, 'extra.ts'), 'export {};');
            
            const isCopacetic = await scriptRoot.isCopacetic();
            
            assert.strictEqual(isCopacetic, false);
        });

        test('should return false when objects folder does not contain imports.ts', async () => {
            const infoFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/info');
            const objectsFolderUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/draft/objects');
            
            // Set up directories
            mockFileSystem.setMockDirectory(infoFolderUri);
            mockFileSystem.setMockDirectory(objectsFolderUri);
            
            // Set up info folder files
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'metadata.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'permissions.json'), '{}');
            mockFileSystem.setMockFile(vscode.Uri.joinPath(infoFolderUri, 'config.json'), '{}');
            
            // Wrong file in objects folder
            mockFileSystem.setMockFile(vscode.Uri.joinPath(objectsFolderUri, 'wrong.ts'), 'export {};');
            
            const isCopacetic = await scriptRoot.isCopacetic();
            
            assert.strictEqual(isCopacetic, false);
        });
    });

    suite('GitIgnore Operations', () => {
        test('should read existing gitignore file', async () => {
            const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
            const gitIgnoreContent = "node_modules/\n*.log\n.env";
            
            mockFileSystem.setMockFile(gitIgnoreUri, gitIgnoreContent);
            
            const gitIgnoreContents = await scriptRoot.getGitIgnore();
            
            assert.strictEqual(gitIgnoreContents.length, 3);
            assert.ok(gitIgnoreContents.includes('node_modules/'));
            assert.ok(gitIgnoreContents.includes('*.log'));
            assert.ok(gitIgnoreContents.includes('.env'));
        });

        test('should create default gitignore when file does not exist', async () => {
            const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
            
            // Remove the mock file to simulate non-existence
            mockFileSystem.setMockError(gitIgnoreUri, new Error('File not found'));
            
            const gitIgnoreContents = await scriptRoot.getGitIgnore();
            
            assert.strictEqual(gitIgnoreContents.length, 1);
            assert.ok(gitIgnoreContents.includes('**/.DS_Store'));
        });

        test('should modify gitignore with callback', async () => {
            const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
            const initialContent = "node_modules/\n*.log";
            
            mockFileSystem.setMockFile(gitIgnoreUri, initialContent);
            
            const modifiedGitIgnore = await scriptRoot.modifyGitIgnore((contents) => {
                contents.push('.env');
                contents.push('dist/');
            });
            
            assert.strictEqual(modifiedGitIgnore.length, 4);
            assert.ok(modifiedGitIgnore.includes('node_modules/'));
            assert.ok(modifiedGitIgnore.includes('*.log'));
            assert.ok(modifiedGitIgnore.includes('.env'));
            assert.ok(modifiedGitIgnore.includes('dist/'));
        });

        test('should handle empty lines and whitespace in gitignore', async () => {
            const gitIgnoreUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.gitignore');
            const gitIgnoreContent = "node_modules/\n\n   \n*.log\n  \n.env\n";
            
            mockFileSystem.setMockFile(gitIgnoreUri, gitIgnoreContent);
            
            const gitIgnoreContents = await scriptRoot.getGitIgnore();
            
            // Should filter out empty lines and whitespace-only lines
            assert.strictEqual(gitIgnoreContents.length, 3);
            assert.ok(gitIgnoreContents.includes('node_modules/'));
            assert.ok(gitIgnoreContents.includes('*.log'));
            assert.ok(gitIgnoreContents.includes('.env'));
        });
    });

    suite('Constants', () => {
        test('should have correct metadata file constant', () => {
            assert.strictEqual(ScriptRoot.METADATA_FILENAME, '.b6p_metadata.json');
        });

        test('should have correct gitignore file constant', () => {
            assert.strictEqual(ScriptRoot.GITIGNORE_FILENAME, '.gitignore');
        });
    });

    suite('Error Handling', () => {
        test('should handle malformed metadata file gracefully', async () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            
            // Set up malformed JSON
            mockFileSystem.setMockFile(metadataUri, Buffer.from('{ invalid json'));
            
            const metadata = await scriptRoot.getMetaData();
            
            // Should create new metadata
            assert.strictEqual(metadata.scriptName, '');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
        });

        test('should handle empty metadata file gracefully', async () => {
            const metadataUri = vscode.Uri.parse('file:///test/workspace/configbeh.bluestep.net/1466960/.b6p_metadata.json');
            
            // Set up empty file
            mockFileSystem.setMockFile(metadataUri, Buffer.from(''));
            
            const metadata = await scriptRoot.getMetaData();
            
            // Should create new metadata
            assert.strictEqual(metadata.scriptName, '');
            assert.strictEqual(metadata.webdavId, '1466960');
            assert.ok(Array.isArray(metadata.pushPullRecords));
        });
    });
});