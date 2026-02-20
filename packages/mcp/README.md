# @ariadnejs/mcp

Model Context Protocol server for Ariadne - Give AI coding assistants powerful code intelligence capabilities.

## Overview

This package provides an MCP (Model Context Protocol) server that exposes Ariadne's code intelligence features to AI assistants like Claude, Cursor, Continue, and other MCP-compatible tools. It enables AI agents to understand your codebase deeply by analyzing code structure, finding definitions and references, tracking inheritance relationships, and understanding function call graphs.

### Key Benefits

- **Deep Code Understanding**: AI can navigate your codebase like an experienced developer
- **Accurate Symbol Resolution**: Find exact definitions and usages across files
- **Context-Aware Assistance**: AI understands inheritance, implementations, and call relationships
- **Multi-Language Support**: Works with JavaScript, TypeScript, Python, and Rust

## Installation

### Global Installation (Recommended)

```bash
npm install -g @ariadnejs/mcp
```

### Project-Specific Installation

```bash
npm install --save-dev @ariadnejs/mcp
```

## Quick Start

### Step 1: Install the MCP Server

```bash
npm install -g @ariadnejs/mcp
```

### Step 2: Configure Your AI Assistant

#### Claude Desktop

Add to your `claude_desktop_config.json` (usually in `~/Library/Application Support/Claude/` on macOS):

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

#### Cursor

Add to your `.cursor/mcp/config.json` in your project root:

```json
{
  "servers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"]
    }
  }
}
```

#### Continue

Add to your `~/.continue/config.json`:

```json
{
  "models": [...],
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"]
    }
  }
}
```

For more detailed setup instructions, see the [Setup Guide](./SETUP.md).

## Usage

### Running the MCP Server

```bash
npx ariadne-mcp
```

Or programmatically:

```javascript
import { startServer } from '@ariadnejs/mcp';

startServer({
  projectPath: './my-project'
});
```

### Available Tool

The MCP server currently provides one powerful context-oriented tool:

#### `get_symbol_context`

Get comprehensive information about any symbol by name - no file position needed!

```typescript
// Example usage by AI:
{
  "tool": "get_symbol_context",
  "arguments": {
    "symbol": "processPayment",
    "includeTests": true
  }
}
```

Parameters:

- `symbol` (required): Name of the function, class, or variable to look up
- `searchScope` (optional): "file" | "project" | "dependencies" (default: "project")
- `includeTests` (optional): Whether to include test file references (default: false)

Returns:

- Full function/class implementation with documentation
- Usage statistics (references, imports, tests)
- Call relationships (calls/called by)
- Class inheritance and interface implementations
- File location and signature

Coming soon:

- `get_call_graph` - Analyze function call relationships
- `get_references` - Find all references to a symbol
- `preview_refactor` - Preview the impact of refactoring changes

## Example Use Cases

### For AI Assistants

Once configured, AI assistants can help you with:

- **Code Navigation**: "Show me the implementation of the authenticate function"
- **Impact Analysis**: "What functions would be affected if I change the User class?"
- **Code Understanding**: "Explain how the PaymentService interacts with other services"
- **Refactoring**: "Find all places where the deprecated processOrder function is used"
- **Architecture Review**: "Show me the call graph starting from the main API endpoints"
- **Test Coverage**: "Which functions in the auth module don't have tests?"

### For Developers

The MCP server helps AI assistants provide better:

- **Code Reviews**: Understanding the full context of changes
- **Bug Investigation**: Tracing function calls and data flow
- **Documentation**: Generating accurate docs based on actual code structure
- **Refactoring Suggestions**: Safe rename and move operations
- **Architecture Decisions**: Understanding existing patterns and dependencies

## Configuration

### Environment Variables

- `PROJECT_PATH`: The root directory of your project (defaults to current working directory)
- `DEBUG_LOG_FILE`: Path to a file for debug logging (optional). When set, diagnostic messages are written to this file in addition to stderr.

### Project-Specific Configuration

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "npx",
      "args": ["@ariadnejs/mcp"],
      "env": {
        "PROJECT_PATH": "/path/to/your/project",
        "DEBUG_LOG_FILE": "/tmp/ariadne-debug.log"
      }
    }
  }
}
```

## Supported Languages

- ✅ JavaScript (including JSX)
- ✅ TypeScript (including TSX)
- ✅ Python
- ✅ Rust
- 🚧 More languages coming soon (Go, Java, C/C++, etc.)

## Version Compatibility

This package requires:

- `@ariadnejs/core` >= 0.5.15
- `@ariadnejs/types` >= 0.5.15

The MCP package versions independently from core packages. Check the [releases page](https://github.com/CRJFisher/ariadne/releases) for compatibility information.

## Troubleshooting

### Common Issues

**MCP server not connecting**

- Check that `@ariadnejs/mcp` is installed globally: `npm list -g @ariadnejs/mcp`
- Verify your AI assistant's config file syntax is correct
- Restart your AI assistant after configuration changes

**"Symbol not found" errors**

- Ensure `PROJECT_PATH` points to your project root
- Check that your project files are saved
- Verify the language is supported (JS/TS/Python/Rust)

**Performance issues**

- Large codebases may take time for initial indexing
- Exclude `node_modules` and build directories if possible
- Consider using project-specific installation for better caching

### Debug Mode

Enable file logging to troubleshoot issues:

```json
{
  "env": {
    "DEBUG_LOG_FILE": "/tmp/ariadne-debug.log"
  }
}
```

Then check the log file for diagnostic messages:

```bash
tail -f /tmp/ariadne-debug.log
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start development server
npm start
```

### Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

ISC
