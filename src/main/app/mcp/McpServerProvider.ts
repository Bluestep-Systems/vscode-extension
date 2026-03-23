import * as vscode from 'vscode';
import type { ORG_CACHE } from '../cache/OrgCache';
import { BASIC_AUTH_MANAGER } from '../authentication/BasicAuthManager';
import { Http } from '../../resources/constants';
import { ContextNode } from '../context/ContextNode';
import { Err } from '../util/Err';
import { App } from '../App';

/**
 * Provides MCP server definitions to VS Code for each known org in the OrgCache.
 *
 * Each cached org origin gets a {@link vscode.McpHttpServerDefinition} pointing
 * at the org's `/sse` endpoint. Authentication headers are injected lazily in
 * {@link resolveMcpServerDefinition} using the extension's existing credentials.
 */
export const MCP_SERVER_PROVIDER = new class extends ContextNode {

  private _parent: typeof ORG_CACHE | null = null;
  private _emitter: vscode.EventEmitter<void> | null = null;

  public get parent() {
    if (!this._parent) {
      throw new Err.ManagerNotInitializedError('McpServerProvider');
    }
    return this._parent;
  }

  public get context() {
    return this.parent.context;
  }

  protected map() {
    return this.parent.map();
  }

  /**
   * Registers the MCP server definition provider with VS Code.
   * Call once during OrgCache initialization.
   */
  init(parent: typeof ORG_CACHE): this {
    if (this._parent) {
      throw new Err.DuplicateInitializationError('McpServerProvider');
    }
    this._parent = parent;
    this._emitter = new vscode.EventEmitter<void>();

    App.logger.info('MCP: Registering MCP server definition provider...');
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

    this.context.subscriptions.push(registration, this._emitter);
    App.logger.info('MCP: Provider registered successfully');
    return this;
  }

  /**
   * Signals VS Code that the set of available MCP servers has changed.
   * Call this when the OrgCache is updated (new org connected, cache cleared, etc.).
   */
  fireChanged(): void {
    this._emitter?.fire();
  }

  /**
   * Builds one {@link vscode.McpHttpServerDefinition} per unique origin in the OrgCache.
   */
  private getDefinitions(): vscode.McpHttpServerDefinition[] {
    App.logger.info('MCP: provideMcpServerDefinitions called');
    const definitions: vscode.McpHttpServerDefinition[] = [];
    const seenHosts = new Set<string>();

    try {
      for (const [u, elements] of this.parent.map()) {
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
      App.logger.info('MCP: OrgCache not ready, returning empty server list');
    }

    App.logger.info(`MCP: Returning ${definitions.length} server definition(s)`);
    return definitions;
  }

  /**
   * Injects the Authorization header from {@link BASIC_AUTH_MANAGER} into the
   * server definition just before VS Code opens the SSE connection.
   */
  private async resolve(
    server: vscode.McpHttpServerDefinition,
  ): Promise<vscode.McpHttpServerDefinition | undefined> {
    try {
      if (!BASIC_AUTH_MANAGER.hasAuth()) {
        App.logger.info('MCP: No credentials available, skipping server resolve');
        return undefined;
      }
      const authValue = await BASIC_AUTH_MANAGER.authHeaderValue();
      server.headers = {
        ...server.headers,
        [Http.Headers.AUTHORIZATION]: authValue,
      };
      return server;
    } catch (e) {
      App.logger.error('MCP: Failed to resolve server credentials', e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }
}();
