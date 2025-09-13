# Task 11.100.2: Transform import_resolution to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Module Overview

**Location**: `src/import_export/import_resolution/`
**Files**: 5+ files (~2,000 lines)

- `import_resolution.ts` - Generic processor
- `import_resolution.javascript.ts` - JS/CommonJS/ES6
- `import_extraction.ts` - Import extraction logic
- `language_configs.ts` - Import patterns
- `index.ts` - Public API

## Current Implementation

### Manual Pattern Matching

```typescript
function extract_imports(node: SyntaxNode) {
  if (node.type === "import_statement") {
    const source = node.childForFieldName("source");
    const specifiers = node.childForFieldName("specifiers");
    // ... 50+ lines to extract import details
  } else if (node.type === "call_expression") {
    // Check for require()
    const func = node.childForFieldName("function");
    if (func?.text === "require") {
      // ... extract CommonJS
    }
  }
  // Recursive traversal...
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; import_queries/javascript.scm

;; ES6 named imports
(import_statement
  source: (string) @import.source
  (import_specifier
    imported: (identifier) @import.named.original
    local: (identifier) @import.named.local))

;; ES6 default import
(import_statement
  source: (string) @import.source
  (import_clause
    (identifier) @import.default))

;; ES6 namespace import
(import_statement
  source: (string) @import.source
  (import_clause
    (namespace_import (identifier) @import.namespace)))

;; CommonJS require
(variable_declarator
  name: (identifier) @import.commonjs.local
  value: (call_expression
    function: (identifier) @_require (#eq? @_require "require")
    arguments: (arguments (string) @import.commonjs.source)))

;; Dynamic import()
(call_expression
  function: (import) @_import
  arguments: (arguments (string) @import.dynamic.source))

;; Python imports
(import_from_statement
  module_name: (dotted_name) @import.source
  (aliased_import
    name: (dotted_name) @import.named.original
    alias: (identifier) @import.named.local))

;; Rust use statements
(use_declaration
  (scoped_identifier
    path: (identifier) @import.module
    name: (identifier) @import.item))
```

### New Implementation

```typescript
export function extract_imports_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): ImportInfo[] {
  const query = loadImportQuery(language);
  const captures = query.captures(tree.rootNode);

  // Group captures by import statement
  const importGroups = groupCapturesByParent(captures);

  return importGroups.map((group) => ({
    source: group.find((c) => c.name.includes(".source"))?.text || "",
    imported: extractImportedSymbols(group),
    type: determineImportType(group),
    location: group[0].node.startPosition,
  }));
}
```

## Transformation Steps

### 1. Document Import Patterns

- [ ] ES6 imports (default, named, namespace)
- [ ] CommonJS require patterns
- [ ] Dynamic imports
- [ ] Python import/from patterns
- [ ] Rust use statements
- [ ] Side-effect imports

### 2. Create Comprehensive Queries

- [ ] JavaScript/TypeScript patterns
- [ ] Python import patterns
- [ ] Rust use patterns
- [ ] Handle all import variations

### 3. Build Import Extractor

- [ ] Group captures by import statement
- [ ] Extract source paths
- [ ] Map imported symbols
- [ ] Determine import types

### 4. Test Overhaul (Critical)

- [ ] **Audit all existing tests** for import resolution functionality
- [ ] **Add comprehensive query-specific tests**:
  - Query file loading and parsing for all languages
  - Import extraction accuracy for each language
  - Complex import pattern recognition
  - Error handling for malformed imports
  - Performance tests with large codebases
- [ ] **Cross-language consistency tests**:
  - Equivalent import concepts work across languages
  - Module resolution consistency
- [ ] **Edge case testing**:
  - Malformed import statements
  - Mixed import styles (ES6 + CommonJS)
  - Dynamic import edge cases
  - Circular import detection
- [ ] **Integration tests**:
  - Real project import analysis
  - Large dependency graphs
  - Performance with thousands of imports
- [ ] **Achieve 100% test coverage** - no exceptions
- [ ] **All tests must pass** before task completion

### 5. TypeScript Compliance (Critical)

- [ ] **Fix all TypeScript compiler errors**:
  - Run `npx tsc --noEmit` on module files
  - Run `npx tsc --noEmit` on test files
  - Address all type errors, warnings, and issues
- [ ] **Type safety validation**:
  - Proper typing for all import analysis results
  - Type guards for import classification
  - Generic type parameters properly constrained
- [ ] **Strict mode compliance**:
  - Enable and pass `--strict` mode
  - No `any` types without explicit justification
  - Proper null/undefined handling
- [ ] **Import/export validation**:
  - All module imports resolve correctly
  - Public API exports properly typed
  - No circular dependency issues

### 6. Path Resolution and Migration

- [ ] Keep existing path resolution logic
- [ ] Only replace AST traversal
- [ ] Maintain module resolution rules

## Expected Improvements

### Code Reduction

- **Before**: ~2,000 lines
- **After**: ~200 lines + queries
- **Reduction**: 90%

### Performance

- **Before**: Multiple traversals for different patterns
- **After**: Single query execution
- **Expected**: 15x faster

### Completeness

- Catches all import patterns including edge cases
- Consistent across languages

## Success Criteria

**ALL CRITERIA MUST BE MET:**

### Functional Requirements

- [ ] All import types detected accurately
- [ ] Identical ImportInfo output compared to current
- [ ] No regressions in import analysis
- [ ] Language-specific patterns work correctly

### Quality Requirements

- [ ] **100% test coverage achieved**
- [ ] **All tests passing** (old and new)
- [ ] **Zero TypeScript compiler errors** (`npx tsc --noEmit`)
- [ ] **Full --strict mode compliance**
- [ ] Code review approval from team

### Performance Requirements

- [ ] 15x+ performance improvement demonstrated
- [ ] Memory usage improvement or neutral
- [ ] Scalable to large codebases

### Architecture Requirements

- [ ] 90% code reduction achieved
- [ ] Query files properly organized and documented
- [ ] Integration with refined type system
- [ ] Follows updated architectural guidelines

## New Type Creation Functions

Use these functions from `@ariadnejs/types` to create imports:

- `create_named_import()` - For named imports
- `build_module_path()` - To create ModulePath values

Example:
```typescript
import { create_named_import, build_module_path } from '@ariadnejs/types';
import { SymbolName } from '@ariadnejs/types';

const namedImport = create_named_import(
  build_module_path('./module', true),
  [{ name: 'foo' as SymbolName, alias: 'bar' as SymbolName }],
  location,
  'javascript'
);
```

For other import types, construct them directly:
```typescript
// Default import
const defaultImport: DefaultImport = {
  kind: 'default',
  name: 'MyDefault' as SymbolName,
  source: build_module_path('./module', true),
  is_type_only: false,
  is_dynamic: false,
  location,
  language: 'javascript',
  node_type: 'import_statement',
  modifiers: []
};

// Namespace import
const namespaceImport: NamespaceImport = {
  kind: 'namespace',
  namespace_name: 'MyNamespace' as NamespaceName,
  source: build_module_path('./module', true),
  is_type_only: false,
  is_dynamic: false,
  location,
  language: 'javascript',
  node_type: 'import_statement',
  modifiers: []
};

// Side-effect import
const sideEffectImport: SideEffectImport = {
  kind: 'side_effect',
  source: build_module_path('./styles.css', true),
  is_type_only: false,
  is_dynamic: false,
  location,
  language: 'javascript',
  node_type: 'import_statement',
  modifiers: []
};
```
