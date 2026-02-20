# Task: Strip MCP to Foundation

**Status**: Completed
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Completed**: 2025-10-22
**Priority**: Medium
**Commit**: ca8e73e

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

- [x] All tool files deleted from `packages/mcp/src/tools/`
- [x] `types.ts` removed (legacy adapters)
- [x] `start_server.ts` updated to use new `Project` API
- [x] `start_server.ts` calls `await project.initialize()`
- [x] `index.ts` exports cleaned (no tool exports)
- [x] Server starts successfully via `node dist/server.js`
- [x] No tools registered (MCP client shows 0 tools)
- [x] No TypeScript errors
- [x] No runtime errors on startup
- [x] Project initializes without error

## Implementation Summary

### Changes Made

**Deletions (1891 lines)**:
- Removed all 4 legacy tool files from `packages/mcp/src/tools/`
- Removed `packages/mcp/src/types.ts` (legacy type adapters)
- Removed all tool registration and handler code from `start_server.ts`

**Updates (109 lines)**:
- `start_server.ts`:
  - Imports `Project` directly from `@ariadnejs/core` instead of stub
  - Calls `await project.initialize(projectPath as FilePath)`
  - Kept file loading infrastructure (`load_project_files`, `load_file_if_needed`) - exported for reuse
  - TODO comment marks where tools will be registered in subsequent tasks

- `index.ts`:
  - Exports only: `start_server`, `load_project_files`, `load_file_if_needed`
  - Exports only: `AriadneMCPServerOptions` type
  - Removed all legacy tool exports

### Verification

✅ TypeScript compiles without errors
✅ Server starts successfully
✅ No tools registered (ready for new implementation)
✅ Project initialization works correctly

### Result

**Net: -1782 lines (-94%)**

MCP package successfully stripped to foundation. Ready for call graph analysis tools.

## Related Files

- [start_server.ts](../../../../packages/mcp/src/start_server.ts)
- [index.ts](../../../../packages/mcp/src/index.ts)
- [project.ts](../../../../packages/core/src/project/project.ts)

## Next Steps

Proceed to [task-epic-11.147.2](task-epic-11.147.2-Implement-list_functions-Tool.md) to implement the first call graph analysis tool.
