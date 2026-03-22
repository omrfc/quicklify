import type { McpResponse } from "../../src/mcp/utils.js";

/**
 * createMcpParams — creates a typed MCP handler params object.
 * Replaces `{ params: { arguments: { ... } } } as any` in test files.
 *
 * MCP handlers receive params directly (not wrapped); this helper provides
 * a flat Record matching the handler's expected input shape.
 */
export function createMcpParams(args: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...args };
}

/**
 * createMcpTextResponse — builds a success McpResponse with a single text content item.
 * Replaces `{ content: [{ type: "text", text: "..." }] } as any` in test files.
 */
export function createMcpTextResponse(text: string): McpResponse {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * createMcpErrorResponse — builds an error McpResponse.
 * Replaces manually constructed `{ content: [...], isError: true }` in test files.
 */
export function createMcpErrorResponse(error: string, hint?: string): McpResponse {
  const payload: Record<string, unknown> = { error };
  if (hint !== undefined) payload.hint = hint;
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError: true,
  };
}

/**
 * createMcpJsonResponse — builds a success McpResponse from a data object.
 * Serialises the data to JSON text matching mcpSuccess() output shape.
 */
export function createMcpJsonResponse(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}
