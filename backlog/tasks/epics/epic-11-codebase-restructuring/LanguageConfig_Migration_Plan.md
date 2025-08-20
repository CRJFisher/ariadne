# LanguageConfig Migration Plan

## Current State

The `LanguageConfig` interface currently bundles multiple concerns:

```typescript
interface LanguageConfig {
  name: string;
  file_extensions: string[];
  parser: Parser;
  scope_query: string;
  namespaces: string[][];
  extract_context?: (node, source_lines, start_line) => ExtractedContext;
}
```

Each language has an `index.ts` that:
1. Hunts for the `.scm` file through multiple paths
2. Initializes the parser
3. Defines namespaces (symbol categories)
4. Optionally defines context extraction

## Problems with Current Approach

1. **Path hunting complexity** - Each language's index.ts has 6+ path variations to find `.scm` files
2. **Mixed concerns** - Language config combines parsing, querying, and feature logic
3. **Centralized definition** - All language aspects defined in one place, not feature-distributed
4. **Namespace confusion** - The `namespaces` concept doesn't align with feature-based architecture

## Migration Target

Distribute language-specific functionality according to the Architecture pattern:

### 1. Scope Queries → Flat Structure

**From:**
```
src/languages/javascript/scopes.scm
src/languages/python/scopes.scm
```

**To:**
```
src/scope_queries/javascript.scm
src/scope_queries/python.scm
```

### 2. Parser Initialization & File Extensions → Central Loader

**From:** Each language's `index.ts` initializing parsers and defining extensions

**To:** `scope_queries/loader.ts`

```typescript
// File extension mapping - the ONLY place this is defined
const FILE_EXTENSIONS: Record<string, Language> = {
  // JavaScript
  'js': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'jsx': 'javascript',
  // TypeScript
  'ts': 'typescript',
  'tsx': 'typescript',
  'mts': 'typescript',
  'cts': 'typescript',
  // Python
  'py': 'python',
  'pyw': 'python',
  // Rust
  'rs': 'rust',
};

export function file_extension_to_language(ext: string): Language | null {
  return FILE_EXTENSIONS[ext] || null;
}

export function get_parser_for_file(file_path: string): Parser | null {
  const ext = path.extname(file_path).slice(1);
  const language = file_extension_to_language(ext);
  return language ? get_language_parser(language) : null;
}
```

### 3. Namespaces → Scope Query Metadata

The `namespaces` concept defines which symbol kinds are extracted by the `.scm` files. This metadata should live alongside the scope queries:

**From:** Global namespace definitions in LanguageConfig

```typescript
namespaces: [
  ["function", "class", "method"],  // Namespace 0: callable symbols
  ["variable", "constant", "parameter"]  // Namespace 1: value symbols
]
```

**To:** Metadata files alongside scope queries

`scope_queries/javascript.meta.json`:
```json
{
  "symbol_kinds": {
    "callable": ["function", "generator", "method", "class", "constructor"],
    "value": ["variable", "constant", "parameter", "property", "label"],
    "type": ["class", "interface", "type", "enum"]
  },
  "captures": {
    "@local.definition.function": "function",
    "@local.definition.class": "class",
    "@local.definition.variable": "variable",
    "@local.definition.parameter": "parameter"
  }
}
```

This metadata describes:
- What symbol kinds the `.scm` file captures
- How tree-sitter captures map to symbol kinds
- The semantic categories for symbol resolution

Usage in features:

```typescript
// scope_resolution/symbol_categories/symbol_categories.javascript.ts
import javascript_meta from '../../scope_queries/javascript.meta.json';

export function get_javascript_symbol_namespace(
  symbol_kind: string,
  metadata: { language: Language, file_path: string }
): SymbolNamespace {
  // Use metadata to determine namespace
  for (const [namespace, kinds] of Object.entries(javascript_meta.symbol_kinds)) {
    if (kinds.includes(symbol_kind)) {
      return namespace as SymbolNamespace;
    }
  }
  return 'unknown';
}
```

### 4. Context Extraction → Feature Implementation

**From:** `extract_context` in LanguageConfig

**To:** Feature-specific extraction
```typescript
// documentation/context_extraction/context_extraction.javascript.ts
export function extract_javascript_context(
  node: ASTNode,
  metadata: { language: Language, file_path: string }
): ExtractedContext {
  return extract_jsdoc_context(node, metadata);
}
```

## Migration Steps

### Phase 1: Create New Structure (Non-Breaking)

1. Create `src/scope_queries/` folder
2. Copy all `.scm` files to flat structure
3. Create `loader.ts` with:
   - `load_scope_query(language: Language): string`
   - `get_language_parser(language: Language): Parser`
   - `file_extension_to_language(ext: string): Language`

### Phase 2: Migrate Features

For each feature currently using LanguageConfig:

1. **Scope Resolution**
   - Create `scope_resolution/basic_scopes/` structure
   - Implement language-specific scope extractors
   - Use central `load_scope_query()` instead of LanguageConfig

2. **Symbol Categorization**
   - Create `symbol_resolution/categorization/` structure
   - Move namespace logic to language-specific categorizers
   - Remove dependency on LanguageConfig.namespaces

3. **Context Extraction**
   - Create `documentation/context_extraction/` structure
   - Move extract_context methods to language-specific modules
   - Remove from LanguageConfig

### Phase 3: Remove Old Structure

1. Delete `src/languages/*/index.ts` files
2. Remove LanguageConfig interface
3. Update all imports

## Compatibility Layer

During migration, maintain compatibility:

```typescript
// temporary_compatibility.ts
export function get_language_config_compat(language: string): LanguageConfig {
  return {
    name: language,
    file_extensions: get_file_extensions(language),
    parser: get_language_parser(language),
    scope_query: load_scope_query(language),
    namespaces: [], // Deprecated - use feature-specific categorization
    extract_context: undefined // Deprecated - use feature-specific extraction
  };
}
```

## Benefits After Migration

1. **Simpler file loading** - No path hunting, just `${language}.scm`
2. **Feature-focused** - Language logic distributed by feature
3. **Clearer separation** - Parsing config vs. feature logic
4. **Easier testing** - Each feature tests its language support
5. **Better scaling** - New languages just add files, no central config

## Example: Adding a New Language (Go)

**Before:** Create `src/languages/go/` with index.ts, scopes.scm, tests

**After:**
1. Add `src/scope_queries/go.scm`
2. Add parser creation to `loader.ts`
3. For each feature that supports Go:
   - Add `[feature].go.ts`
   - Add `[feature].go.test.ts`
   - Update dispatcher to include Go

## Testing Strategy

1. **Parallel implementation** - New structure alongside old
2. **Feature flag** - `USE_NEW_LANGUAGE_ARCHITECTURE`
3. **Incremental migration** - One feature at a time
4. **Validation** - Ensure same results with both approaches
5. **Performance testing** - Verify no regression

## Success Criteria

- [ ] All `.scm` files in flat `scope_queries/` folder
- [ ] No path hunting in codebase
- [ ] LanguageConfig interface removed
- [ ] All features use dispatcher pattern
- [ ] Language-specific logic distributed by feature
- [ ] Tests pass with new architecture