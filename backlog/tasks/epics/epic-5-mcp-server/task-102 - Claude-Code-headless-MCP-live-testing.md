---
id: task-102
title: Add Claude Code headless mode live tests for MCP server
status: To Do
assignee: []
created_date: '2026-01-25'
updated_date: '2026-01-25'
labels:
  - testing
  - mcp
  - automation
  - integration
dependencies: []
---

## Description

Create automated tests that run the Ariadne MCP server using Claude Code in headless mode (`claude -p`). This validates the real user experience rather than just programmatic MCP client behavior.

Unlike the existing E2E tests in `list_entrypoints.e2e.test.ts` which use the MCP SDK directly, these tests use Claude Code as the actual client - matching how users interact with the MCP server.

## Background

### Server Lifecycle

The MCP server process stays alive across tool calls within a session, but each tool call creates a fresh `Project` instance and re-indexes the codebase. This is intentional to support scoped analysis (file/folder filtering).

### Claude Code Headless Mode

Claude Code supports MCP servers in headless mode via `--mcp-config`:

```bash
claude -p "prompt" --mcp-config ./mcp-config.json --strict-mcp-config
```

## Test Scenarios

1. **Basic tool discovery** - Verify Claude sees the `list_entrypoints` tool
2. **Tool invocation on fixtures** - Run analysis on fixture code files
3. **Filtered analysis** - Test file/folder filtering parameters
4. **Multi-call session** - Verify server persists across calls in `--continue` mode

## Test Infrastructure

### MCP Config File

Location: `packages/mcp/tests/mcp-test-config.json`

Points to existing TypeScript fixtures for deterministic testing.

### Test Runner Script

Location: `packages/mcp/tests/claude-headless-test.sh`

Runs test scenarios and validates output.

## Acceptance Criteria

- [ ] MCP config file created pointing to test fixtures
- [ ] Shell script created to run headless tests
- [ ] Tests verify tool discovery works
- [ ] Tests verify analysis produces expected output format
- [ ] Server lifecycle behavior documented
- [ ] Usage examples added to MCP package README

## Implementation Notes

### Prerequisites

- Claude Code CLI installed and configured
- Valid API key (ANTHROPIC_API_KEY)
- MCP package built (`npm run build` in packages/mcp)

### Running Tests

```bash
cd packages/mcp
./tests/claude-headless-test.sh
```

## Related Tasks

- task-101: Manual validation of MCP integration with Claude Code
- Follow-up: CI integration (separate task - requires API key management)
