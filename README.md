# TypeScript Tree-sitter Implementation

A TypeScript port of bloop's code intelligence engine using tree-sitter for parsing and scope resolution.

## Features

- **AST Parsing**: Uses tree-sitter to parse TypeScript/TSX code into an Abstract Syntax Tree
- **Scope Resolution**: Builds a scope graph for each file tracking definitions, references, imports, and lexical scopes
- **Cross-file Symbol Resolution**: Find definitions and references across multiple files
- **Multi-language Support**: Extensible architecture for supporting multiple programming languages
- **TypeScript-specific Features**: Full support for TypeScript including generics, type aliases, interfaces, and JSX/TSX

## Quick Start

```bash
npm install
```

```typescript
import { Project } from './src/index';

// Create a project instance
const project = new Project();

// Add files to the project
project.add_or_update_file('src/main.ts', sourceCode);
project.add_or_update_file('src/utils.ts', utilsCode);

// Find definition of a symbol
const definition = project.go_to_definition('src/main.ts', { row: 10, column: 15 });

// Find all references to a symbol
const references = project.find_references('src/utils.ts', { row: 5, column: 10 });
```

## Documentation

### Core Concepts

- [How the Scope Mechanism Works](docs/scope-mechanism.md) - Detailed explanation of the scope resolution system
- [Graph Structure and Algorithms](docs/graph-structure.md) - The underlying graph data structure
- [Symbol Resolution](docs/symbol-resolution.md) - How cross-file symbol resolution works

### Implementation Guides

- [Language Configuration](docs/language-configuration.md) - How to add support for new languages
- [Tree-sitter Queries](docs/tree-sitter-queries.md) - Writing and understanding `.scm` query files
- [API Reference](docs/api-reference.md) - Complete API documentation

### Design Decisions

- [Renamed Imports Design](docs/changes/renamed-imports-design.md) - Design exploration for handling renamed imports
- [Renamed Imports Implementation](docs/changes/renamed-imports-implementation.md) - How renamed imports were implemented

## Architecture Overview

The system processes code through several stages:

1. **Parsing** - Tree-sitter parses source code into an AST
2. **Query Matching** - Tree-sitter queries identify important nodes (definitions, references, etc.)
3. **Graph Building** - A scope graph is constructed with nodes and edges
4. **Resolution** - Symbols are resolved by traversing the graph

```text
Source Code → Tree-sitter AST → Query Matches → Scope Graph → Symbol Resolution
```

### Key Components

- **[Project](src/index.ts)** - Main API entry point, manages multiple files
- **[ScopeGraph](src/graph.ts)** - Core graph data structure with nodes and edges
- **[Scope Resolution](src/scope-resolution.ts)** - Builds graphs from tree-sitter queries
- **[Symbol Resolver](src/symbol-resolver.ts)** - Implements find definition/references

## Testing

```bash
npm test              # Run all tests
npm test -- --watch   # Run tests in watch mode
```

Tests cover:

- Basic symbol resolution within files
- Cross-file imports and exports
- TypeScript-specific features (generics, type parameters, etc.)
- Renamed imports (`import { foo as bar }`)
- Edge cases and error handling

## Contributing

### Adding a New Language

1. Create a new directory in `src/languages/<language>/`
2. Add an `index.ts` with a `LanguageConfig` export
3. Add a `scopes.scm` file with tree-sitter queries
4. Write tests for the language features
5. Update documentation

See the [Language Configuration Guide](docs/language-configuration.md) for detailed instructions.

### Code Style

The codebase uses snake_case for consistency with the original Rust implementation, except for:

- Class names (PascalCase)
- Type/Interface names (PascalCase)

## License

[Same as bloop project]
