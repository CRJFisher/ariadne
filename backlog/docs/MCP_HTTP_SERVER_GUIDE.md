# MCP HTTP Server Implementation Guide

Quick reference for implementing MCP servers using `@modelcontextprotocol/sdk`.

## Key Components

### 1. Server (Protocol Handler)
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'my-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},  // Enable tool support
  }
});
```

**Purpose**: Handles MCP protocol, initialization, tool registration

### 2. Transport (Connection Layer)

#### StreamableHTTPServerTransport (Modern)
```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),  // or undefined for stateless
  onsessioninitialized: async (sessionId) => {
    // Track session
  },
  onsessionclosed: async (sessionId) => {
    // Cleanup
  }
});

// Single endpoint handles all methods
app.all('/mcp', async (req, res) => {
  await transport.handleRequest(req, res);
});
```

**Key Points**:
- Handles GET (SSE stream), POST (requests), DELETE (terminate)
- Built-in session management
- Standard `/mcp` endpoint

#### SSEServerTransport (Legacy)
```typescript
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Separate endpoints required
app.get('/sse', (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  // Manual message handling
});
```

**Key Points**:
- Requires manual session tracking
- Separate SSE and message endpoints
- More control, more complexity

### 3. Tool Registration
```typescript
server.setRequestHandler(
  'tools/list',
  async () => ({
    tools: [
      {
        name: 'add_node',
        description: 'Add a workflow node',
        inputSchema: {
          type: 'object',
          properties: {
            node_type: { type: 'string', enum: ['task', 'container'] },
            prompt: { type: 'string' },
          },
          required: ['node_type', 'prompt'],
        },
      },
    ],
  })
);

server.setRequestHandler(
  'tools/call',
  async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'add_node') {
      const result = await add_node(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  }
);
```

## Complete Minimal Example

```typescript
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

const server = new Server({
  name: 'my-server',
  version: '1.0.0',
}, { capabilities: { tools: {} } });

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [{ name: 'ping', description: 'Test tool', inputSchema: { type: 'object' } }]
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'ping') {
    return { content: [{ type: 'text', text: 'pong' }] };
  }
});

// Session storage
const transports = new Map();

// MCP endpoint
app.all('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || randomUUID();

  if (!transports.has(sessionId)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });
    await server.connect(transport);
    transports.set(sessionId, transport);
  }

  await transports.get(sessionId).handleRequest(req, res);
});

app.listen(3000, () => console.log('MCP server on :3000'));
```

## Client Configuration

Claude Code `.mcp.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "http://localhost:3000"
    }
  }
}
```

## Session Management Patterns

### Stateful (Server manages sessions)
```typescript
sessionIdGenerator: () => randomUUID()
```
- Server creates and tracks session IDs
- Session ID in response headers: `Mcp-Session-Id`
- Best for multi-client scenarios

### Stateless (No sessions)
```typescript
sessionIdGenerator: undefined
```
- No session tracking
- Every request independent
- Simpler but less efficient

## Migration: SSE → StreamableHTTP

**Before** (manual session tracking):
```typescript
const transports = new Map();

app.get('/sse', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || randomUUID();
  const transport = new SSEServerTransport('/messages', res);
  transports.set(sessionId, transport);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = transports.get(sessionId);
  // Manual message handling
});
```

**After** (SDK handles everything):
```typescript
const transports = new Map();

app.all('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || randomUUID();

  if (!transports.has(sessionId)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });
    await server.connect(transport);
    transports.set(sessionId, transport);
  }

  await transports.get(sessionId).handleRequest(req, res);
});
```

## Key Differences: SSE vs StreamableHTTP

| Aspect | SSEServerTransport | StreamableHTTPServerTransport |
|--------|-------------------|-------------------------------|
| Endpoints | `/sse` + `/messages` | Single `/mcp` |
| Session tracking | Manual | Built-in |
| Request routing | Manual | `handleRequest()` |
| DELETE support | Manual | Built-in |
| Status | Legacy | Modern standard |

## Common Pitfalls

1. **Wrong endpoint**: Claude Code expects `/mcp`, not custom paths
2. **Missing session header**: `Mcp-Session-Id` required for POST/DELETE
3. **Connecting transport twice**: Only call `server.connect()` once per transport
4. **Not parsing body**: StreamableHTTP needs `express.json()` middleware
5. **Port conflicts**: MCP servers need unique ports or use process isolation
