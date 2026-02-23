# Ariadne

Code intelligence for AI and developers. Find references, analyze call graphs, and understand code relationships across your entire codebase using tree-sitter.

## What is Ariadne?

Ariadne provides language-agnostic code intelligence by parsing your code into a scope graph that tracks symbols, definitions, references, and relationships. It's designed to power both AI coding assistants and developer tools with deep code understanding capabilities.

## Packages

### [@ariadnejs/mcp](packages/mcp) - AI Assistant Integration

MCP (Model Context Protocol) server that gives AI coding assistants powerful code analysis abilities through natural language.

```bash
npm install -g @ariadnejs/mcp
```

**What it enables:**

- "Find all usages of the authenticate function"
- "Show me what classes implement the Logger interface"
- "What functions does processPayment call?"
- "Analyze the inheritance hierarchy of UserService"

[→ MCP Setup Guide](packages/mcp/SETUP.md) | [→ MCP Documentation](packages/mcp/README.md)

### [@ariadnejs/core](packages/core) - Code Intelligence Engine

The core library that provides AST parsing, scope resolution, and symbol tracking. Perfect for building developer tools or integrating code intelligence into your applications.

```bash
npm install @ariadnejs/core
```

**Key features:**

- Find definitions and references across files
- Build complete function call graphs
- Analyze class inheritance hierarchies
- Track imports and exports
- Support for JS/TS, Python, and Rust

[→ Full Core Documentation](packages/core/README.md)

### [@ariadnejs/types](packages/types) - TypeScript Definitions

Lightweight package containing just the TypeScript type definitions, with zero runtime code.

```bash
npm install @ariadnejs/types
```

Perfect for webviews, type-safe message passing, or when you only need types.

## Quick Start

### For AI Users - MCP Setup

Add to your AI assistant's MCP config:

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

[→ Detailed setup instructions](packages/mcp/SETUP.md)

### For Developers - Using Core Library

```typescript
import { Project } from "@ariadnejs/core";
import * as fs from "fs";
import * as path from "path";

const project = new Project();
await project.initialize("/path/to/project");

// Load source files into the project
function load_dir(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      load_dir(full);
    } else if (/\.(ts|tsx|js|jsx|py|rs)$/.test(entry.name)) {
      project.update_file(full, fs.readFileSync(full, "utf-8"));
    }
  }
}
load_dir("/path/to/project");

// Analyze
const call_graph = project.get_call_graph();
console.log(call_graph.entry_points);
```

[→ See full API documentation](packages/core/README.md)

## Supported Languages

- ✅ JavaScript/TypeScript (including JSX/TSX)
- ✅ Python
- ✅ Rust

Want support for another language? Upvote the relevant issue — we prioritize based on demand:

[Go](https://github.com/CRJFisher/ariadne/issues/44) | [Java](https://github.com/CRJFisher/ariadne/issues/45) | [C](https://github.com/CRJFisher/ariadne/issues/46) | [C++](https://github.com/CRJFisher/ariadne/issues/47) | [C#](https://github.com/CRJFisher/ariadne/issues/48) | [Ruby](https://github.com/CRJFisher/ariadne/issues/49) | [PHP](https://github.com/CRJFisher/ariadne/issues/50) | [Swift](https://github.com/CRJFisher/ariadne/issues/51) | [Kotlin](https://github.com/CRJFisher/ariadne/issues/52)

## Documentation

- **[Architecture](docs/Architecture.md)** — Module structure, registry architecture, language dispatch pattern
- **[Processing Pipeline](docs/PROCESSING_PIPELINE.md)** — Per-file indexing, project-level resolution, call graph detection

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR process.

## License

MIT - See [LICENSE](LICENSE).
