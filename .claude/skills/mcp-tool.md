# Skill: MCP Tool Ekleme/Duzenleme

## Mevcut 7 Tool
`server_info`, `server_logs`, `server_manage`, `server_maintain`, `server_secure`, `server_backup`, `server_provision`

## Yeni Tool Pattern

```typescript
// src/mcp/tools/yeni-tool.ts
import { Tool } from '@modelcontextprotocol/sdk';

export const yeniTool: Tool = {
  name: 'server_yeni',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {
      serverId: { type: 'string', description: '...' },
    },
    required: ['serverId'],
  },
  async execute(input) {
    // logic
  },
};
```

## Checklist
- [ ] `src/mcp/tools/` altina yeni tool dosyasi
- [ ] `src/mcp/index.ts`'e register et
- [ ] Input validation — Zod schema kullan
- [ ] Destructive operasyon mu? SAFE_MODE kontrolu ekle
- [ ] `__tests__/mcp/` altina test yaz
- [ ] README MCP Tools bolumunu guncelle
