import * as path from 'path';
import { B6PUri } from '../B6PUri';
import type { IFileSystem, ILogger } from '../providers';

/**
 * Transport types we know how to write into `.mcp.json`. BlueStep currently
 * serves `sse` and is migrating to streamable `http`; stdio entries are out
 * of scope.
 */
export type McpTransportType = 'sse' | 'http';

/**
 * Shape of a single entry under `mcpServers` in a Claude Code `.mcp.json`.
 *
 * Models the HTTP-style transports (`http` / `sse`). Stdio entries
 * (`command` + `args`) are out of scope for this registrar. Extra fields on
 * the existing file are preserved verbatim on merge.
 */
export interface McpServerEntry {
  type: McpTransportType;
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
const GITIGNORE_FILENAME = '.gitignore';
/**
 * Names allowed as keys under `mcpServers`. Matches the pattern Claude Code
 * (and the Copilot MCP SDK) accept for server identifiers.
 */
const SERVER_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
/** Max walk depth when searching for a `.gitignore` above the workspace dir. */
const GITIGNORE_SEARCH_DEPTH = 20;

/**
 * Registers a BlueStep-hosted MCP server in a workspace-local `.mcp.json`.
 *
 * BlueStep serves the MCP protocol itself; `b6p` does **not** proxy tool calls.
 * This class just writes the JSON pointer Claude Code reads at session start.
 */
export class McpRegistrar {
  /**
   * Path under the origin where BlueStep hosts its MCP endpoint. Same URL
   * is used for both `sse` and `http` transports — the server may speak
   * either depending on its migration state, and the transport is selected
   * separately via a probe.
   */
  static readonly MCP_PATH = '/sse';

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
    McpRegistrar.validateServerName(opts.serverName);

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
    const replaced = opts.serverName in servers;
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
   * Walk up from `workspaceDir` looking for a `.gitignore` that covers
   * `.mcp.json`. Returns `true` if any reachable `.gitignore` lists a pattern
   * that matches the file by name.
   *
   * Conservative matcher: only recognises the conventional forms
   * (`.mcp.json`, `/.mcp.json`, `**​/.mcp.json`). Fancier globs (`*.json`,
   * negations, etc.) won't be detected — callers can pass `force: true` to
   * override.
   */
  async isMcpJsonGitignored(workspaceDir: string): Promise<boolean> {
    let currentDir = path.resolve(workspaceDir);
    for (let depth = 0; depth < GITIGNORE_SEARCH_DEPTH; depth++) {
      const candidate = B6PUri.fromFsPath(path.join(currentDir, GITIGNORE_FILENAME));
      if (await this.fs.exists(candidate)) {
        try {
          const raw = await this.fs.readFile(candidate);
          const text = Buffer.from(raw).toString('utf-8');
          if (McpRegistrar.gitignoreMatchesMcpJson(text)) {
            return true;
          }
        } catch (e) {
          this.logger.warn(
            `Could not read ${candidate.fsPath} while checking for .mcp.json exclusion: ` +
            `${e instanceof Error ? e.message : e}`,
          );
        }
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) {break;}
      currentDir = parent;
    }
    return false;
  }

  /**
   * Returns true if any non-comment line in a `.gitignore` body matches
   * `.mcp.json` by name. Recognised forms: `.mcp.json`, `/.mcp.json`,
   * `**​/.mcp.json` (with optional trailing whitespace).
   */
  static gitignoreMatchesMcpJson(gitignoreBody: string): boolean {
    for (const rawLine of gitignoreBody.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {continue;}
      const stripped = line.replace(/^\/+/, '').replace(/^\*\*\/+/, '');
      if (stripped === MCP_JSON_FILENAME) {return true;}
    }
    return false;
  }

  /**
   * Throws if `name` is not a legal `.mcp.json` server key. Returns the
   * input unchanged on success so this can be used inline.
   */
  static validateServerName(name: string): string {
    if (!SERVER_NAME_PATTERN.test(name)) {
      throw new Error(
        `Invalid MCP server name "${name}": must match ${SERVER_NAME_PATTERN.source} ` +
        `(letters, digits, underscore, hyphen).`,
      );
    }
    return name;
  }

  /**
   * Derive a `.mcp.json` server name from a URL.
   *
   * Strategy: locate the `bluestep` label in the hostname (handles
   * single-tld `.bluestep.net` and multi-tld `.bluestep.com.au` alike) and
   * use everything to its left as the subdomain slug. Falls back to a
   * sanitized full-host slug.
   *
   * - `https://acme.bluestep.net/api/ai/tools` → `bluestep-acme`
   * - `https://acme-staging.bluestep.net/...`  → `bluestep-acme-staging`
   * - `https://foo.bluestep.com.au/...`         → `bluestep-foo`
   * - `https://bluestep.net/...`                → `bluestep`
   * - anything else                             → `bluestep-<safe-host-slug>`
   */
  static deriveServerName(url: string): string {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    const parts = host.split('.');
    const bsIndex = parts.indexOf('bluestep');
    if (bsIndex === 0) {
      return 'bluestep';
    }
    if (bsIndex > 0) {
      const subdomain = parts.slice(0, bsIndex).join('-');
      const candidate = `bluestep-${subdomain}`;
      if (SERVER_NAME_PATTERN.test(candidate)) {
        return candidate;
      }
    }
    const slug = host.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `bluestep-${slug}`;
  }
}
