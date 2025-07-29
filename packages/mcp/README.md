# @ariadnejs/mcp

Model Context Protocol server for Ariadne - Expose code intelligence capabilities to AI agents.

## Overview

This package provides an MCP (Model Context Protocol) server that exposes Ariadne's code intelligence features to AI assistants like Claude. It enables AI agents to analyze code structure, find definitions and references, visualize dependencies, and preview refactoring changes.

## Installation

```bash
npm install -g @ariadnejs/mcp
```

## Quick Start

For detailed setup instructions with your AI development tool, see the [Setup Guide](./SETUP.md).

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

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

### Available Tools

#### `go_to_definition`

Find the definition of a symbol at a specific location.

Parameters:

- `file_path`: Path to the file
- `position`: { row: number, column: number }

#### `find_references`

Find all references to a symbol at a specific location.

Parameters:

- `file_path`: Path to the file
- `position`: { row: number, column: number }

## Configuration

The server uses the current working directory by default. To specify a different project path:

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

## Supported Languages

- ✅ JavaScript (including JSX)
- ✅ TypeScript (including TSX)
- ✅ Python
- ✅ Rust
- 🚧 More languages coming soon (Go, Java, C/C++, etc.)

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

## License

ISC
