# Task 11.161.1.1: Create Semantic Role Directory Structure

## Status: Planning

## Parent: Task 11.161.1

## Goal

Create the new directory structure for semantic role organization.

## Target Structure

```
packages/core/src/index_single_file/query_code_tree/
├── capture_handlers/           # Capture name → handler mappings
│   ├── types.ts               # HandlerFunction type, HandlerRegistry type
│   └── index.ts               # Factory: get_handler_registry(language)
│
├── metadata_extractors/        # AST → semantic info extraction
│   ├── types.ts               # MetadataExtractors interface (from metadata_types.ts)
│   └── index.ts               # Factory: get_metadata_extractor(language)
│
├── symbol_factories/           # SymbolId creation helpers
│   ├── types.ts               # Shared types
│   └── index.ts               # Re-exports
│
└── queries/                    # .scm files (unchanged)
```

## Implementation Steps

### 1. Create Directories

```bash
mkdir -p packages/core/src/index_single_file/query_code_tree/capture_handlers
mkdir -p packages/core/src/index_single_file/query_code_tree/metadata_extractors
mkdir -p packages/core/src/index_single_file/query_code_tree/symbol_factories
```

### 2. Create capture_handlers/types.ts

```typescript
import type { SyntaxNode } from "tree-sitter";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";

/**
 * Handler function signature for processing tree-sitter captures
 */
export type HandlerFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

/**
 * Registry mapping capture names to handler functions
 * Uses object literal (not Map) to preserve call graph traceability
 */
export type HandlerRegistry = Readonly<Record<string, HandlerFunction>>;
```

### 3. Create capture_handlers/index.ts

```typescript
import type { Language } from "@ariadnejs/types";
import type { HandlerRegistry } from "./types";

// Import language-specific handlers (to be created in subsequent tasks)
// import { JAVASCRIPT_HANDLERS } from "./javascript";
// import { TYPESCRIPT_HANDLERS } from "./typescript";
// import { PYTHON_HANDLERS } from "./python";
// import { RUST_HANDLERS } from "./rust";

export function get_handler_registry(language: Language): HandlerRegistry {
  // Placeholder - will be implemented as handlers are migrated
  throw new Error(`Handler registry not yet implemented for ${language}`);
}

export type { HandlerFunction, HandlerRegistry } from "./types";
```

### 4. Create metadata_extractors/types.ts

Move content from `language_configs/metadata_types.ts`:

- `MetadataExtractors` interface
- `ReceiverInfo` type
- Any other shared types

### 5. Create metadata_extractors/index.ts

```typescript
import type { Language } from "@ariadnejs/types";
import type { MetadataExtractors } from "./types";

export function get_metadata_extractor(language: Language): MetadataExtractors {
  // Placeholder - will be implemented as extractors are migrated
  throw new Error(`Metadata extractor not yet implemented for ${language}`);
}

export type { MetadataExtractors, ReceiverInfo } from "./types";
```

### 6. Create symbol_factories/types.ts

```typescript
import type { SymbolId, SymbolLocation } from "@ariadnejs/types";
import type { CaptureNode } from "../../semantic_index";

/**
 * Common parameters for symbol creation
 */
export interface SymbolCreationContext {
  capture: CaptureNode;
  file_path: string;
}
```

### 7. Create symbol_factories/index.ts

```typescript
// Re-exports for symbol factory functions
// Will be populated as factories are migrated from *_builder.ts files

export type { SymbolCreationContext } from "./types";
```

## Files Created

- `capture_handlers/types.ts`
- `capture_handlers/index.ts`
- `metadata_extractors/types.ts`
- `metadata_extractors/index.ts`
- `symbol_factories/types.ts`
- `symbol_factories/index.ts`

## Success Criteria

1. All directories created
2. Type files compile without errors
3. Index files export placeholder factories
4. No changes to existing functionality (yet)
