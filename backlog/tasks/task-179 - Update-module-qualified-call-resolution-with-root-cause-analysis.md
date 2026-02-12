---
id: task-179
title: Update module-qualified-call-resolution with root cause analysis
status: To Do
assignee: []
created_date: '2026-02-10 20:22'
labels:
  - bug
  - call-graph
dependencies: []
priority: medium
---

## Description

Python `from package import module` creates a named import (`import_kind: "named"`) that refers to a submodule file rather than a symbol. The resolution pipeline treats all named imports as symbol imports, causing `module.function()` calls to be unresolved. This produces 17 false positive entry points in the AmazonAdv/projections analysis. Examples: `train` in `pipeline.py:55`, `qb_to_rows` in `read.py:387`, `generate_predictions_at_date` in `generate.py:26`. Evidence: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json`.

## Root Cause

Three layers of the resolution pipeline fail in sequence:

**Layer 1 — Name Resolution** (`name_resolution.ts:146-172`): For `from training import pipeline`, `import_kind` is `"named"`. The export chain resolves `training` to `training/__init__.py`, then looks for `pipeline` as an export. Since `pipeline` is a submodule file (not an explicit export), the chain returns null. Nothing is stored in `scope_resolutions`. Key evidence: `DefinitionRegistry.update_file` (line 118-120) explicitly excludes import definitions from `by_scope`, so the name simply has no mapping.

**Layer 2 — Receiver Resolution** (`receiver_resolution.ts:248`): The gate `def.import_kind === "namespace"` blocks named imports even if Layer 1 were fixed.

**Layer 3 — Method Lookup** (`method_lookup.ts:56-74`): The named import handler resolves to the parent package (`training/__init__.py`), but the target function lives in `training/pipeline.py`.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Named imports that resolve to modules are treated as namespace imports in receiver resolution
- [ ] #2 Module.function() calls resolve to function definitions
- [ ] #3 Tests cover from package import module and import module patterns
- [ ] #4 Python-specific path logic is contained within import_resolution.python.ts (not in language-agnostic resolution modules)
<!-- AC:END -->

## Implementation Plan

### Step 1a: Add `resolve_submodule_path_python` to import resolution

Add a new function to `import_resolution.python.ts` that checks whether a named import's name corresponds to a submodule file. Follows the existing language-specific dispatch pattern used by `resolve_module_path`. Uses the same `has_file_in_tree` + relative path pattern already used throughout the file.

```typescript
export function resolve_submodule_path_python(
    resolved_source_file: FilePath,
    import_name: string,
    root_folder: FileSystemFolder
): FilePath | undefined {
    const source_dir = path.dirname(resolved_source_file);
    const candidates = [
        path.join(source_dir, import_name + ".py"),
        path.join(source_dir, import_name, "__init__.py"),
    ];
    for (const candidate of candidates) {
        const relative = path.isAbsolute(candidate)
            ? path.relative(root_folder.path, candidate)
            : candidate;
        if (has_file_in_tree(relative as FilePath, root_folder)) {
            return candidate as FilePath;
        }
    }
    return undefined;
}
```

**File**: `packages/core/src/resolve_references/import_resolution/import_resolution.python.ts`

### Step 1b: Add dispatch function to import resolution

Add `resolve_submodule_import_path` to the dispatch module alongside `resolve_module_path`. For non-Python languages, return `undefined`.

```typescript
export function resolve_submodule_import_path(
    resolved_source_file: FilePath,
    import_name: string,
    language: Language,
    root_folder: FileSystemFolder
): FilePath | undefined {
    if (language === "python") {
        return resolve_submodule_path_python(resolved_source_file, import_name, root_folder);
    }
    return undefined;
}
```

**File**: `packages/core/src/resolve_references/import_resolution/import_resolution.ts`

### Step 1c: Pre-compute submodule paths in ImportGraph

In `ImportGraph.update_file()`, after resolving each import's module path, call the new dispatch function. Store results in a dedicated cache.

```typescript
// In the import processing loop (after line 123):
if (imp_def.import_kind === "named") {
    const import_name = (imp_def.original_name || imp_def.name) as string;
    const submodule_path = resolve_submodule_import_path(
        resolved_path, import_name, language, root_folder
    );
    if (submodule_path) {
        this.submodule_import_paths.set(imp_def.symbol_id, submodule_path);
    }
}
```

Add field: `private submodule_import_paths: Map<SymbolId, FilePath> = new Map();`
Add method: `get_submodule_import_path(import_symbol_id: SymbolId): FilePath | undefined`
Clean up in `remove_file()` and `clear()`.

**File**: `packages/core/src/project/import_graph.ts`

### Step 2: Use submodule path in name resolution fallback

In `resolve_scope_recursive`, after the export chain returns null for a named import, query the pre-computed submodule path. If found, store `imp_def.symbol_id` (same as namespace import behavior). No `.py` strings or path construction — just a pre-computed cache lookup.

```typescript
// After line 172, when resolved is null:
if (!resolved) {
    const submodule_path = context.imports.get_submodule_import_path(imp_def.symbol_id);
    if (submodule_path) {
        resolved = imp_def.symbol_id;
    }
}
```

**File**: `packages/core/src/resolve_references/name_resolution.ts`

### Step 3: Widen receiver resolution import gate

Change line 248 from `if (def?.kind === "import" && def.import_kind === "namespace")` to `if (def?.kind === "import")`. Safe because named imports that resolve through the export chain produce the target's symbol_id (class, function, etc.), so `def?.kind` would never be `"import"` for those. Only module-as-named-import cases (from Step 2) and namespace imports match.

Update comment from "namespace import" to "module-level import". Add `resolve_submodule_import_path` to `ResolutionContext`.

**File**: `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts`

### Step 4: Add submodule fallback in method lookup

In the named import handler (lines 56-74), after `resolve_named_import` returns null, query the submodule path and use `resolve_namespace_method`. No path construction — just a pre-computed cache lookup via callback.

```typescript
if (!actual_type) {
    const submodule_path = context.resolve_submodule_import_path?.(receiver_type);
    if (submodule_path) {
        return resolve_namespace_method(submodule_path, method_name, definitions);
    }
}
```

**File**: `packages/core/src/resolve_references/call_resolution/method_lookup.ts`

### Step 5: Wire the submodule resolver callback

Pass `imports.get_submodule_import_path` as the `resolve_submodule_import_path` callback in `call_resolver.ts`. Follows the same pattern as the existing `resolve_import_path` wiring at line 220.

**File**: `packages/core/src/resolve_references/call_resolution/call_resolver.ts`

### Step 6: Tests

**Python-specific integration test** — new `receiver_resolution.python.integration.test.ts` (follows `callable_instance.python.test.ts` convention):

- `from package import module; module.func()` resolves to the function definition
- `from package import module as alias; alias.func()` — uses `original_name` for path
- `from package import symbol; symbol.method()` — export chain succeeds, no fallback
- Multi-file setup: package directory with `__init__.py` + submodule `.py` file

**Submodule path resolution tests** — add to existing `import_resolution.python.test.ts`:

- Returns module file when `import_name.py` exists
- Returns `__init__.py` when `import_name/` is a package
- Returns undefined when no matching file exists

**ImportGraph cache tests** — add to existing `import_graph.test.ts`:

- `get_submodule_import_path` returns module file for Python named imports of modules
- Returns undefined for named imports of symbols
- Entries cleaned up on `remove_file()` and `clear()`

**Method lookup fallback test** — add to existing `method_lookup.test.ts`:

- Named import receiver where `resolve_named_import` fails but submodule path exists

## Edge Case Safety

| Pattern | Export chain | Name resolution | Receiver resolution | Method lookup |
|---------|-------------|-----------------|--------------------|----|
| `import X` (namespace) | N/A — stores `symbol_id` | Has mapping | `kind="import"` ✓ | Namespace handler ✓ |
| `from X import Class` (named, symbol) | Succeeds → target id | Has mapping (target) | `kind="class"` — skip | Class member lookup ✓ |
| `from X import module` (named, module) | Fails | **Submodule fallback** → `symbol_id` | **Widened check** → pass | **Submodule fallback** → `resolve_namespace_method` |
| `from X import typo` (named, missing) | Fails | No submodule → null | Returns null | N/A |
| `from X import module` where `__init__.py` re-exports `module` | **Succeeds** → target id | Has mapping (target) | `kind` is target type — skip | Target type handler ✓ |

## Verification

1. `npx vitest run packages/core/src/resolve_references/import_resolution/` — submodule path resolution tests
2. `npx vitest run packages/core/src/project/import_graph` — ImportGraph submodule cache tests
3. `npx vitest run packages/core/src/resolve_references/call_resolution/` — all call resolution tests
4. `npx vitest run packages/core/src/resolve_references/name_resolution` — name resolution tests
5. Run external entrypoint analysis on AmazonAdv/projections — confirm 17 false positives eliminated
6. Run self-entrypoint analysis — confirm no regressions

## Critical Files

- `packages/core/src/resolve_references/import_resolution/import_resolution.python.ts` — Step 1a
- `packages/core/src/resolve_references/import_resolution/import_resolution.ts` — Step 1b
- `packages/core/src/project/import_graph.ts` — Step 1c
- `packages/core/src/resolve_references/name_resolution.ts` — Step 2
- `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts` — Step 3
- `packages/core/src/resolve_references/call_resolution/method_lookup.ts` — Step 4
- `packages/core/src/resolve_references/call_resolution/call_resolver.ts` — Step 5

## Existing Utilities to Reuse

- `has_file_in_tree` in `file_folders.ts:52` — already used in `import_resolution.python.ts`
- `resolve_module_path` dispatch pattern in `import_resolution.ts` — same pattern for new dispatch
- `resolve_namespace_method` in `method_lookup.ts:263` — looks up exports in a source file
- `resolve_import_path` callback pattern in `call_resolver.ts:220` — same pattern for new callback
- `ImportGraph.get_resolved_import_path` — existing pre-computed path cache as model
