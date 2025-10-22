# MCP HTTP Server Implementation Guide

Quick reference for implementing MCP servers using `@modelcontextprotocol/sdk`.

## Transport Overview

**Two different transports exist:**
- **StreamableHTTPServerTransport** - Modern standard (use this!)
- **SSEServerTransport** - Deprecated legacy transport

**CRITICAL:** These are DIFFERENT protocols! `"type": "http"` in `.mcp.json` means StreamableHTTP, NOT SSE.

## Key Components

### 1. Server (Protocol Handler)
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
});
```

**Purpose**: Handles MCP protocol, initialization, tool registration

### 2. StreamableHTTPServerTransport (Modern - USE THIS)

Single `/mcp` endpoint handles GET, POST, DELETE.

#### Stateless Mode (Simple)
```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
app.use(express.json());

const server = new McpServer({ name: 'my-server', version: '1.0.0' });

// Register tools here
server.setRequestHandler('tools/list', async () => ({ tools: [] }));

app.post('/mcp', async (req, res) => {
  // Create NEW transport for EACH request (prevents request ID collisions)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // Stateless
    enableJsonResponse: true
  });

  res.on('close', () => transport.close());

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000);
```

**Use when:** Server has no per-session state, simple request/response

#### Stateful Mode (Session Management)
```typescript
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';

const transports = new Map();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport = transports.get(sessionId || '');

  if (sessionId && transport) {
    // Reuse existing transport
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session - create transport
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
      onsessionclosed: (id) => {
        transports.delete(id);
      }
    });
    await server.connect(transport);
  } else {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

// Also handle GET (SSE notifications) and DELETE (session termination)
app.get('/mcp', async (req, res) => {
  const transport = transports.get(req.headers['mcp-session-id']);
  if (transport) await transport.handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
  const transport = transports.get(req.headers['mcp-session-id']);
  if (transport) await transport.handleRequest(req, res);
});
```

**Use when:** Server maintains per-session state (e.g., user context, ongoing operations)

### 3. Tool Registration
```typescript
server.setRequestHandler('tools/list', async () => ({
  tools: [{
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
  }],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'add_node') {
    const result = await add_node(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
});
```

## Client Configuration

Claude Code `.mcp.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Note**: `"type": "http"` means StreamableHTTP transport, not SSE!

## SSEServerTransport (Legacy - Deprecated)

**DO NOT USE FOR NEW CODE.** Only needed for backwards compatibility.

Separate `/sse` and `/messages` endpoints. See SDK README section "Backwards Compatibility" if you must support old clients.

## Critical Rules

### 1. Let SDK Handle All HTTP Responses
```typescript
// ❌ WRONG - Never touch response manually
res.writeHead(200, { 'Content-Type': 'text/event-stream' });
res.status(202).end();

// ✅ CORRECT - Let transport handle it
await transport.handleRequest(req, res, req.body);
```

### 2. server.connect() Calls start() Automatically
```typescript
// ❌ WRONG - Don't call start() after connect()
await server.connect(transport);
await transport.start();  // ERROR!

// ✅ CORRECT - connect() calls start() internally
await server.connect(transport);
```

### 3. Use isInitializeRequest() for Session Creation
```typescript
// ✅ CORRECT - Only create new transport for initialize requests
if (!sessionId && isInitializeRequest(req.body)) {
  transport = new StreamableHTTPServerTransport({...});
  await server.connect(transport);
}
```

## Common Pitfalls

1. **Confusing SSE and StreamableHTTP**: These are different protocols!
   - SSE = separate `/sse` + `/messages` endpoints (deprecated)
   - StreamableHTTP = single `/mcp` endpoint (modern)
   - `.mcp.json` with `"type": "http"` expects StreamableHTTP

2. **Manual response handling**: Never use `res.writeHead()`, `res.status()`, `res.send()` - always delegate to `transport.handleRequest()`

3. **Calling start() explicitly**: `server.connect()` calls it automatically

4. **Wrong endpoint**: Must be `/mcp` for StreamableHTTP, not `/sse` or custom paths

5. **Not parsing body**: Need `app.use(express.json())` middleware

6. **Creating transport without checking initialize**: Only create new transport when `isInitializeRequest(req.body)` is true

7. **Sharing transports across requests in stateless mode**: Create NEW transport per request to prevent request ID collisions

## SDK Responsibility Principle

**Your code does:**
- Create transports
- Call `server.connect(transport)`
- Call `transport.handleRequest(req, res, req.body)`

**SDK does (automatically):**
- Start transport (`transport.start()` called by `connect()`)
- Write HTTP headers and status codes
- Handle JSON-RPC protocol
- Manage SSE streams
- Parse and route messages

**Never touch the response object directly!**

## References

- [MCP TypeScript SDK README](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [StreamableHTTP Transport Docs](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)
