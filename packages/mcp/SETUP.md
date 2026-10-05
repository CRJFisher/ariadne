# Ariadne MCP Server Setup Guide

This guide explains how to set up the Ariadne MCP server with various AI development tools. The Model Context Protocol (MCP) enables AI assistants to interact with Ariadne's code intelligence features.

## Prerequisites

Before setting up the Ariadne MCP server, ensure you have:

- **Node.js** version 20.0.0 or newer
- **npm** or **npx** available in your system PATH
- The AI development tool of your choice (Claude Desktop, VS Code, Cursor, etc.)

## Installation

Install the Ariadne MCP server globally:

```bash
npm install -g @ariadnejs/mcp
```

Or use it directly with npx (no installation required):

```bash
npx @ariadnejs/mcp
```

## Generic Configuration Pattern

All MCP hosts follow a similar configuration pattern:

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"],
      "env": {
        "PROJECT_PATH": "/path/to/your/project"
      }
    }
  }
}
```

Key components:

- **command**: The executable to run (usually `npx` or `node`)
- **args**: Command arguments (package name or script path)
- **env**: Environment variables (optional)

## Host-Specific Setup Instructions

### Claude Desktop

1. **Open Settings**: Click Claude menu → Settings → Developer tab
2. **Edit Configuration**: Click "Edit config" to open `claude_desktop_config.json`
3. **Add Ariadne Server**:

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"]
    }
  }
}
```

4. **Save and Restart**: Exit Claude Desktop completely and reopen

**Config Location**:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### VS Code

1. **Open Command Palette**: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. **Run Command**: Type "MCP: Add Server" and select it
3. **Choose Configuration Scope**:
   - **Workspace**: Creates `.vscode/mcp.json` in your project
   - **Global**: Adds to your user profile

**Workspace Configuration** (`.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"]
    }
  }
}
```

**Alternative**: Manually create `.vscode/mcp.json` in your project root

### Cursor

1. **Create Configuration File**:

   - **Project-specific**: `.cursor/mcp.json` in your project directory
   - **Global**: `~/.cursor/mcp.json` in your home directory

2. **Add Ariadne Configuration**:

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"]
    }
  }
}
```

3. **Access MCP Settings**:
   - Press `Ctrl+Shift+P` → "Cursor Settings" → "MCP"
   - Or: Settings (`Ctrl+Shift+J`) → Features → Model Context Protocol

## Advanced Configuration

### Custom Project Path

By default, Ariadne uses the current working directory. To specify a different project:

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"],
      "env": {
        "PROJECT_PATH": "/absolute/path/to/your/project"
      }
    }
  }
}
```

### Local Development Setup

If you're developing or have cloned the Ariadne repository:

```json
{
  "mcpServers": {
    "ariadne-dev": {
      "command": "node",
      "args": ["/path/to/ariadne/packages/mcp/dist/cli.js"]
    }
  }
}
```

### Multiple Projects

Configure multiple Ariadne instances for different projects:

```json
{
  "mcpServers": {
    "ariadne-frontend": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"],
      "env": {
        "PROJECT_PATH": "/path/to/frontend"
      }
    },
    "ariadne-backend": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"],
      "env": {
        "PROJECT_PATH": "/path/to/backend"
      }
    }
  }
}
```

## Available Tools

Once configured, the following tools are available:

### `list_entrypoints`

Lists entry point functions ordered by call tree complexity. The default output contains true positives only — known false positives like Flask `@app.route` handlers, pytest fixtures, JSX components, dynamic dispatch, and Python dunders are filtered out by the bundled known-issues registry.

**Parameters:**

- `files` (optional): Specific file paths to analyze
- `folders` (optional): Folder paths to include recursively
- `include_tests` (optional): Include test functions (default: false)

**Show-suppressed mode** (triage):

Pass `--show-suppressed` when starting the MCP server (or set `ARIADNE_SHOW_SUPPRESSED=1`) to append a "Suppressed (known false positives)" section to every `list_entrypoints` response. Each suppressed entry carries a `[group_id: framework]` tag identifying the registry rule that matched. This is a server-level setting (not a per-call argument) so triage workflows enable it once via `.mcp.json` and everyday agents see the clean default.

Configure either via the `args` array (CLI flag) or the `env` block (env var). CLI takes precedence over env, and explicit `--no-show-suppressed` always wins:

```json
{
  "mcpServers": {
    "ariadne-triage": {
      "command": "npx",
      "args": ["-y", "@ariadnejs/mcp", "--show-suppressed"],
      "env": { "PROJECT_PATH": "/path/to/project" }
    }
  }
}
```

Accepted truthy values for `ARIADNE_SHOW_SUPPRESSED`: `1`, `true`, `yes` (case-insensitive). Anything else — including `0`, `false`, empty string, and unset — resolves to false.

### `show_call_graph_neighborhood`

Shows callers and callees around a callable. Use a `Ref` from `list_entrypoints` (or construct one as `file_path:line#name`) as the `symbol_ref` input.

**Parameters:**

- `symbol_ref` (required): Reference identifier in `file_path:line#name` format
- `callers_depth` (optional): Levels of callers to show (`null` = unlimited, default: `1`)
- `callees_depth` (optional): Levels of callees to show (`null` = unlimited, default: `1`)
- `show_full_signature` (optional): Show full signature with params/return type vs just name (default: `true`)
- `files` / `folders` (optional): Filter by scope

## Verification

To verify the setup:

1. **Check Server Status**:

   - Claude Desktop: Developer settings should show the server
   - VS Code: Extensions view → MCP Servers section
   - Cursor: Output panel → MCP Logs

2. **Test a Tool**:
   - Ask the AI to find a definition in your code
   - Check if it can locate references to a function

## Troubleshooting

### Common Issues

#### "Connection closed" or "Server not found"

**Cause**: Command not found in PATH
**Solution**:

- Ensure Node.js is installed: `node --version`
- Verify npx works: `npx --version`
- Use full path to node/npx if needed

#### "Failed to read file"

**Cause**: Incorrect file path or permissions
**Solution**:

- Use relative paths from the project root
- Check file exists and is readable
- Verify PROJECT_PATH environment variable

#### Server doesn't appear in AI tool

**Cause**: Configuration not loaded
**Solution**:

- Restart the AI tool completely
- Check configuration file syntax (valid JSON)
- Verify configuration file location

### Viewing Logs

**Claude Desktop**:

- Developer settings → Show server output

**VS Code**:

- View → Output → Select "MCP Logs" from dropdown

**Cursor**:

- Output panel (`Ctrl+Shift+U`) → "MCP Logs"

### Platform-Specific Issues

**Windows**:

- Use forward slashes in paths: `C:/Users/...`
- May need `cmd /c` prefix: `"command": "cmd", "args": ["/c", "npx", "@ariadnejs/mcp"]`

**macOS/Linux**:

- Ensure proper file permissions
- Check shell profile for PATH issues

## Security Considerations

1. **File Access**: The MCP server can only read files you explicitly request
2. **No Network Access**: Ariadne MCP operates locally only
3. **Read-Only**: Cannot modify your code, only analyzes it
4. **Explicit Actions**: Each tool use requires explicit AI request

## Getting Help

- **Documentation**: [Ariadne GitHub Repository](https://github.com/CRJFisher/ariadne)
- **Issues**: [GitHub Issues](https://github.com/CRJFisher/ariadne/issues)
- **MCP Protocol**: [modelcontextprotocol.io](https://modelcontextprotocol.io)

## Next Steps

1. Configure Ariadne MCP with your preferred AI tool
2. Open a project with TypeScript, JavaScript, Python, or Rust code
3. Ask the AI to find definitions or references in your codebase
4. Explore advanced Ariadne features like call graphs and symbol analysis
