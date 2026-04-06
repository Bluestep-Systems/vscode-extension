import * as assert from 'assert';
import * as path from 'path';
import { DownstairsPathParser } from '../../core/data/DownstairsPathParser';
import { B6PUri } from '../../core/B6PUri';

suite('DownstairsPathParser Tests', () => {

  suite('Constructor - Valid Path Parsing', () => {

    test('should parse basic draft path correctly', () => {
      const testPath = '/workspace/U100001/12345/draft';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'workspace' + path.sep + 'U100001');
      assert.strictEqual(parser.scriptName, '12345');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, '');
      assert.strictEqual(parser.rawPath, testPath);
    });

    test('should parse basic declarations path correctly', () => {
      const testPath = '/workspace/U100002/67890/declarations';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'workspace' + path.sep + 'U100002');
      assert.strictEqual(parser.scriptName, '67890');
      assert.strictEqual(parser.type, 'declarations');
      assert.strictEqual(parser.rest, '');
    });
    
    test('should reject .b6p_metadata.json as invalid type segment', () => {
      const testPath = '/workspace/U100003/11111/.b6p_metadata.json';

      assert.throws(() => {
        new DownstairsPathParser(testPath);
      }, /Invalid type segment: .b6p_metadata.json/);
    });
    test('should parse root file path correctly', () => {
      const testPath = '/home/brendan/test/extensiontest/U900005/Fresh Test/';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'home' + path.sep + 'brendan' + path.sep + 'test' + path.sep + 'extensiontest' + path.sep + 'U900005');
      assert.strictEqual(parser.scriptName, 'Fresh Test');
      assert.strictEqual(parser.type, 'root');
      assert.strictEqual(parser.rest, '');
    });
    test('should parse root file path correctly without trailing slash', () => {
      const testPath = '/home/brendan/test/extensiontest/U900005/Fresh Test';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'home' + path.sep + 'brendan' + path.sep + 'test' + path.sep + 'extensiontest' + path.sep + 'U900005');
      assert.strictEqual(parser.scriptName, 'Fresh Test');
      assert.strictEqual(parser.type, 'root');
      assert.strictEqual(parser.rest, '');
    });

    test('should parse gitignore file path correctly', () => {
      const testPath = '/workspace/U100004/22222/.gitignore';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'workspace' + path.sep + 'U100004');
      assert.strictEqual(parser.scriptName, '22222');
      assert.strictEqual(parser.type, 'metadata');
      assert.strictEqual(parser.rest, '');
    });

    test('should parse draft path with nested file correctly', () => {
      const testPath = '/workspace/U100005/44444/draft/subfolder/script.js';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'workspace' + path.sep + 'U100005');
      assert.strictEqual(parser.scriptName, '44444');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'subfolder' + path.sep + 'script.js');
    });

    test('should parse declarations path with nested file correctly', () => {
      const testPath = '/workspace/U100006/55555/declarations/types/interfaces.d.ts';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'workspace' + path.sep + 'U100006');
      assert.strictEqual(parser.scriptName, '55555');
      assert.strictEqual(parser.type, 'declarations');
      assert.strictEqual(parser.rest, 'types' + path.sep + 'interfaces.d.ts');
    });

    test('should handle deeply nested prepending path', () => {
      const testPath = '/very/deep/nested/workspace/folder/U100007/66666/draft/file.js';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.prependingPath, path.sep + 'very' + path.sep + 'deep' + path.sep + 'nested' + path.sep + 'workspace' + path.sep + 'folder' + path.sep + 'U100007');
      assert.strictEqual(parser.scriptName, '66666');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'file.js');
    });

    test('should handle empty prepending path - REMOVED - should throw error', () => {
      // This test was incorrect - the path /77777/draft is missing the U###### organization ID
      // The minimum valid structure is prependingPath/U######/scriptName/type
      const testPath = '/77777/draft';

      assert.throws(() => {
        new DownstairsPathParser(testPath);
      }, /Path must contain a segment matching U###### pattern/);
    });
  });

  suite('Constructor - Error Cases', () => {

    test('should throw error for empty path', () => {
      const testPath = '';

      assert.throws(() => {
        new DownstairsPathParser(testPath);
      }, /The provided URI does not conform to expected structure/);
    });

    test('should throw error for unrecognized type folder', () => {
      const testPath = '/workspace/U100008/12345/unknown';

      assert.throws(() => {
        new DownstairsPathParser(testPath);
      }, /Invalid type segment: unknown/);
    });
  });

  suite('getShavedName Method', () => {

    test('should return correct shaved name for basic path', () => {
      const testPath = '/workspace/U100009/12345/draft';
      const parser = new DownstairsPathParser(testPath);

      const expected = path.sep + 'workspace' + path.sep + 'U100009' + path.sep + '12345';
      assert.strictEqual(parser.getShavedName(), expected);
    });

    test('should return correct shaved name for nested prepending path', () => {
      const testPath = '/very/deep/workspace/U100010/67890/declarations/file.d.ts';
      const parser = new DownstairsPathParser(testPath);

      const expected = path.sep + 'very' + path.sep + 'deep' + path.sep + 'workspace' + path.sep + 'U100010' + path.sep + '67890';
      assert.strictEqual(parser.getShavedName(), expected);
    });

    test('should be consistent regardless of rest content', () => {
      const testPath1 = '/workspace/U100011/12345/draft';
      const testPath2 = '/workspace/U100011/12345/draft/deep/nested/file.js';

      const parser1 = new DownstairsPathParser(testPath1);
      const parser2 = new DownstairsPathParser(testPath2);

      assert.strictEqual(parser1.getShavedName(), parser2.getShavedName());
    });

    test('should be consistent regardless of type', () => {
      const testPath1 = '/workspace/U100012/12345/draft';
      const testPath2 = '/workspace/U100012/12345/declarations';
      const testPath3 = '/workspace/U100012/12345/.gitignore';

      const parser1 = new DownstairsPathParser(testPath1);
      const parser2 = new DownstairsPathParser(testPath2);
      const parser3 = new DownstairsPathParser(testPath3);

      const shavedName = parser1.getShavedName();
      assert.strictEqual(parser2.getShavedName(), shavedName);
      assert.strictEqual(parser3.getShavedName(), shavedName);
    });
  });

  suite('equals Method', () => {

    test('should return true for identical parsers', () => {
      const testPath = '/workspace/U100013/12345/draft/file.js';
      const parser1 = new DownstairsPathParser(testPath);
      const parser2 = new DownstairsPathParser(testPath);

      assert.strictEqual(parser1.equals(parser2), true);
    });

    test('should return false for different prepending paths', () => {
      const testPath1 = '/workspace1/U100014/12345/draft/file.js';
      const testPath2 = '/workspace2/U100014/12345/draft/file.js';
      const parser1 = new DownstairsPathParser(testPath1);
      const parser2 = new DownstairsPathParser(testPath2);

      assert.strictEqual(parser1.equals(parser2), false);
    });

    test('should return false for different WebDAV IDs', () => {
      const testPath1 = '/workspace/U100015/12345/draft/file.js';
      const testPath2 = '/workspace/U100015/67890/draft/file.js';
      const parser1 = new DownstairsPathParser(testPath1);
      const parser2 = new DownstairsPathParser(testPath2);

      assert.strictEqual(parser1.equals(parser2), false);
    });

    test('should return false for different types', () => {
      const testPath1 = '/workspace/U100016/12345/draft/file.js';
      const testPath2 = '/workspace/U100016/12345/declarations/file.js';
      const parser1 = new DownstairsPathParser(testPath1);
      const parser2 = new DownstairsPathParser(testPath2);

      assert.strictEqual(parser1.equals(parser2), false);
    });

    test('should return false for different rest paths', () => {
      const testPath1 = '/workspace/U100017/12345/draft/file1.js';
      const testPath2 = '/workspace/U100017/12345/draft/file2.js';
      const parser1 = new DownstairsPathParser(testPath1);
      const parser2 = new DownstairsPathParser(testPath2);

      assert.strictEqual(parser1.equals(parser2), false);
    });
  });

  suite('isDeclarationsOrDraft Method', () => {

    test('should return true for draft type', () => {
      const testPath = '/workspace/U100018/12345/draft/file.js';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.isDeclarationsOrDraft(), true);
    });

    test('should return true for declarations type', () => {
      const testPath = '/workspace/U100019/12345/declarations/types.d.ts';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.isDeclarationsOrDraft(), true);
    });

    test('should reject .b6p_metadata.json in isDeclarationsOrDraft context', () => {
      const testPath = '/workspace/U100020/12345/.b6p_metadata.json';

      assert.throws(() => {
        new DownstairsPathParser(testPath);
      }, /Invalid type segment: .b6p_metadata.json/);
    });

    test('should return false for metadata type (.gitignore)', () => {
      const testPath = '/workspace/U100021/12345/.gitignore';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.isDeclarationsOrDraft(), false);
    });
  });



  suite('Paths with Spaces and Special Characters', () => {

    test('should handle scriptName with spaces and .gitignore', () => {
      // Using B6PUri to handle URL-encoded paths correctly
      const uri = B6PUri.fromUrl('file:///c%3A/Users/jrigb/Bluestep/Organizations/U142023/Site%20Audit%20Post-Save/.gitignore');
      const parser = new DownstairsPathParser(uri.fsPath);

      assert.strictEqual(parser.scriptName, 'Site Audit Post-Save');
      assert.strictEqual(parser.type, 'metadata');
      assert.strictEqual(parser.rest, '');
    });

    test('should handle scriptName with spaces in draft folder', () => {
      const testPath = '/workspace/U100030/My Script Name/draft/file.js';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.scriptName, 'My Script Name');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'file.js');
    });

    test('should handle scriptName with multiple spaces', () => {
      const testPath = '/workspace/U100031/Multi  Space   Name/declarations/types.d.ts';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.scriptName, 'Multi  Space   Name');
      assert.strictEqual(parser.type, 'declarations');
      assert.strictEqual(parser.rest, 'types.d.ts');
    });

    test('should handle special characters in scriptName', () => {
      const testPath = '/workspace/U100032/Script-Name_123 (v2)/draft/file.js';
      const parser = new DownstairsPathParser(testPath);

      assert.strictEqual(parser.scriptName, 'Script-Name_123 (v2)');
      assert.strictEqual(parser.type, 'draft');
      assert.strictEqual(parser.rest, 'file.js');
    });
  });
});