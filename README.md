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

1. Install globally: `npm install -g @ariadnejs/mcp`
2. Add to your AI assistant's config:

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

3. Ask natural language questions about your code!

[→ Detailed setup instructions](packages/mcp/SETUP.md)

### For Developers - Using Core Library

```typescript
import { Project } from "@ariadnejs/core";

const project = new Project();
project.add_or_update_file("src/main.ts", sourceCode);

// Find where a symbol is defined
const definition = project.go_to_definition("src/main.ts", { row: 10, column: 15 });

// Find all usages
const references = project.find_references("src/main.ts", { row: 10, column: 15 });
```

[→ See full API documentation](packages/core/README.md)

## Supported Languages

- ✅ JavaScript/TypeScript (including JSX/TSX)
- ✅ Python
- ✅ Rust
- 🚧 Go, Java, C/C++ (coming soon)

## Documentation

- **[Architecture](docs/Architecture.md)** - System architecture and design patterns
- **[Core Concepts](docs/scope-mechanism.md)** - How scope resolution works
- **[Graph Structure](docs/graph-structure.md)** - Scope graph data structures
- **[Language Support](docs/language-configuration.md)** - Adding new languages
- **[All Documentation](docs/README.md)** - Complete documentation index

## Known Limitations

- **Cross-file method resolution**: Method calls on imported class instances are not yet resolved ([details](docs/cross-file-method-resolution.md))
- **Export detection**: The system doesn't distinguish between exported and non-exported definitions ([task-30](https://github.com/sourcecodegraph/ariadne/issues/30))
- **Module path resolution**: Import paths are resolved through brute-force search ([task-28](https://github.com/sourcecodegraph/ariadne/issues/28))

## Contributing

See our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up the development environment
- Running tests
- Adding language support
- Code style guidelines

## License

MIT - See [LICENSE](LICENSE).
