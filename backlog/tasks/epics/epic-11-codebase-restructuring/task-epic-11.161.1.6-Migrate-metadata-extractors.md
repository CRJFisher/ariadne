# Task 11.161.1.6: Migrate Metadata Extractors

## Status: Planning

## Parent: Task 11.161.1

## Goal

Move metadata extractor files to the new `metadata_extractors/` directory.

## Current State

Files in `language_configs/`:

- `metadata_types.ts` - Shared interfaces (`MetadataExtractors`, `ReceiverInfo`)
- `javascript_metadata.ts` - JavaScript/TypeScript metadata extraction
- `typescript_metadata.ts` - TypeScript-specific extensions
- `python_metadata.ts` - Python metadata extraction
- `rust_metadata.ts` - Rust metadata extraction

## Target State

```
metadata_extractors/
├── types.ts          # MetadataExtractors, ReceiverInfo (from metadata_types.ts)
├── index.ts          # Factory: get_metadata_extractor(language)
├── javascript.ts     # JAVASCRIPT_METADATA_EXTRACTORS
├── typescript.ts     # TYPESCRIPT_METADATA_EXTRACTORS
├── python.ts         # PYTHON_METADATA_EXTRACTORS
└── rust.ts           # RUST_METADATA_EXTRACTORS
```

## Implementation Steps

### 1. Move metadata_types.ts → types.ts

```typescript
// metadata_extractors/types.ts
import type { SyntaxNode } from "tree-sitter";
import type { SymbolLocation, TypeExpression } from "@ariadnejs/types";

export interface ReceiverInfo {
  receiver_location: SymbolLocation;
  property_chain: string[];
  is_self_reference: boolean;
}

export interface MetadataExtractors {
  extract_type_from_annotation(node: SyntaxNode): TypeExpression | undefined;
  extract_receiver_location_from_call(node: SyntaxNode): ReceiverInfo | undefined;
  extract_property_chain_from_member_access(node: SyntaxNode): string[];
  extract_constructor_target(node: SyntaxNode): SymbolLocation | undefined;
  // ... other methods
}
```

### 2. Move javascript_metadata.ts → javascript.ts

- Rename file
- Update imports to use local `./types`
- Export `JAVASCRIPT_METADATA_EXTRACTORS`

### 3. Move typescript_metadata.ts → typescript.ts

- Rename file
- Update imports
- Export `TYPESCRIPT_METADATA_EXTRACTORS`

### 4. Move python_metadata.ts → python.ts

- Rename file
- Update imports
- Export `PYTHON_METADATA_EXTRACTORS`

### 5. Move rust_metadata.ts → rust.ts

- Rename file
- Update imports
- Export `RUST_METADATA_EXTRACTORS`

### 6. Create index.ts

```typescript
// metadata_extractors/index.ts
import type { Language } from "@ariadnejs/types";
import type { MetadataExtractors } from "./types";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./javascript";
import { TYPESCRIPT_METADATA_EXTRACTORS } from "./typescript";
import { PYTHON_METADATA_EXTRACTORS } from "./python";
import { RUST_METADATA_EXTRACTORS } from "./rust";

const EXTRACTORS: Record<Language, MetadataExtractors> = {
  javascript: JAVASCRIPT_METADATA_EXTRACTORS,
  typescript: TYPESCRIPT_METADATA_EXTRACTORS,
  python: PYTHON_METADATA_EXTRACTORS,
  rust: RUST_METADATA_EXTRACTORS,
};

export function get_metadata_extractor(language: Language): MetadataExtractors {
  const extractor = EXTRACTORS[language];
  if (!extractor) {
    throw new Error(`No metadata extractor for language: ${language}`);
  }
  return extractor;
}

export type { MetadataExtractors, ReceiverInfo } from "./types";
```

### 7. Update Imports

Update all consumers:

- `semantic_index.ts`
- `reference_builder.ts`
- Handler files (once migrated)
- Test files

## Files Affected

| Old Path | New Path |
|----------|----------|
| `language_configs/metadata_types.ts` | `metadata_extractors/types.ts` |
| `language_configs/javascript_metadata.ts` | `metadata_extractors/javascript.ts` |
| `language_configs/typescript_metadata.ts` | `metadata_extractors/typescript.ts` |
| `language_configs/python_metadata.ts` | `metadata_extractors/python.ts` |
| `language_configs/rust_metadata.ts` | `metadata_extractors/rust.ts` |

## Test Files

| Old Path | New Path |
|----------|----------|
| `language_configs/javascript_metadata.test.ts` | `metadata_extractors/javascript.test.ts` |
| `language_configs/python_metadata.test.ts` | `metadata_extractors/python.test.ts` |
| `language_configs/rust_metadata.test.ts` | `metadata_extractors/rust.test.ts` |

## Dependencies

- Task 11.161.1.1 (directory structure)

## Success Criteria

1. All metadata files moved to `metadata_extractors/`
2. Factory function `get_metadata_extractor()` works
3. All imports updated
4. All tests pass
