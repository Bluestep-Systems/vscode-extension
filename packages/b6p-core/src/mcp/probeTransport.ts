import type { ILogger } from '../providers';
import type { McpTransportType } from './McpRegistrar';

/**
 * Minimum MCP initialize request payload, used as a no-op probe to see
 * whether the endpoint speaks streamable HTTP. The server should answer
 * with a JSON-RPC `result` containing its capabilities; we don't actually
 * read the body — a 2xx is enough.
 */
const PROBE_INITIALIZE_REQUEST = {
  jsonrpc: '2.0' as const,
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'b6p-register-probe', version: '1' },
  },
};

const PROBE_TIMEOUT_MS = 5_000;

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Probe the URL to find out which MCP transport the server supports.
 *
 * Streamable-HTTP MCP servers accept a POST with a JSON-RPC body and respond
 * with either `application/json` or a `text/event-stream`. SSE-only servers
 * return 405 (method not allowed) or similar for the POST since their
 * client→server channel is on a separate path.
 *
 * Returns `'http'` on a 2xx response, `'sse'` on any non-2xx, network error,
 * or timeout. Errors are swallowed and logged at debug level — the probe is
 * advisory only, and the SSE fallback always works against current BlueStep
 * servers.
 */
export async function probeMcpTransport(
  fetchFn: FetchFn,
  url: string,
  authHeader: string,
  logger: ILogger,
): Promise<McpTransportType> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': authHeader,
      },
      body: JSON.stringify(PROBE_INITIALIZE_REQUEST),
      signal: controller.signal,
    });
    if (res.ok) {
      logger.debug(`MCP probe: ${url} responded ${res.status} to POST initialize — using http transport.`);
      return 'http';
    }
    logger.debug(`MCP probe: ${url} responded ${res.status} to POST initialize — falling back to sse transport.`);
    return 'sse';
  } catch (e) {
    logger.debug(
      `MCP probe: ${url} POST failed (${e instanceof Error ? e.message : e}) — falling back to sse transport.`,
    );
    return 'sse';
  } finally {
    clearTimeout(timer);
  }
}
