# Template: MCP Tool — $1

## Files to Create

1. `src/mcp/tools/$1.ts` — Zod schema + handler
2. Update `src/mcp/server.ts` — import + registerTool()
3. `src/__tests__/mcp/$1.test.ts` — test handler function

## Tool File (Zod schema + handler)

```typescript
// src/mcp/tools/$1.ts
import { z } from 'zod';
import type { McpResponse } from '../types.js';

// IMPORTANT: Schema is a flat object, NOT wrapped in z.object()
// The SDK wraps it automatically
export const $1Schema = {
  server: z.string().optional().describe('Server name or IP. Auto-selected if only one server exists.'),
  action: z.enum(['TODO']).describe('TODO: describe actions'),
};

export async function handle$1(params: {
  server?: string;
  action: string;
}): Promise<McpResponse> {
  // Delegate to core function (NOT direct SSH/provider calls)
  // Example: const result = await someCoreFunction(params);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: true }, null, 2),
      },
    ],
  };
}
```

## Server Registration

```typescript
// In src/mcp/server.ts
import { $1Schema, handle$1 } from './tools/$1.js';

server.registerTool('$1', {
  description: 'TODO: 50-150 tokens. What it does. Actions. Constraints. Requirements.',
  inputSchema: $1Schema,
  annotations: {
    title: 'TODO: Human-readable title',
    readOnlyHint: false,    // true if read-only
    destructiveHint: false, // true if destructive
    idempotentHint: false,  // true if idempotent
    openWorldHint: true,
  },
}, async (params) => {
  return handle$1(params);
});
```

## Next Steps

- [ ] Define Zod schema as flat object (NOT z.object() wrapper)
- [ ] Handler delegates to core/ functions (not direct SSH/provider)
- [ ] Add `server` param as `.optional()` with standard description
- [ ] Set annotations correctly (readOnlyHint, destructiveHint)
- [ ] Write description: "What it does. Actions: 'x' does Y. Constraints. For Z, use other_tool instead."
- [ ] Add SAFE_MODE check if destructive: `if (isSafeMode()) throw ...`
- [ ] Write test: call handler directly with mock params
- [ ] Run `npm run build && npm test && npm run lint`
- [ ] Update README.md MCP tools table
