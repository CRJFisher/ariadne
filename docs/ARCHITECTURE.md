# Ariadne Architecture

## Overview

Ariadne is a multi-language code analysis framework that provides consistent abstractions for understanding code structure across JavaScript, TypeScript, Python, and Rust. The architecture follows a hierarchical pattern from user-facing abstractions down to language-specific parsing implementations.

## Architectural Principles

### 1. Hierarchy of Abstractions

```
User Intent                 "Find all function calls in my codebase"
    ↓
Programming Concepts        Call graph analysis, function detection
    ↓  
Language Features          JavaScript: foo(), Python: foo(), Rust: foo()
    ↓
Parsing Implementation     Tree-sitter queries and AST traversal
```

### 2. Feature-Based Organization

Code is organized by feature categories rather than technical layers:

- **Import Resolution** - How code references other code
- **Call Graph** - Function and method invocations
- **Type System** - Type inference and tracking
- **Scope Resolution** - Variable and symbol scoping
- **Export Detection** - Module public interfaces
- **Inheritance** - Class and trait relationships

### 3. Universal Features with Language Adapters

Most features are universal across languages but have language-specific implementations:

```typescript
// Core abstraction
interface FunctionCallDetector {
  detectCalls(ast: ASTNode): CallInfo[];
}

// Language adapter
class JavaScriptFunctionCallDetector implements FunctionCallDetector {
  detectCalls(ast: ASTNode): CallInfo[] {
    // JavaScript-specific implementation
  }
}
```

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────┐
│                   User API                      │
│         (Project, CallGraph, TypeSystem)        │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│              Feature Abstractions               │
│   (Import Resolution, Call Analysis, etc.)      │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│              Language Adapters                  │
│     (JavaScript, TypeScript, Python, Rust)      │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│            Parsing Infrastructure               │
│        (Tree-sitter, AST Processing)            │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. **Input**: Source code files
2. **Parsing**: Tree-sitter generates AST
3. **Analysis**: Language adapters process AST
4. **Abstraction**: Features provide unified interface
5. **Output**: Structured data (call graph, type info, etc.)

## Feature Categories

### Import Resolution
Handles how code references external modules and symbols:
- Basic imports (import/require)
- Namespace imports (import * as)
- Dynamic imports (runtime loading)
- Re-exports (export forwarding)

### Call Graph
Tracks function and method invocations:
- Function calls
- Method calls
- Method chaining
- Recursive calls
- Cross-file resolution

### Type System
Infers and tracks type information:
- Type inference
- Return types
- Variable type tracking
- Generic/template types

### Scope Resolution
Manages symbol visibility and scoping:
- Lexical scopes
- Hoisting (JavaScript)
- Closures
- Module scoping

### Export Detection
Identifies public module interfaces:
- ES6 exports
- CommonJS exports
- Python __all__
- Rust pub visibility

### Inheritance
Tracks class and trait relationships:
- Class inheritance
- Interface implementation
- Mixins
- Traits (Rust)

## Language Support Strategy

### Support Levels

- **Full Support** ✅: Feature works completely for the language
- **Partial Support** ⚠️: Feature works with known limitations
- **No Support** ❌: Feature not applicable or not implemented

### Adding Language Support

1. Implement language adapter for feature
2. Create language-specific tests
3. Document any limitations
4. Update support matrix

### Language-Specific Features

Some features are unique to specific languages:
- **JavaScript**: Hoisting, prototype chain
- **TypeScript**: Type annotations, interfaces
- **Python**: Decorators, metaclasses
- **Rust**: Ownership, lifetimes

## Testing Architecture

### Contract-Based Testing

Every feature defines a test contract that all languages must implement:

```typescript
interface FeatureContract {
  testBasicUsage(): void;
  testEdgeCases(): void;
  testErrorHandling(): void;
}
```

### Test Organization

```
feature/
├── feature.contract.ts        # Test contract
├── feature.test.ts            # Shared test utilities
├── feature.javascript.test.ts # Language implementation
├── feature.python.test.ts     # Language implementation
└── feature.rust.test.ts       # Language implementation
```

### Coverage Requirements

- All universal features must have tests for all languages
- Language-specific features only need tests for that language
- Test file existence indicates language support

## Performance Considerations

### Parsing Strategy
- Incremental parsing for file changes
- Lazy AST traversal
- Cached query results

### Memory Management
- Streaming processing for large codebases
- Configurable cache sizes
- Automatic cache eviction

### Scalability
- Parallel file processing
- Async I/O operations
- Batched updates

## Extension Points

### Adding New Features

1. Create feature category (if needed)
2. Define feature contract
3. Implement core abstraction
4. Add language adapters
5. Write comprehensive tests

### Adding New Languages

1. Create tree-sitter grammar
2. Implement language configuration
3. Add adapters for each feature
4. Create language-specific tests

### Custom Analyzers

Users can extend the framework with custom analyzers:

```typescript
class CustomAnalyzer extends FeatureAdapter {
  process(ast: ASTNode): AnalysisResult {
    // Custom analysis logic
  }
}
```

## Configuration

### Project Configuration

```typescript
{
  languages: ['javascript', 'python'],
  features: {
    callGraph: { enabled: true },
    typeSystem: { enabled: false }
  },
  parsing: {
    maxFileSize: 1024 * 1024,  // 1MB
    timeout: 5000               // 5 seconds
  }
}
```

### Language Configuration

Each language defines its parsing rules and feature support:

```typescript
{
  name: 'javascript',
  extensions: ['.js', '.jsx'],
  parser: 'tree-sitter-javascript',
  features: {
    hoisting: true,
    decorators: false
  }
}
```

## Error Handling

### Graceful Degradation
- Parse errors don't crash analysis
- Missing imports are logged but don't fail
- Unsupported features return empty results

### Error Reporting
- Structured error messages
- Source location information
- Suggested fixes when possible

## Future Directions

### Planned Features
- LSP integration
- Real-time analysis
- IDE plugins
- Cloud analysis service

### Research Areas
- Machine learning for type inference
- Cross-language refactoring
- Security vulnerability detection
- Performance optimization suggestions