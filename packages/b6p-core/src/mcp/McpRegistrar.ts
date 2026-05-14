import * as path from 'path';
import { B6PUri } from '../B6PUri';
import type { IFileSystem, ILogger } from '../providers';

/**
 * Shape of a single entry under `mcpServers` in a Claude Code `.mcp.json`.
 *
 * Models the HTTP-style transports (`http` / `sse`) — BlueStep MCP endpoints
 * use `sse`. Stdio entries (`command` + `args`) are out of scope for this
 * registrar. Extra fields on the existing file are preserved verbatim on merge.
 */
export interface McpServerEntry {
  type: 'sse' | 'http';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Loose shape of a Claude Code `.mcp.json` file.
 *
 * Only the `mcpServers` map is structurally relevant to us; anything else
 * the file might contain is round-tripped untouched.
 */
interface McpJsonFile {
  mcpServers?: Record<string, McpServerEntry>;
  [key: string]: unknown;
}

/**
 * Result of a successful registration.
 */
export interface RegisterResult {
  /** Absolute path of the `.mcp.json` that was written. */
  filePath: string;
  /** Name used as the key under `mcpServers`. */
  serverName: string;
  /** Whether an entry with this name already existed and got overwritten. */
  replaced: boolean;
}

const MCP_JSON_FILENAME = '.mcp.json';

/**
 * Registers a BlueStep-hosted MCP server in a workspace-local `.mcp.json`.
 *
 * BlueStep serves the MCP protocol itself; `b6p` does **not** proxy tool calls.
 * This class just writes the JSON pointer Claude Code reads at session start.
 */
export class McpRegistrar {
  constructor(
    private readonly fs: IFileSystem,
    private readonly logger: ILogger,
  ) {}

  /**
   * Read `.mcp.json` (or `{}` if absent), merge in the supplied entry, write back.
   */
  async register(opts: {
    workspaceDir: string;
    serverName: string;
    entry: McpServerEntry;
  }): Promise<RegisterResult> {
    const filePath = path.join(opts.workspaceDir, MCP_JSON_FILENAME);
    const uri = B6PUri.fromFsPath(filePath);

    let existing: McpJsonFile = {};
    if (await this.fs.exists(uri)) {
      const raw = await this.fs.readFile(uri);
      const text = Buffer.from(raw).toString('utf-8');
      try {
        existing = JSON.parse(text) as McpJsonFile;
      } catch (e) {
        throw new Error(
          `Cannot register MCP server: ${filePath} exists but is not valid JSON (${e instanceof Error ? e.message : e}).`,
        );
      }
    }

    const servers = { ...(existing.mcpServers ?? {}) };
    const replaced = Object.prototype.hasOwnProperty.call(servers, opts.serverName);
    servers[opts.serverName] = opts.entry;
    const merged: McpJsonFile = { ...existing, mcpServers: servers };

    const serialized = JSON.stringify(merged, null, 2) + '\n';
    await this.fs.writeFile(uri, Buffer.from(serialized, 'utf-8'));

    this.logger.info(
      `Wrote MCP server "${opts.serverName}" to ${filePath} (${replaced ? 'replaced' : 'new'}).`,
    );

    return { filePath, serverName: opts.serverName, replaced };
  }

  /**
   * Derive a `.mcp.json` server name from a URL.
   *
   * - `https://acme.bluestep.net/api/ai/tools` → `bluestep-acme`
   * - `https://acme-staging.bluestep.net/...`  → `bluestep-acme-staging`
   * - anything else                             → `bluestep-<safe-host-slug>`
   */
  static deriveServerName(url: string): string {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    const parts = host.split('.');
    const bsIndex = parts.indexOf('bluestep');
    if (bsIndex > 0 && bsIndex === parts.length - 2) {
      // Everything to the left of "bluestep.<tld>" is the subdomain stack.
      return `bluestep-${parts.slice(0, bsIndex).join('-').toLowerCase()}`;
    }
    const slug = host.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `bluestep-${slug}`;
  }
}
