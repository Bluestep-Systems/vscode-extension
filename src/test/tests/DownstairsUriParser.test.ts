import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { DownstairsUriParser } from '../../main/app/util/data/DownstairsUrIParser';
import { ScriptRoot } from '../../main/app/util/script/ScriptRoot';

suite('DownstairsUriParser Tests', () => {
  
  suite('Constructor - Valid URI Parsing', () => {
    
    test('should parse basic draft URI correctly', () => {
      const uri = vscode.Uri.file('/workspace/12345/draft');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'workspace');
      assert.strictEqual(parser.scriptName, '12345');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, '');
      assert.strictEqual(parser.rawUri, uri);
    });

    test('should parse basic declarations URI correctly', () => {
      const uri = vscode.Uri.file('/workspace/67890/declarations');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'workspace');
      assert.strictEqual(parser.scriptName, '67890');
      assert.strictEqual(parser.type, 'declarations');
      assert.strictEqual(parser.rest, '');
    });

    test('should parse metadata file URI correctly', () => {
      const uri = vscode.Uri.file('/workspace/11111/.b6p_metadata.json');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'workspace');
      assert.strictEqual(parser.scriptName, '11111');
      assert.strictEqual(parser.type, 'metadata');
      assert.strictEqual(parser.rest, '');
    });

    test('should parse gitignore file URI correctly', () => {
      const uri = vscode.Uri.file('/workspace/22222/.gitignore');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'workspace');
      assert.strictEqual(parser.scriptName, '22222');
      assert.strictEqual(parser.type, 'metadata');
      assert.strictEqual(parser.rest, '');
    });

    test('should parse draft URI with nested file correctly', () => {
      const uri = vscode.Uri.file('/workspace/44444/draft/subfolder/script.js');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'workspace');
      assert.strictEqual(parser.scriptName, '44444');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'subfolder' + path.sep + 'script.js');
    });

    test('should parse declarations URI with nested file correctly', () => {
      const uri = vscode.Uri.file('/workspace/55555/declarations/types/interfaces.d.ts');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'workspace');
      assert.strictEqual(parser.scriptName, '55555');
      assert.strictEqual(parser.type, 'declarations');
      assert.strictEqual(parser.rest, 'types' + path.sep + 'interfaces.d.ts');
    });

    test('should handle deeply nested prepending path', () => {
      const uri = vscode.Uri.file('/very/deep/nested/workspace/folder/66666/draft/file.js');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, path.sep + 'very' + path.sep + 'deep' + path.sep + 'nested' + path.sep + 'workspace' + path.sep + 'folder');
      assert.strictEqual(parser.scriptName, '66666');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'file.js');
    });

    test('should handle empty prepending path', () => {
      const uri = vscode.Uri.file('/77777/draft');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.prependingPath, '');
      assert.strictEqual(parser.scriptName, '77777');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, '');
    });
  });

  suite('Constructor - Error Cases', () => {

    test('should throw error for empty path', () => {
      const uri = vscode.Uri.file('');

      assert.throws(() => {
        new DownstairsUriParser(uri);
      }, /The provided URI does not conform to expected structure/);
    });

    test('should throw error for unrecognized type folder', () => {
      const uri = vscode.Uri.file('/workspace/12345/unknown');

      assert.throws(() => {
        new DownstairsUriParser(uri);
      }, /The provided URI does not conform to expected structure/);
    });
  });

  suite('getShavedName Method', () => {
    
    test('should return correct shaved name for basic URI', () => {
      const uri = vscode.Uri.file('/workspace/12345/draft');
      const parser = new DownstairsUriParser(uri);
      
      const expected = path.sep + 'workspace' + path.sep + '12345';
      assert.strictEqual(parser.getShavedName(), expected);
    });

    test('should return correct shaved name for nested prepending path', () => {
      const uri = vscode.Uri.file('/very/deep/workspace/67890/declarations/file.d.ts');
      const parser = new DownstairsUriParser(uri);
      
      const expected = path.sep + 'very' + path.sep + 'deep' + path.sep + 'workspace' + path.sep + '67890';
      assert.strictEqual(parser.getShavedName(), expected);
    });

    test('should be consistent regardless of rest content', () => {
      const uri1 = vscode.Uri.file('/workspace/12345/draft');
      const uri2 = vscode.Uri.file('/workspace/12345/draft/deep/nested/file.js');
      
      const parser1 = new DownstairsUriParser(uri1);
      const parser2 = new DownstairsUriParser(uri2);
      
      assert.strictEqual(parser1.getShavedName(), parser2.getShavedName());
    });

    test('should be consistent regardless of type', () => {
      const uri1 = vscode.Uri.file('/workspace/12345/draft');
      const uri2 = vscode.Uri.file('/workspace/12345/declarations');
      const uri3 = vscode.Uri.file('/workspace/12345/.b6p_metadata.json');
      
      const parser1 = new DownstairsUriParser(uri1);
      const parser2 = new DownstairsUriParser(uri2);
      const parser3 = new DownstairsUriParser(uri3);
      
      const shavedName = parser1.getShavedName();
      assert.strictEqual(parser2.getShavedName(), shavedName);
      assert.strictEqual(parser3.getShavedName(), shavedName);
    });
  });

  suite('equals Method', () => {
    
    test('should return true for identical parsers', () => {
      const uri = vscode.Uri.file('/workspace/12345/draft/file.js');
      const parser1 = new DownstairsUriParser(uri);
      const parser2 = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser1.equals(parser2), true);
    });

    test('should return false for different prepending paths', () => {
      const uri1 = vscode.Uri.file('/workspace1/12345/draft/file.js');
      const uri2 = vscode.Uri.file('/workspace2/12345/draft/file.js');
      const parser1 = new DownstairsUriParser(uri1);
      const parser2 = new DownstairsUriParser(uri2);
      
      assert.strictEqual(parser1.equals(parser2), false);
    });

    test('should return false for different WebDAV IDs', () => {
      const uri1 = vscode.Uri.file('/workspace/12345/draft/file.js');
      const uri2 = vscode.Uri.file('/workspace/67890/draft/file.js');
      const parser1 = new DownstairsUriParser(uri1);
      const parser2 = new DownstairsUriParser(uri2);
      
      assert.strictEqual(parser1.equals(parser2), false);
    });

    test('should return false for different types', () => {
      const uri1 = vscode.Uri.file('/workspace/12345/draft/file.js');
      const uri2 = vscode.Uri.file('/workspace/12345/declarations/file.js');
      const parser1 = new DownstairsUriParser(uri1);
      const parser2 = new DownstairsUriParser(uri2);
      
      assert.strictEqual(parser1.equals(parser2), false);
    });

    test('should return false for different rest paths', () => {
      const uri1 = vscode.Uri.file('/workspace/12345/draft/file1.js');
      const uri2 = vscode.Uri.file('/workspace/12345/draft/file2.js');
      const parser1 = new DownstairsUriParser(uri1);
      const parser2 = new DownstairsUriParser(uri2);
      
      assert.strictEqual(parser1.equals(parser2), false);
    });
  });

  suite('isDeclarationsOrDraft Method', () => {
    
    test('should return true for draft type', () => {
      const uri = vscode.Uri.file('/workspace/12345/draft/file.js');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.isDeclarationsOrDraft(), true);
    });

    test('should return true for declarations type', () => {
      const uri = vscode.Uri.file('/workspace/12345/declarations/types.d.ts');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.isDeclarationsOrDraft(), true);
    });

    test('should return false for metadata type (.b6p_metadata.json)', () => {
      const uri = vscode.Uri.file('/workspace/12345/.b6p_metadata.json');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.isDeclarationsOrDraft(), false);
    });

    test('should return false for metadata type (.gitignore)', () => {
      const uri = vscode.Uri.file('/workspace/12345/.gitignore');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.isDeclarationsOrDraft(), false);
    });
  });

  suite('prependingPathUri Method', () => {
    
    test('should return correct URI for basic prepending path', () => {
      const uri = vscode.Uri.file('/workspace/12345/draft');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      assert.strictEqual(prependingUri.fsPath, path.sep + 'workspace');
      assert.strictEqual(prependingUri.scheme, 'file');
    });

    test('should return correct URI for nested prepending path', () => {
      const uri = vscode.Uri.file('/very/deep/nested/workspace/folder/67890/declarations/file.d.ts');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      assert.strictEqual(prependingUri.fsPath, path.sep + 'very' + path.sep + 'deep' + path.sep + 'nested' + path.sep + 'workspace' + path.sep + 'folder');
      assert.strictEqual(prependingUri.scheme, 'file');
    });

    test('should return correct URI for empty prepending path', () => {
      const uri = vscode.Uri.file('/77777/draft');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      // Note: When prepending path is empty, vscode.Uri.file('') normalizes to '/'
      // This is expected VS Code behavior for root paths
      assert.strictEqual(prependingUri.fsPath, path.sep);
      assert.strictEqual(prependingUri.scheme, 'file');
      assert.strictEqual(parser.prependingPath, ''); // The raw property should still be empty
    });

    test('should be consistent with prependingPath property', () => {
      const uri = vscode.Uri.file('/some/complex/path/structure/88888/draft/nested/file.js');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      assert.strictEqual(prependingUri.fsPath, parser.prependingPath);
    });

    test('should work with Windows-style paths', () => {
      const uri = vscode.Uri.file('C:\\workspace\\projects\\12345\\declarations\\types.d.ts');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      // Note: vscode.Uri.file() normalizes Windows paths
      assert.strictEqual(prependingUri.scheme, 'file');
      // The exact path format may vary by platform, but should be consistent with prependingPath
      assert.strictEqual(prependingUri.fsPath, parser.prependingPath);
    });

    test('should return valid URI that can be used for file operations', () => {
      const uri = vscode.Uri.file('/workspace/projects/99999/draft/script.js');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      
      // Should be able to create new URIs relative to this one
      const childUri = vscode.Uri.joinPath(prependingUri, 'subfolder', 'file.txt');
      assert.strictEqual(childUri.scheme, 'file');
      assert.strictEqual(childUri.fsPath.includes('workspace' + path.sep + 'projects'), true);
    });

    test('should handle metadata files correctly', () => {
      const uri = vscode.Uri.file('/workspace/11111/.b6p_metadata.json');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      assert.strictEqual(prependingUri.fsPath, path.sep + 'workspace');
      assert.strictEqual(prependingUri.scheme, 'file');
    });

    test('should handle gitignore files correctly', () => {
      const uri = vscode.Uri.file('/workspace/22222/.gitignore');
      const parser = new DownstairsUriParser(uri);
      
      const prependingUri = parser.prependingPathUri();
      assert.strictEqual(prependingUri.fsPath, path.sep + 'workspace');
      assert.strictEqual(prependingUri.scheme, 'file');
    });

    test('should be consistent across different types from same root', () => {
      const draftUri = vscode.Uri.file('/workspace/12345/draft/file.js');
      const declarationsUri = vscode.Uri.file('/workspace/12345/declarations/types.d.ts');
      const metadataUri = vscode.Uri.file('/workspace/12345/.b6p_metadata.json');
      
      const draftParser = new DownstairsUriParser(draftUri);
      const declarationsParser = new DownstairsUriParser(declarationsUri);
      const metadataParser = new DownstairsUriParser(metadataUri);
      
      const draftPrependingUri = draftParser.prependingPathUri();
      const declarationsPrependingUri = declarationsParser.prependingPathUri();
      const metadataPrependingUri = metadataParser.prependingPathUri();
      
      assert.strictEqual(draftPrependingUri.fsPath, declarationsPrependingUri.fsPath);
      assert.strictEqual(draftPrependingUri.fsPath, metadataPrependingUri.fsPath);
      assert.strictEqual(draftPrependingUri.toString(), declarationsPrependingUri.toString());
      assert.strictEqual(draftPrependingUri.toString(), metadataPrependingUri.toString());
    });
  });

  suite('Integration with RemoteScriptRoot Constants', () => {
    
    test('should correctly identify metadata files using RemoteScriptRoot constants', () => {
      const metadataUri = vscode.Uri.file(`/workspace/12345/${ScriptRoot.METADATA_FILENAME}`);
      const gitignoreUri = vscode.Uri.file(`/workspace/12345/${ScriptRoot.GITIGNORE_FILENAME}`);
      
      const metadataParser = new DownstairsUriParser(metadataUri);
      const gitignoreParser = new DownstairsUriParser(gitignoreUri);
      
      assert.strictEqual(metadataParser.type, 'metadata');
      assert.strictEqual(gitignoreParser.type, 'metadata');
    });
  });

  suite('Windows Path Handling', () => {
    
    test('should parse Windows-style draft URI correctly', () => {
      const uri = vscode.Uri.file('C:\\workspace\\12345\\draft\\file.js');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.scriptName, '12345');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'file.js');
    });

    test('should parse Windows-style declarations URI correctly', () => {
      const uri = vscode.Uri.file('D:\\projects\\67890\\declarations\\types\\index.d.ts');
      const parser = new DownstairsUriParser(uri);
      
      assert.strictEqual(parser.scriptName, '67890');
      assert.strictEqual(parser.type, 'declarations');
      assert.strictEqual(parser.rest, 'types\\index.d.ts');
    });
  });
});