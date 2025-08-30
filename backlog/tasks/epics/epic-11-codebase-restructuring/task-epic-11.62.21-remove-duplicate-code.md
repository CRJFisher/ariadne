---
id: task-epic-11.62.21
title: Remove Duplicate Code from Symbol Resolution
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, cleanup, refactoring]
dependencies: [task-epic-11.62.14]
parent_task_id: task-epic-11.62
---

## Description

Comprehensive code review revealed significant duplication in symbol_resolution module. It re-implements import/export extraction that already exists in dedicated modules.

## Duplicate Code to Remove

### 1. Import Extraction in Symbol Resolution

**Location:** `/scope_analysis/symbol_resolution/index.ts`
- Line 103-177: Duplicate `extract_imports()` function
- Should use: `/import_export/import_resolution/extract_imports()`

**Language-specific duplicates:**
- `symbol_resolution.javascript.ts`: `extract_es6_imports()`, `extract_commonjs_imports()`
- `symbol_resolution.typescript.ts`: `extract_typescript_imports()`
- `symbol_resolution.python.ts`: `extract_python_imports()`
- `symbol_resolution.rust.ts`: `extract_rust_use_statements()`

### 2. Export Extraction in Symbol Resolution

**Language-specific duplicates:**
- `symbol_resolution.javascript.ts`: 
  - `extract_javascript_exports()` (line 502)
  - `extract_es6_exports()` (line 531)
  - `extract_commonjs_exports()` (line 704)
- `symbol_resolution.typescript.ts`: 
  - `extract_typescript_exports()` (line 440)
- `symbol_resolution.python.ts`: 
  - `extract_python_exports()` (line 450)
- `symbol_resolution.rust.ts`: 
  - `extract_rust_exports()` (line 746)

**Should use:** `/import_export/export_detection/extract_exports()`

## Refactoring Plan

### Step 1: Update Symbol Resolution to Consume Data

Instead of extracting, symbol_resolution should receive imports/exports as parameters:

```typescript
// OLD (current duplicate code)
export function resolve_symbols(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): SymbolResolution {
  // Extracts its own imports/exports
  const imports = extract_imports(root_node, source_code, language);
  const exports = extract_exports(root_node, source_code, language);
  // ...
}

// NEW (consume from proper layers)
export function resolve_symbols(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  imports: ImportInfo[],  // Passed from Layer 2
  exports: ExportInfo[],  // Passed from Layer 2
  file_path?: string
): SymbolResolution {
  // Use provided imports/exports
  // ...
}
```

### Step 2: Remove Duplicate Functions

Delete all import/export extraction functions from symbol_resolution:
- Remove local `extract_imports()` function
- Remove all language-specific import extraction
- Remove all language-specific export extraction
- Remove helper functions only used by these

### Step 3: Update Tests

Update symbol_resolution tests to:
- Pass imports/exports as parameters
- Use the proper import_resolution and export_detection modules
- Remove tests for deleted extraction functions

## Feature Comparison Before Deletion

### Check for Missing Features

Before deleting, verify the duplicate versions don't have features missing from the official versions:

**Import Features to Check:**
- [ ] Namespace imports (`import * as name`)
- [ ] Type-only imports (TypeScript)
- [ ] Side-effect imports (`import 'module'`)
- [ ] Dynamic imports (`import()`)
- [ ] CommonJS requires
- [ ] Python relative imports
- [ ] Rust use statements with aliases

**Export Features to Check:**
- [ ] Named exports
- [ ] Default exports
- [ ] Re-exports (`export { x } from 'module'`)
- [ ] Type-only exports (TypeScript)
- [ ] CommonJS module.exports
- [ ] Python __all__
- [ ] Rust pub declarations

If any features are only in the duplicate version, port them to the official module first.

## Code to Update After Removal

### Files that call symbol_resolution:
- `/packages/core/src/code_graph.ts` - Will need to pass imports/exports
- Any tests that use symbol_resolution

### Update code_graph.ts:

```typescript
// In analyze_file function
const imports = extract_imports(...); // From Layer 2
const exports = extract_exports(...); // From Layer 2

// Later, pass to symbol resolution
const symbols = resolve_symbols(
  tree.rootNode,
  source_code,
  language,
  imports,  // Pass these
  exports,  // Pass these
  file_path
);
```

## Benefits

1. **Eliminates ~500+ lines of duplicate code**
2. **Single source of truth** for import/export extraction
3. **Easier maintenance** - fix bugs in one place
4. **Better separation of concerns** - follows processing pipeline layers
5. **Performance improvement** - no duplicate extraction

## Testing Requirements

- [ ] All existing symbol_resolution tests still pass
- [ ] Cross-file symbol resolution still works
- [ ] No regression in import/export detection
- [ ] Performance should improve (measure before/after)

## Success Criteria

- [ ] No import/export extraction code in symbol_resolution
- [ ] Symbol resolution consumes imports/exports from Layer 2
- [ ] All tests pass
- [ ] No functionality lost
- [ ] Code is cleaner and more maintainable