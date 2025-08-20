# Information Architecture

## Executive Summary

This document defines the information architecture for the Ariadne repository, establishing patterns for organizing both universal language features and language-specific implementations while maintaining a clear hierarchy from user-facing abstractions down to code-facing parsing details.

## Core Architectural Pattern

### Processing Hierarchy

```txt
User API (get_references, find_calls, etc.)
    ↓
Feature Dispatcher (marshaling layer with language metadata)
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│ Common Logic    │ Approach Groups  │ Language Logic  │
│ (all languages) │ (2-3 languages)  │ (1 language)    │
└─────────────────┴──────────────────┴─────────────────┘
    ↓
Tree-sitter AST Processing
```

### Folder Structure Patterns

#### Case 1: Standard Multi-Language Feature

Most features follow this pattern:

```txt
/src/[feature]/[sub-feature]/
├── index.ts                              # Dispatcher/marshaler
├── [sub-feature].ts                      # Shared processing logic
├── [sub-feature].test.ts                 # Common function tests as well as the test contract
├── [sub-sub-feature].ts                  # An extra sub-processing module needed by `[sub-feature].ts`
├── [sub-sub-feature].test.ts             # Tests for the sub-sub-feature
├── [sub-feature].javascript.ts           # JS-specific implementation
├── [sub-feature].javascript.test.ts      # JS test implementation
...
```

#### Case 1b: Language Grouping Feature

When languages share implementation approaches:

```txt
/src/[feature]/[sub-feature]/
├── index.ts                           # Dispatcher/marshaler
├── common.ts                          # Shared logic
├── prototype_approach.ts              # Shared by JS/TS
├── type_approach.ts                   # Shared by Python/Rust
├── [feature].javascript.ts           # Uses prototype_approach
├── [feature].typescript.ts           # Uses prototype_approach
├── [feature].python.ts               # Uses type_approach
├── [feature].rust.ts                 # Uses type_approach
└── test files...
```

**Note**: Language-specific features (e.g., Python decorators, Rust macros) follow Case 1 but only implement files for their specific language. If complex multi-module processing is needed, use nested folders: `/src/[feature]/[sub-feature]/[sub-sub-feature]/`.

**Important**: Only create folders when a module spills out into further sub-modules, either because of complex code requiring an extra conceptual layer or for language-specific processing files. If a feature has only one sub-functionality, keep it flat. For example, if `import_resolution` only contains namespace imports, all namespace import files should be directly in `import_resolution/`, not in a `namespace_imports/` subfolder.

### Marshaling Pattern

Every feature's `index.ts` dispatcher follows this functional pattern:

```typescript
// index.ts - Feature dispatcher
import { process_javascript } from './[feature].javascript';
import { process_python } from './[feature].python';
import { process_common } from './common';

const processors = {
  javascript: process_javascript,
  typescript: process_javascript, // Can share processor
  python: process_python,
  rust: process_rust
};

export function process_feature(
  ast: ASTNode, 
  metadata: { language: Language, file_path: string }
): Result {
  // Common pre-processing
  const prepared = process_common(ast, metadata);
  
  // Dispatch to language-specific processor
  const processor = processors[metadata.language];
  if (!processor) {
    return prepared; // Fallback to common-only processing
  }
  
  // Language-specific enhancement
  return processor(prepared, metadata);
}
```

### Test Contract Pattern

```typescript
// test.contract.ts - Defines mandatory test cases
export interface FeatureTestContract {
  // All languages must implement these
  test_basic_case(): void;
  test_edge_case(): void;
  test_error_handling(): void;
  
  // Optional language-specific extensions
  test_language_specific?(): void;
}

// Validation ensures all language tests implement the contract
```

### Key Architectural Rules

1. **Language metadata flows through all functions** - no stateful classes
2. **Dispatchers are explicit** - `index.ts` shows the routing logic clearly
3. **Common logic is genuinely common** - not forced abstraction
4. **Test contracts enforce coverage** - tooling validates implementation
5. **Language groupings are visible** in the folder structure

## Concrete Examples

### Example 1: Function Calls (Standard Multi-Language)

```typescript
// call_graph/function_calls/index.ts
import { find_common_calls } from './common';
import { find_javascript_calls } from './function_calls.javascript';
import { find_python_calls } from './function_calls.python';

const call_finders = {
  javascript: find_javascript_calls,
  typescript: find_javascript_calls,
  python: find_python_calls,
  rust: find_rust_calls
};

export function find_function_calls(
  ast: ASTNode,
  metadata: { language: Language, file_path: string }
): CallInfo[] {
  const common_calls = find_common_calls(ast, metadata);
  const finder = call_finders[metadata.language];
  return finder ? finder(ast, metadata, common_calls) : common_calls;
}
```

### Example 2: Import Resolution (Language Grouping)

```typescript
// import_resolution/imports/index.ts
import { resolve_esmodule_import } from './esmodule_approach';
import { resolve_commonjs_import } from './commonjs_approach';

const import_resolvers = {
  javascript: resolve_esmodule_import,
  typescript: resolve_esmodule_import,
  python: resolve_python_import,
  rust: resolve_rust_use
};

export function resolve_import(
  import_node: ASTNode,
  metadata: { language: Language, file_path: string }
): ResolvedImport | null {
  const resolver = import_resolvers[metadata.language];
  return resolver ? resolver(import_node, metadata) : null;
}
```

## Scope Queries and Language Configuration

### Scope Query Organization

Tree-sitter scope queries (`.scm` files) define how to extract symbols and scopes from each language's AST. These are organized in a flat structure for clarity:

```txt
/src/scope_queries/
├── loader.ts                     # Central loader and file extension mapping
├── javascript.scm                # JavaScript scope patterns
├── javascript.meta.json          # Symbol kinds and capture mappings
├── javascript.md                 # JavaScript-specific documentation
├── typescript.scm                # TypeScript scope patterns
├── typescript.meta.json          # Symbol kinds and capture mappings
├── typescript.md                 # TypeScript-specific documentation
├── python.scm                    # Python scope patterns
├── python.meta.json              # Symbol kinds and capture mappings
├── python.md                     # Python-specific documentation
├── rust.scm                      # Rust scope patterns
├── rust.meta.json                # Symbol kinds and capture mappings
└── rust.md                       # Rust-specific documentation
```

### Language Registration

The central loader manages file extensions, parsers, and scope queries:

```typescript
// scope_queries/loader.ts

// File extension to language mapping - single source of truth
const FILE_EXTENSIONS: Record<string, Language> = {
  'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript', 'jsx': 'javascript',
  'ts': 'typescript', 'tsx': 'typescript', 'mts': 'typescript', 'cts': 'typescript',
  'py': 'python', 'pyw': 'python',
  'rs': 'rust',
};

export function get_language_for_file(file_path: string): Language | null {
  const ext = path.extname(file_path).slice(1);
  return FILE_EXTENSIONS[ext] || null;
}

export function load_scope_query(language: Language): string {
  const query_path = path.join(__dirname, `${language}.scm`);
  return fs.readFileSync(query_path, 'utf8');
}

export function load_language_metadata(language: Language): LanguageMetadata {
  const meta_path = path.join(__dirname, `${language}.meta.json`);
  return JSON.parse(fs.readFileSync(meta_path, 'utf8'));
}

export function get_language_parser(language: Language): Parser {
  const parsers = {
    javascript: create_javascript_parser,
    typescript: create_typescript_parser,
    python: create_python_parser,
    rust: create_rust_parser
  };
  
  const create_parser = parsers[language];
  return create_parser ? create_parser() : null;
}
```

### Feature Integration

Language-specific features access scope queries through the central loader:

```typescript
// scope_resolution/basic_scopes/basic_scopes.javascript.ts
import { load_scope_query } from '../../scope_queries/loader';

export function extract_javascript_scopes(
  ast: ASTNode,
  metadata: { language: Language, file_path: string }
): ScopeInfo[] {
  const scope_query = load_scope_query('javascript');
  const parser = get_language_parser('javascript');
  // JavaScript-specific scope extraction
}
```

This approach:
- **Centralizes** all scope queries in one location
- **Simplifies** the loading mechanism (no path hunting)
- **Separates** parsing configuration from feature logic
- **Maintains** clear language documentation alongside queries

## Key Terminology

- **Feature Category**: Top-level grouping (e.g., call_graph, import_resolution)
- **Feature**: Specific capability (e.g., function_calls, namespace_imports)
- **Dispatcher/Marshaler**: The `index.ts` that routes to language-specific processors
- **Language Metadata**: Object containing language and file context passed through all functions
- **Approach Group**: Shared implementation used by 2-3 languages with similar patterns
- **Test Contract**: Interface defining mandatory test cases all languages must implement
- **Scope Query**: Tree-sitter pattern file (`.scm`) defining what to capture from AST

## Complete Feature Example

```typescript
// import_resolution/basic_imports/index.ts
import { normalize_import_path } from './common';
import { resolve_javascript_import } from './basic_imports.javascript';
import { resolve_python_import } from './basic_imports.python';

const import_resolvers = {
  javascript: resolve_javascript_import,
  typescript: resolve_javascript_import,
  python: resolve_python_import,
  rust: resolve_rust_import
};

export function resolve_basic_import(
  node: ASTNode,
  metadata: { language: Language, file_path: string }
): ResolvedImport | null {
  const normalized_path = normalize_import_path(node, metadata);
  const resolver = import_resolvers[metadata.language];
  return resolver ? resolver(node, normalized_path, metadata) : null;
}

// basic_imports.javascript.ts
export function resolve_javascript_import(
  node: ASTNode,
  normalized_path: string,
  metadata: { language: Language, file_path: string }
): ResolvedImport {
  // JavaScript-specific import resolution
  return {
    path: normalized_path,
    symbols: extract_esmodule_symbols(node),
    type: 'esmodule'
  };
}
```