---
id: task-48.3
title: Implement minimal MCP server with basic endpoints
status: Done
assignee:
  - '@claude'
created_date: '2025-07-28'
updated_date: '2025-07-28'
labels: []
dependencies: []
parent_task_id: task-48
---

## Description

Implement a minimal MCP server that exposes basic Ariadne functionality through go_to_definition and find_references endpoints. This will serve as the foundation for expanding the MCP server capabilities.

## Acceptance Criteria

- [ ] MCP server implemented using TypeScript SDK
- [ ] go_to_definition tool exposed via MCP
- [ ] find_references tool exposed via MCP
- [ ] Basic tests for both endpoints
- [ ] Server can be started and connects to MCP clients
- [ ] Documentation for running the server

## Implementation Plan

1. Install MCP TypeScript SDK
2. Create server.ts with basic MCP server setup
3. Implement go_to_definition tool endpoint
4. Implement find_references tool endpoint  
5. Create programmatic API for starting server
6. Write tests for both endpoints
7. Update documentation

## Implementation Notes

Implemented a minimal MCP server exposing go_to_definition and find_references endpoints. Used the official @modelcontextprotocol/sdk with stdio transport. Created both a CLI executable (server.ts) and programmatic API (start_server.ts). Added comprehensive tests using vitest and documented usage in README. The server dynamically loads files as needed and provides JSON responses with location information.
