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
- [`/call_graph/function_calls`](/packages/core/src/call_graph/function_calls) - Finds function calls with early enrichment (local resolution, import tracking)
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

Enhances data using both local and global knowledge in two stages:

**Early Enrichment** (during per-file analysis):
- Function calls enriched with local resolution, import tracking, and type info

**Late Enrichment** (using global knowledge):
- `enrich_method_calls_with_hierarchy()` - Validates methods against inheritance
- `enrich_constructor_calls_with_types()` - Validates constructors against registry
- Cross-file namespace and type flow resolution

Result: Enhanced `FileAnalysis` with both local and cross-file resolutions

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
├── index.ts                              # Main API export, combines generic + bespoke
├── [sub-feature].ts                      # Generic processor + configuration + context
├── [sub-feature].test.ts                 # Tests for main API + generic processor
├── language_configs.ts                   # Language configuration objects (if complex)
├── language_configs.test.ts              # Tests for language configurations
├── [sub-feature].javascript.ts           # JavaScript bespoke features only (if needed)
├── [sub-feature].javascript.test.ts      # JavaScript bespoke tests
├── [sub-feature].typescript.ts           # TypeScript bespoke features only (e.g., decorators)
├── [sub-feature].typescript.test.ts      # TypeScript bespoke tests
├── [sub-feature].python.ts               # Python bespoke features only (e.g., comprehensions)
├── [sub-feature].python.test.ts          # Python bespoke tests
├── [sub-feature].rust.ts                 # Rust bespoke features only (e.g., macros)
├── [sub-feature].rust.test.ts            # Rust bespoke tests
```

**Processing Architecture**:
1. **Configuration-driven processing**: Language differences that are identifier variations (node types, field names) are handled via configuration objects in the main `[sub-feature].ts` file
2. **Bespoke processing**: Truly unique language features that require algorithmic differences go in `[sub-feature].[language].ts` files
3. **Main module file** (`[sub-feature].ts`): Contains the generic processor, configuration dispatch, shared constants (e.g., `MODULE_CONTEXT`), and context interfaces
4. **Language files** (`[sub-feature].[language].ts`): Only contain handlers for features that cannot be expressed through configuration

**Note**: Language-specific features (e.g., Python decorators, Rust macros) follow the multi-language feature pattern but only implement files for their specific language. If complex multi-module processing is needed, use nested folders: `/src/[feature]/[sub-feature]/[sub-sub-feature]/`.

**Important**: Only create folders when a module spills out into further sub-modules, either because of complex code requiring an extra conceptual layer or for language-specific processing files. If a feature has only one sub-functionality, keep it flat. For example, if `import_resolution` only contains namespace imports, all namespace import files should be directly in `import_resolution/`, not in a `namespace_imports/` subfolder.

### Module Organization Pattern

#### index.ts - Minimal Export

The index file should only export the public API:

```typescript
// index.ts - Minimal, just exports
export { ProcessContext, process_feature } from "./[feature]";
export { FeatureInfo } from "@ariadnejs/types";
```

#### [feature].ts - Main Processing Logic

The main module file contains the generic processor and dispatches to bespoke handlers:

```typescript
// [feature].ts - Contains generic processor + dispatch
import { getLanguageConfig } from "./language_configs";
import { handle_typescript_decorators } from "./[feature].typescript";
import { handle_python_comprehensions } from "./[feature].python";

export function process_feature(context: ProcessContext): Result {
  // Generic processing using configuration
  const config = getLanguageConfig(context.language);
  const results = process_generic(context, config);
  
  // Enhance with language-specific bespoke features
  switch (context.language) {
    case "typescript":
      return enhance_with_typescript(results, context);
    case "python":
      return enhance_with_python(results, context);
    default:
      return results;
  }
}

function process_generic(context: ProcessContext, config: LanguageConfig): Result {
  // Configuration-driven processing
  // Uses config.node_types, config.field_names, etc.
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
    call_expression_types: ["call_expression", "new_expression"],
    function_field: "function",
    method_expression_types: ["member_expression"],
  },
  python: {
    call_expression_types: ["call"],
    function_field: "function",  // Note: Python uses 'function' not 'func'
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

This pattern provides clear separation between configuration (what differs) and logic (how to process). Most language differences are identifier variations that configuration handles effectively.

Language-specific files (`[feature].[language].ts`) are appropriate for truly unique processing requirements that cannot be expressed through configuration:
- TypeScript decorators (`@Component()`)
- Python comprehensions (`[x for x in list]`)
- Rust macros (`println!()`)
- Go goroutines (`go func()`)

## Type System

### Type Location Policy

- All **public API types** must be defined in the `@ariadnejs/types` package (`/packages/types`).
- Internal implementation types remain in `/packages/core` and are not exported.

### Coordinate Systems

- **Location type**: Uses 1-based line/column numbering (editor convention)
- **tree-sitter AST**: Uses 0-based row/column positions
- Conversion utilities in `/ast/node_utils.ts` handle this transformation
