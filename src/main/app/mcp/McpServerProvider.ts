import * as vscode from 'vscode';
import { BasicAuthProvider } from '@bluestep-systems/b6p-core';
import { Http } from '@bluestep-systems/b6p-core';
import type { ILogger } from '@bluestep-systems/b6p-core';
import type { OrgCache } from '@bluestep-systems/b6p-core';

/**
 * Provides MCP server definitions to VS Code for each known org in the OrgCache.
 *
 * Each cached org origin gets a {@link vscode.McpHttpServerDefinition} pointing
 * at the org's `/sse` endpoint. Authentication headers are injected lazily in
 * {@link resolveMcpServerDefinition} using the extension's existing credentials.
 * @lastreviewed null
 */
export class McpServerProvider {

  private _emitter: vscode.EventEmitter<void>;

  /**
   * Creates a new McpServerProvider and registers it with VS Code.
   *
   * @param orgCache The OrgCache to read server definitions from
   * @param authManager The BasicAuthManager for credential injection
   * @param logger The logger for diagnostic output
   * @param context The VS Code extension context for subscription management
   * @lastreviewed null
   */
  constructor(
    private readonly orgCache: OrgCache,
    private readonly authManager: BasicAuthProvider,
    private readonly logger: ILogger,
    context: vscode.ExtensionContext
  ) {
    this._emitter = new vscode.EventEmitter<void>();

    logger.info('MCP: Registering MCP server definition provider...');
    const registration = vscode.lm.registerMcpServerDefinitionProvider(
      'bluestep-mcp',
      {
        onDidChangeMcpServerDefinitions: this._emitter.event,

        provideMcpServerDefinitions: (_token) => {
          return this.getDefinitions();
        },

        resolveMcpServerDefinition: async (server, _token) => {
          if (server instanceof vscode.McpHttpServerDefinition) {
            return await this.resolve(server);
          }
          return server;
        },
      },
    );

    context.subscriptions.push(registration, this._emitter);
    logger.info('MCP: Provider registered successfully');
  }

  /**
   * Signals VS Code that the set of available MCP servers has changed.
   */
  fireChanged(): void {
    this._emitter?.fire();
  }

  /**
   * Builds one {@link vscode.McpHttpServerDefinition} per unique origin in the OrgCache.
   */
  private getDefinitions(): vscode.McpHttpServerDefinition[] {
    this.logger.info('MCP: provideMcpServerDefinitions called');
    const definitions: vscode.McpHttpServerDefinition[] = [];
    const seenHosts = new Set<string>();

    try {
      for (const [u, elements] of this.orgCache.map()) {
        for (const element of elements) {
          if (seenHosts.has(element.host)) {
            continue;
          }
          seenHosts.add(element.host);

          const origin = `${Http.Schemes.HTTPS}${element.host}`;
          definitions.push(
            new vscode.McpHttpServerDefinition(
              `BlueStep (${u} - ${element.host})`,
              vscode.Uri.parse(`${origin}/sse`),
              {},
            ),
          );
        }
      }
    } catch {
      // OrgCache not initialized yet — return empty list
      this.logger.info('MCP: OrgCache not ready, returning empty server list');
    }

    this.logger.info(`MCP: Returning ${definitions.length} server definition(s)`);
    return definitions;
  }

  /**
   * Injects the Authorization header from the auth manager into the
   * server definition just before VS Code opens the SSE connection.
   */
  private async resolve(
    server: vscode.McpHttpServerDefinition,
  ): Promise<vscode.McpHttpServerDefinition | undefined> {
    try {
      if (!(await this.authManager.hasCredentials())) {
        this.logger.info('MCP: No credentials available, skipping server resolve');
        return undefined;
      }
      const authValue = await this.authManager.authHeaderValue();
      server.headers = {
        ...server.headers,
        [Http.Headers.AUTHORIZATION]: authValue,
      };
      return server;
    } catch (e) {
      this.logger.error('MCP: Failed to resolve server credentials', e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }

  dispose(): void {
    this._emitter.dispose();
  }
}
