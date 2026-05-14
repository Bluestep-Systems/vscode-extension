import * as assert from 'assert';
import { McpRegistrar, MockFileSystem, B6PUri } from '@bluestep-systems/b6p-core';
import type { ILogger } from '@bluestep-systems/b6p-core';

function makeLogger(): ILogger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

function readJson(fs: MockFileSystem, fsPath: string): Record<string, unknown> {
  const content = fs.getMockFileContent(B6PUri.fromFsPath(fsPath));
  if (!content) {throw new Error(`expected file at ${fsPath}`);}
  return JSON.parse(content) as Record<string, unknown>;
}

suite('McpRegistrar Tests', () => {
  let fs: MockFileSystem;
  let registrar: McpRegistrar;

  setup(() => {
    fs = new MockFileSystem();
    registrar = new McpRegistrar(fs, makeLogger());
  });

  suite('register()', () => {
    test('creates .mcp.json when none exists', async () => {
      const result = await registrar.register({
        workspaceDir: '/workspace',
        serverName: 'bluestep-acme',
        entry: { type: 'sse', url: 'https://acme.bluestep.net/sse', headers: { Authorization: 'Basic xyz' } },
      });

      assert.strictEqual(result.replaced, false);
      assert.strictEqual(result.serverName, 'bluestep-acme');
      const json = readJson(fs, '/workspace/.mcp.json') as { mcpServers: Record<string, { type: string; url: string }> };
      assert.deepStrictEqual(json.mcpServers['bluestep-acme'], {
        type: 'sse',
        url: 'https://acme.bluestep.net/sse',
        headers: { Authorization: 'Basic xyz' },
      });
    });

    test('merges into existing .mcp.json without disturbing other keys', async () => {
      fs.setMockFile(
        B6PUri.fromFsPath('/workspace/.mcp.json'),
        JSON.stringify({
          someOtherKey: { keepMe: true },
          mcpServers: {
            'existing-server': { type: 'sse', url: 'https://other.example/sse' },
          },
        }),
      );

      await registrar.register({
        workspaceDir: '/workspace',
        serverName: 'bluestep-acme',
        entry: { type: 'http', url: 'https://acme.bluestep.net/sse' },
      });

      const json = readJson(fs, '/workspace/.mcp.json') as {
        someOtherKey: unknown;
        mcpServers: Record<string, unknown>;
      };
      assert.deepStrictEqual(json.someOtherKey, { keepMe: true });
      assert.ok(json.mcpServers['existing-server']);
      assert.ok(json.mcpServers['bluestep-acme']);
    });

    test('returns replaced=true when overwriting an existing entry', async () => {
      fs.setMockFile(
        B6PUri.fromFsPath('/workspace/.mcp.json'),
        JSON.stringify({
          mcpServers: { 'bluestep-acme': { type: 'sse', url: 'https://old/sse' } },
        }),
      );

      const result = await registrar.register({
        workspaceDir: '/workspace',
        serverName: 'bluestep-acme',
        entry: { type: 'http', url: 'https://acme.bluestep.net/sse' },
      });

      assert.strictEqual(result.replaced, true);
      const json = readJson(fs, '/workspace/.mcp.json') as { mcpServers: Record<string, { type: string; url: string }> };
      assert.strictEqual(json.mcpServers['bluestep-acme'].type, 'http');
      assert.strictEqual(json.mcpServers['bluestep-acme'].url, 'https://acme.bluestep.net/sse');
    });

    test('throws on invalid existing JSON', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/workspace/.mcp.json'), '{ not json');

      await assert.rejects(
        () => registrar.register({
          workspaceDir: '/workspace',
          serverName: 'bluestep-acme',
          entry: { type: 'sse', url: 'https://acme.bluestep.net/sse' },
        }),
        /not valid JSON/,
      );
    });

    test('rejects illegal server names', async () => {
      await assert.rejects(
        () => registrar.register({
          workspaceDir: '/workspace',
          serverName: 'bad name with spaces',
          entry: { type: 'sse', url: 'https://acme.bluestep.net/sse' },
        }),
        /Invalid MCP server name/,
      );
    });
  });

  suite('validateServerName()', () => {
    test('accepts conventional names', () => {
      assert.strictEqual(McpRegistrar.validateServerName('bluestep-acme'), 'bluestep-acme');
      assert.strictEqual(McpRegistrar.validateServerName('with_underscore'), 'with_underscore');
      assert.strictEqual(McpRegistrar.validateServerName('CamelCase42'), 'CamelCase42');
    });

    test('rejects spaces, slashes, dots', () => {
      assert.throws(() => McpRegistrar.validateServerName('has space'), /Invalid MCP server name/);
      assert.throws(() => McpRegistrar.validateServerName('has/slash'), /Invalid MCP server name/);
      assert.throws(() => McpRegistrar.validateServerName('has.dot'), /Invalid MCP server name/);
      assert.throws(() => McpRegistrar.validateServerName(''), /Invalid MCP server name/);
    });
  });

  suite('deriveServerName()', () => {
    test('handles single-tld bluestep subdomain', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://acme.bluestep.net/api/ai/tools'),
        'bluestep-acme',
      );
    });

    test('handles hyphenated subdomain', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://acme-staging.bluestep.net/api/ai/tools'),
        'bluestep-acme-staging',
      );
    });

    test('handles multi-part TLDs (foo.bluestep.com.au)', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://foo.bluestep.com.au/api/ai/tools'),
        'bluestep-foo',
      );
    });

    test('handles bare bluestep.net (no subdomain)', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://bluestep.net/api/ai/tools'),
        'bluestep',
      );
    });

    test('handles multi-level subdomain', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://east.acme.bluestep.net/api'),
        'bluestep-east-acme',
      );
    });

    test('falls back to slugged host for non-bluestep URLs', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://example.com/api'),
        'bluestep-example-com',
      );
    });

    test('lowercases mixed-case hostnames', () => {
      assert.strictEqual(
        McpRegistrar.deriveServerName('https://ACME.BlueStep.NET/api'),
        'bluestep-acme',
      );
    });

    test('throws on invalid URL', () => {
      assert.throws(() => McpRegistrar.deriveServerName('not a url'), /Invalid URL/);
    });
  });

  suite('isMcpJsonGitignored()', () => {
    test('finds .gitignore in the workspace dir itself', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), '.mcp.json\nnode_modules/\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo'), true);
    });

    test('walks upward to find ancestor .gitignore', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), '.mcp.json\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo/sub/dir'), true);
    });

    test('recognises leading-slash form', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), '/.mcp.json\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo'), true);
    });

    test('recognises **/.mcp.json form', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), '**/.mcp.json\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo'), true);
    });

    test('ignores commented lines', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), '# .mcp.json\nnode_modules/\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo'), false);
    });

    test('returns false when no .gitignore exists', async () => {
      assert.strictEqual(await registrar.isMcpJsonGitignored('/lonely/dir'), false);
    });

    test('returns false when .gitignore exists but doesn\'t mention the file', async () => {
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), 'node_modules/\ndist/\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo'), false);
    });

    test('does not match unrelated patterns like *.json', async () => {
      // Conservative matcher: *.json is intentionally not detected so callers
      // know to pass --force.
      fs.setMockFile(B6PUri.fromFsPath('/repo/.gitignore'), '*.json\n');
      assert.strictEqual(await registrar.isMcpJsonGitignored('/repo'), false);
    });
  });

  suite('gitignoreMatchesMcpJson()', () => {
    test('handles CRLF line endings', () => {
      assert.strictEqual(McpRegistrar.gitignoreMatchesMcpJson('node_modules/\r\n.mcp.json\r\n'), true);
    });

    test('handles whitespace-padded entries', () => {
      assert.strictEqual(McpRegistrar.gitignoreMatchesMcpJson('  .mcp.json  \n'), true);
    });

    test('returns false for empty body', () => {
      assert.strictEqual(McpRegistrar.gitignoreMatchesMcpJson(''), false);
    });
  });
});
