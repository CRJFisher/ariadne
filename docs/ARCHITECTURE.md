# Information Architecture

## Executive Summary

This document defines the information architecture for the Ariadne repository, establishing patterns for organizing both universal language features and language-specific implementations while maintaining a clear hierarchy from user-facing abstractions down to code-facing parsing details.

## Core Architecture

### Core API and Processing Stages

#### User-Facing API

```typescript
// User calls this single function
const graph = await generate_code_graph({
  root_path: "/project",
  include_patterns: ["src/**/*.ts"],
});

// Then queries the results
const callGraphs = get_call_graphs(graph);
```

#### Internal Processing

```txt
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Per-File  │ →   │    Global    │ →   │  Enrichment  │ →   │  Analytical  │
│   Analysis  │     │   Assembly   │     │              │     │   Queries    │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

##### Per-File Analysis

Each file is analyzed independently (in parallel) to extract local information:

**File Analysis Modules** (detect/extract/find/track pattern):

- [`/scope_analysis/scope_tree`](/packages/core/src/scope_analysis/scope_tree) - Builds scope tree with symbol extraction
- [`/call_graph/function_calls`](/packages/core/src/call_graph/function_calls) - Finds function calls within file
- [`/call_graph/method_calls`](/packages/core/src/call_graph/method_calls) - Finds method calls within file
- [`/import_export/import_resolution`](/packages/core/src/import_export/import_resolution) - Extracts import declarations
- [`/import_export/export_detection`](/packages/core/src/import_export/export_detection) - Detects export statements
- [`/type_analysis/type_tracking`](/packages/core/src/type_analysis/type_tracking) - Tracks local variable types
- [`/inheritance/class_detection`](/packages/core/src/inheritance/class_detection) - Identifies class definitions
- [`/utils/symbol_construction`](/packages/core/src/utils/symbol_construction) - Creates unique SymbolIds
- [`/utils/scope_path_builder`](/packages/core/src/utils/scope_path_builder) - Extracts scope paths for symbols

Result: `FileAnalysis` containing scopes, local calls, imports/exports, types, classes, and symbol registry

##### Global Assembly

[`generate_code_graph()`](/packages/core/src/code_graph.ts) orchestrates global assembly modules to combine file analyses:

**Global Assembly Modules** (resolve/build/_\_graph/_\_hierarchy pattern):

- [`/import_export/module_graph`](/packages/core/src/import_export/module_graph) - Builds `ModuleGraph` from imports/exports
- [`/import_export/namespace_resolution`](/packages/core/src/import_export/namespace_resolution) - Resolves namespace members
- [`/inheritance/class_hierarchy`](/packages/core/src/inheritance/class_hierarchy) - Builds inheritance tree
- [`/type_analysis/type_resolution`](/packages/core/src/type_analysis/type_resolution) - Resolves cross-file types
- [`/scope_analysis/symbol_resolution`](/packages/core/src/scope_analysis/symbol_resolution) - Resolves symbol references
- [`/scope_analysis/symbol_resolution/global_symbol_table`](/packages/core/src/scope_analysis/symbol_resolution/global_symbol_table) - Builds global symbol table
- [`/call_graph/call_chain_analysis`](/packages/core/src/call_graph/call_chain_analysis) - Traces call chains

Result: Complete `CodeGraph` with cross-file references resolved:

```typescript
CodeGraph {
  files: Map<string, FileAnalysis>      // Stage 1 results preserved
  modules: ModuleGraph                  // Dependency graph
  calls: CallGraph                      // All call relationships
  classes: ClassHierarchy               // Inheritance tree
  types: TypeIndex                      // Cross-file types
  symbols: SymbolIndex                  // Global definitions
}
```

##### Enrichment

Enhances per-file data with global knowledge to validate and resolve cross-file relationships:

**Enrichment Functions** (enrich/validate/merge pattern):

- `enrich_method_calls_with_hierarchy()` - Validates methods against inheritance
- `enrich_constructor_calls_with_types()` - Validates constructors against registry
- `merge_constructor_types()` - Merges discovered types bidirectionally

Result: Enhanced `FileAnalysis` with validated calls, resolved inheritance, and cross-file type flow

##### Analytical Queries

[`get_call_graphs()`](/packages/core/src/graph_queries.ts) and other query functions traverse the assembled graph:

- Find entry points (uncalled functions)
- Trace call chains
- Identify unused code
- Navigate inheritance hierarchies
- Resolve symbol references

Each module follows the marshaling pattern below for language-specific handling.

### Folder Structure Pattern

#### Feature including some language-specific logic

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

**Note**: Processing preference order:
1. First, try to handle language differences through configuration in `[sub-feature].ts`
2. Only create language-specific files (`[sub-feature].[language].ts`) when configuration cannot express the needed logic
3. Language-specific implementations should handle truly unique processing that requires algorithmic differences

**Note**: Language-specific features (e.g., Python decorators, Rust macros) follow the multi-language feature pattern but only implement files for their specific language. If complex multi-module processing is needed, use nested folders: `/src/[feature]/[sub-feature]/[sub-sub-feature]/`.

**Important**: Only create folders when a module spills out into further sub-modules, either because of complex code requiring an extra conceptual layer or for language-specific processing files. If a feature has only one sub-functionality, keep it flat. For example, if `import_resolution` only contains namespace imports, all namespace import files should be directly in `import_resolution/`, not in a `namespace_imports/` subfolder.

### Language-Specific Feature Dispatcher Pattern

Every feature's `index.ts` dispatcher follows this functional pattern:

```typescript
// index.ts - Feature dispatcher (explicit dispatch preferred)
import { process_javascript } from "./[feature].javascript";
import { process_python } from "./[feature].python";
import { process_rust } from "./[feature].rust";
import { process_common } from "./common";

export function process_feature(
  ast: ASTNode,
  metadata: { language: Language; file_path: string }
): Result {
  // Common pre-processing
  const prepared = process_common(ast, metadata);

  // Explicit dispatch to language-specific processor
  switch (metadata.language) {
    case "javascript":
    case "typescript":
      return process_javascript(prepared, metadata);
    case "python":
      return process_python(prepared, metadata);
    case "rust":
      return process_rust(prepared, metadata);
    default:
      // Fallback to common-only processing
      return prepared;
  }
}
```

#### Notes

**Explicit Dispatch**: Using an explicit switch/if dispatcher (rather than a map of function references) creates direct call sites that are clearer for static call-graph analysis.

**Processing Flexibility**: The marshaling pattern doesn't prescribe how common and language-specific processors interact. Each feature chooses the appropriate pattern:

- **Additive**: Both processors contribute to a collection (e.g., finding different types of function calls)
- **Refinement**: Language-specific modifies or overrides common results (e.g., correcting type inference)
- **Filtering**: Language-specific removes false positives (e.g., distinguishing real method calls from property access)
- **Augmentation**: Language-specific adds metadata to common structures (e.g., async/generator flags)
- **Transformation**: Language-specific reshapes the output format (e.g., import path resolution rules)

This flexibility allows consistent structure while enabling domain-appropriate processing for each feature.

### Configuration-Driven Language Processing

**Preferred approach**: When language differences are primarily identifier variations (node types, field names) rather than algorithmic differences, use configuration-driven processing as the primary pattern:

```typescript
// Language configuration defines identifiers
const LANGUAGE_CONFIG = {
  javascript: {
    call_expression_types: ["call_expression"],
    function_field: "function",
    method_expression_types: ["member_expression"],
  },
  python: {
    call_expression_types: ["call"],
    function_field: "func",
    method_expression_types: ["attribute"],
  }
};

// Single generic processor uses configuration
function process_calls(node: SyntaxNode, language: Language) {
  const config = LANGUAGE_CONFIG[language];
  if (config.call_expression_types.includes(node.type)) {
    const func = node.childForFieldName(config.function_field);
    // Process using configuration values
  }
}
```

This pattern should be the first choice when ~80% of logic is identical across languages. Language-specific files (`[feature].[language].ts`) remain appropriate for truly unique processing requirements (e.g., TypeScript decorators, Rust macros) that cannot be expressed through configuration.

## Type System

### Type Location Policy

- All **public API types** must be defined in the `@ariadnejs/types` package (`/packages/types`).
- Internal implementation types remain in `/packages/core` and are not exported.

### Coordinate Systems

- **Location type**: Uses 1-based line/column numbering (editor convention)
- **tree-sitter AST**: Uses 0-based row/column positions
- Conversion utilities in `/ast/node_utils.ts` handle this transformation
