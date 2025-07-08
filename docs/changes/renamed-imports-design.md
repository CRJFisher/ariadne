# Design Options for Handling Renamed Imports

## Problem Statement

When TypeScript/JavaScript code uses renamed imports like:
```typescript
import { formatDate as format } from './utils';
```

Our current implementation only captures `format` as the import name, losing the connection to the original export name `formatDate`. This prevents us from resolving the import back to its definition in the source file.

## Current Architecture

- Language configurations only provide:
  - Parser instance
  - Scope queries (.scm files)
  - Namespace definitions
- The scope resolution algorithm is generic across all languages
- Import nodes only store the local name, not the source name

## Design Options

### Option 1: Enhanced Import Node with Metadata

**Approach**: Extend the Import node to store both local and source names.

```typescript
export interface Import extends BaseNode {
  kind: 'import';
  name: string;          // Local name (e.g., 'format')
  source_name?: string;  // Original export name (e.g., 'formatDate')
  source_module?: string; // Module path (e.g., './utils')
}
```

**Implementation**:
1. Modify the tree-sitter query to capture the full import specifier
2. Parse the import specifier during scope resolution to extract both names
3. Update cross-file resolution to use `source_name` when looking for exports

**Pros**:
- Minimal changes to existing architecture
- Language-agnostic approach (works for any language with renamed imports)
- Preserves all import information

**Cons**:
- Requires parsing import syntax during scope resolution
- More complex queries needed

### Option 2: Language-Specific Processors

**Approach**: Add optional language-specific processing functions to the language configuration.

```typescript
export interface LanguageConfig {
  name: string;
  file_extensions: string[];
  parser: Parser;
  scope_query: string;
  namespaces: string[][];
  
  // New optional processors
  process_import?: (node: SyntaxNode, source: string) => ImportInfo;
  resolve_import_path?: (importPath: string, currentFile: string) => string;
}

export interface ImportInfo {
  local_name: string;
  source_name: string;
  module_path: string;
}
```

**Implementation**:
1. Add processor functions to TypeScript language config
2. Call processor during scope resolution if available
3. Store additional metadata in Import nodes

**Pros**:
- Flexible and extensible
- Can handle language-specific import syntax
- Can resolve relative paths properly

**Cons**:
- Breaks the language-agnostic design
- Requires implementing processors for each language

### Option 3: Two-Pass Resolution with Import Analysis

**Approach**: Add a separate import analysis pass before scope resolution.

```typescript
export interface ImportMap {
  // Map from local name to import details
  [localName: string]: {
    sourceName: string;
    modulePath: string;
    position: Range;
  };
}

export class ScopeGraph {
  private import_map: ImportMap = {};
  // ... rest of the class
}
```

**Implementation**:
1. First pass: Parse imports and build import map
2. Second pass: Normal scope resolution using import map
3. When resolving imports, consult the import map

**Pros**:
- Keeps scope resolution clean
- Import analysis can be sophisticated
- Can be made optional per language

**Cons**:
- Requires two passes over the AST
- More complex overall architecture

### Option 4: Enhanced Tree-Sitter Queries

**Approach**: Use more sophisticated tree-sitter queries to capture import details.

```scheme
;; Capture renamed imports with both names
(import_specifier
  name: (identifier) @source_name
  alias: (identifier) @local_name) @import

;; Store metadata using tree-sitter predicates
(#set! import.source_name source_name)
(#set! import.local_name local_name)
```

**Implementation**:
1. Write complex queries that capture all import variations
2. Use tree-sitter's metadata features to associate information
3. Process metadata during scope resolution

**Pros**:
- Leverages tree-sitter's built-in features
- Keeps processing in the query layer
- Language-specific logic stays in .scm files

**Cons**:
- Complex queries can be hard to maintain
- Limited by tree-sitter's query capabilities
- May not handle all edge cases

### Option 5: Import Resolution Service

**Approach**: Create a separate service/module responsible for import resolution.

```typescript
export interface ImportResolver {
  resolve(importName: string, fromFile: string): ResolvedImport | null;
}

export interface ResolvedImport {
  targetFile: string;
  exportName: string;
  exportType: 'named' | 'default' | 'namespace';
}

export class TypeScriptImportResolver implements ImportResolver {
  constructor(private fileGraphs: Map<string, ScopeGraph>) {}
  
  resolve(importName: string, fromFile: string): ResolvedImport | null {
    // Language-specific import resolution logic
  }
}
```

**Pros**:
- Clean separation of concerns
- Can be as sophisticated as needed
- Easy to test independently

**Cons**:
- Another layer of abstraction
- Need to maintain resolver for each language

## Recommendation

**Option 1 (Enhanced Import Node)** seems like the best balance of:
- Minimal architectural changes
- Sufficient flexibility
- Maintains the language-agnostic core

Combined with **Option 4 (Enhanced Queries)** for capturing the information, this would provide a clean solution that fits well with the existing architecture.

## Implementation Plan

1. Update the Import interface to include source_name and source_module
2. Enhance TypeScript scope queries to capture import specifiers fully
3. Modify scope resolution to extract both names from import captures
4. Update symbol resolver to use source_name when resolving imports
5. Add tests for various import scenarios

This approach would handle:
- Simple renamed imports: `import { foo as bar }`
- Multiple renamed imports: `import { foo as f, bar as b }`
- Mixed imports: `import Default, { foo as bar }`
- Namespace imports: `import * as ns`
- Dynamic imports: `await import()`