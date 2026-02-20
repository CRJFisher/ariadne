---
name: mcp-headless-test
description: Run live tests of the Ariadne MCP server using Claude Code in headless mode. Tests tool discovery, invocation, and filtering. Use when validating MCP server changes or checking integration with Claude Code.
allowed-tools: Bash(./packages/mcp/tests/claude-headless-test.sh:*, npm run build:*), Read
---

# MCP Headless Test Pipeline

## Purpose

Validate the Ariadne MCP server by running it with Claude Code in headless mode (`claude -p`). This tests the real user experience rather than just programmatic MCP client behavior.

## Prerequisites

Before running tests, ensure:

1. **Claude Code CLI** is installed and configured
2. **API key** is set (either `ANTHROPIC_API_KEY` env var or Claude's configured key)
3. **MCP package is built**:

```bash
npm run build -w packages/mcp
```

## Running the Tests

### Quick Run

```bash
cd packages/mcp
./tests/claude-headless-test.sh
```

### Verbose Mode (for debugging)

```bash
./tests/claude-headless-test.sh --verbose
```

## Test Scenarios

The script runs 7 tests:

| Test | Name                  | What It Validates                                     |
| ---- | --------------------- | ----------------------------------------------------- |
| 1    | Tool Discovery        | Claude can see the `list_entrypoints` tool            |
| 2    | Tool Invocation       | Tool runs successfully on fixture code                |
| 3    | Filtered Analysis     | File/folder filtering parameters work                 |
| 4    | Neighborhood Discovery| Claude can see the `show_call_graph_neighborhood` tool|
| 5    | Neighborhood Invocation| Tool runs successfully on fixture code               |
| 6    | Neighborhood Depth    | Depth parameters work correctly                       |
| 7    | Analytics Client Info | Analytics captures client_name and client_version     |

## Interpreting Results

### Success Output

```text
========================================
 Ariadne MCP - Claude Headless Tests
========================================

[INFO] Checking prerequisites...
[INFO] All prerequisites met.

[INFO] Test 1: Tool Discovery
[INFO] Checking if Claude can see the list_entrypoints tool...
[INFO] PASS: Tool 'list_entrypoints' discovered

[INFO] Test 2: Tool Invocation
[INFO] Running list_entrypoints on fixture code...
[INFO]   - Found 'entry point' in output
[INFO] PASS: Tool invocation succeeded

[INFO] Test 3: Filtered Analysis
[INFO] Testing file/folder filtering parameters...
[INFO] PASS: Filtered analysis completed

========================================
 Test Summary
========================================
Total:  3
Passed: 3
Failed: 0

[INFO] All tests passed!
```

### Failure Indicators

| Indicator                              | Meaning                                      | Action                                                |
| -------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `Claude Code CLI not found`            | `claude` command not in PATH                 | Install Claude Code CLI                               |
| `MCP server not built`                 | Missing `dist/server.js`                     | Run `npm run build -w packages/mcp`                   |
| `Tool 'list_entrypoints' not found`    | Claude didn't discover the MCP tool          | Check MCP config, server logs                         |
| `Tool invocation did not produce...`   | Tool ran but output unexpected               | Check if fixtures exist, review Claude's response     |
| `FAIL: Filtered analysis...`           | Folder filtering parameter not working       | Check tool schema, parameter handling                 |

## Verifying Correctness

### Test 1: Tool Discovery

**Expected behavior**: Claude should list `list_entrypoints` when asked about available tools.

**Manual verification**:

```bash
claude -p "What MCP tools do you have?" \
  --mcp-config ./packages/mcp/tests/mcp-test-config.json \
  --output-format json
```

Look for output containing:

- Tool name: `list_entrypoints`
- Description mentioning "entry point" and "call tree"

### Test 2: Tool Invocation

**Expected behavior**: Claude should successfully invoke the tool and return analysis results.

**Manual verification**:

```bash
claude -p "Use list_entrypoints to analyze the codebase" \
  --mcp-config ./packages/mcp/tests/mcp-test-config.json
```

Valid output should contain:

- "Entry Points" header
- Function signatures (e.g., `function_name(...): return_type`)
- Tree size indicators (e.g., `-- N functions`)
- File locations (e.g., `Location: ...`)
- Total count (e.g., `Total: X entry points`)

### Test 3: Filtered Analysis

**Expected behavior**: Tool accepts `folders` parameter and analyzes only specified directories.

**Manual verification**:

```bash
claude -p "Use list_entrypoints with folders=['functions']" \
  --mcp-config ./packages/mcp/tests/mcp-test-config.json
```

Valid output: Should show entry points only from the `functions/` subdirectory of the fixtures.

## Test Configuration

The tests use `packages/mcp/tests/mcp-test-config.json`:

```json
{
  "mcpServers": {
    "ariadne": {
      "type": "stdio",
      "command": "node",
      "args": ["./packages/mcp/dist/server.js"],
      "env": {
        "PROJECT_PATH": "./packages/core/tests/fixtures/typescript/code"
      }
    }
  }
}
```

This points to TypeScript fixtures in `packages/core/tests/fixtures/typescript/code/` for deterministic, reproducible tests.

## Server Lifecycle Notes

**Important**: The MCP server process stays alive across tool calls within a session, BUT each tool call creates a fresh `Project` instance and re-indexes the codebase. This is intentional to support scoped analysis (file/folder filtering).

**Performance implication**: Large codebases may take 2+ seconds per tool call due to re-indexing.

## Troubleshooting

### Claude hangs or times out

- Check `ANTHROPIC_API_KEY` is valid
- Try with `--verbose` flag to see debug output
- Ensure network connectivity to Anthropic API

### Tool not discovered

1. Verify MCP config path is correct
2. Check server.js exists: `ls packages/mcp/dist/server.js`
3. Test server directly:

   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
     PROJECT_PATH=. node packages/mcp/dist/server.js
   ```

### Unexpected tool output

1. Check fixtures exist: `ls packages/core/tests/fixtures/typescript/code/`
2. Test with E2E tests first: `npm test -w packages/mcp`
3. Review server stderr for errors (use `--verbose`)

## Related Files

| File                                      | Purpose                          |
| ----------------------------------------- | -------------------------------- |
| `packages/mcp/tests/claude-headless-test.sh` | Test runner script              |
| `packages/mcp/tests/mcp-test-config.json`    | MCP server configuration        |
| `packages/mcp/src/start_server.ts`           | Server implementation           |
| `packages/mcp/src/list_entrypoints.e2e.test.ts` | Programmatic E2E tests       |
