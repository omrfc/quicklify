import { findServer } from "../utils/config.js";
import { getProviderToken } from "../core/tokens.js";
import type { ServerRecord } from "../types/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type McpResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// ─── resolveServerForMcp ─────────────────────────────────────────────────────

/**
 * Resolve the target server for an MCP tool call.
 *
 * - If `params.server` is provided, delegates to `findServer` (by name or IP).
 * - If there is exactly one server in the list, returns it automatically.
 * - Otherwise returns undefined (caller should return an error response).
 */
export function resolveServerForMcp(
  params: { server?: string },
  servers: ServerRecord[],
): ServerRecord | undefined {
  if (params.server !== undefined) {
    return findServer(params.server);
  }
  if (servers.length === 1) {
    return servers[0];
  }
  return undefined;
}

// ─── mcpSuccess ──────────────────────────────────────────────────────────────

/**
 * Wrap a success payload in the standard MCP response shape.
 */
export function mcpSuccess(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

// ─── mcpError ────────────────────────────────────────────────────────────────

/**
 * Wrap an error message (and optional metadata) in the standard MCP error response shape.
 */
export function mcpError(
  error: string,
  hint?: string,
  suggestedActions?: Array<{ command: string; reason: string }>,
): McpResponse {
  const payload: Record<string, unknown> = {
    error,
    ...(hint !== undefined ? { hint } : {}),
    ...(suggestedActions !== undefined ? { suggested_actions: suggestedActions } : {}),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError: true,
  };
}

// ─── requireProviderToken ─────────────────────────────────────────────────────

/**
 * Look up the API token for the given provider.
 *
 * Returns `{ token }` on success, or `{ error: McpResponse }` when no token
 * is configured so callers can do a simple discriminated-union check and
 * return the error response immediately.
 */
export function requireProviderToken(
  provider: string,
): { token: string } | { error: McpResponse } {
  const token = getProviderToken(provider);
  if (token) {
    return { token };
  }
  return {
    error: mcpError(
      `No API token found for ${provider}`,
      `Set ${provider.toUpperCase()}_TOKEN environment variable`,
    ),
  };
}
