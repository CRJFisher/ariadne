# Task: Strip MCP to Foundation

**Status**: To Do
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Priority**: Medium

## Overview

Remove all existing tool implementations and legacy adapters from `packages/mcp`, keeping only the MCP server foundation.

This prepares a clean slate for building new call-graph-focused tools.

## What to Delete

```
packages/mcp/src/tools/
├── find_references.ts          ❌ Delete
├── get_file_metadata.ts        ❌ Delete
├── get_source_code.ts          ❌ Delete
└── get_symbol_context.ts       ❌ Delete

packages/mcp/src/types.ts       ❌ Delete (legacy type adapters)
```

## What to Keep/Update

### Keep As-Is

- `packages/mcp/src/version.ts` - Version string
- `packages/mcp/src/server.ts` - Entry point script

### Update

**packages/mcp/src/start_server.ts**:
- Remove all tool imports
- Remove tool registration code
- Update to use new `Project` API directly
- Call `await project.initialize()` with optional root path
- Keep file loading infrastructure (will be used by new tools)
- Return server with no tools registered

**packages/mcp/src/index.ts**:
- Clean exports - remove tool exports
- Keep only `start_server` and types

## Updated start_server.ts Structure

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
import { VERSION } from "./version";

export interface AriadneMCPServerOptions {
  projectPath?: string;
  transport?: "stdio";
}

export async function start_server(
  options: AriadneMCPServerOptions = {}
): Promise<Server> {
  const projectPath = options.projectPath || process.env.PROJECT_PATH || process.cwd();

  // Create MCP server
  const server = new Server(
    { name: "ariadne-mcp", version: VERSION },
    { capabilities: { tools: {} } }
  );

  // Initialize Ariadne project
  const project = new Project();
  await project.initialize(projectPath as FilePath);

  // TODO: Register tools here (in subsequent tasks)

  // Connect transport
  if (options.transport === "stdio" || !options.transport) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  return server;
}
```

## Testing

After cleanup, verify:

1. **Server starts**:
   ```bash
   npm run build
   node packages/mcp/dist/server.js
   ```

2. **No tools registered**:
   - MCP client should show zero tools available
   - Server should not crash

3. **Project initializes**:
   - `project.initialize()` completes without error
   - File tree is built correctly

## Acceptance Criteria

- [ ] All tool files deleted from `packages/mcp/src/tools/`
- [ ] `types.ts` removed (legacy adapters)
- [ ] `start_server.ts` updated to use new `Project` API
- [ ] `start_server.ts` calls `await project.initialize()`
- [ ] `index.ts` exports cleaned (no tool exports)
- [ ] Server starts successfully via `node dist/server.js`
- [ ] No tools registered (MCP client shows 0 tools)
- [ ] No TypeScript errors
- [ ] No runtime errors on startup
- [ ] Project initializes without error

## Related Files

- [start_server.ts](../../../../packages/mcp/src/start_server.ts)
- [index.ts](../../../../packages/mcp/src/index.ts)
- [project.ts](../../../../packages/core/src/project/project.ts)
