---
id: task-180
title: Investigate remaining instance-method-resolution false positives (10 entries)
status: To Do
assignee: []
created_date: "2026-02-10 20:22"
labels:
  - bug
  - call-graph
dependencies: []
priority: medium
---

## Description

The Feb 2026 re-analysis shows 10 instance-attribute-method-resolution false positives. Two independent bugs prevent Python `self.attr.method()` call chains from resolving:

1. **Instance attributes not captured as property definitions**: `self.attr = X()` in `__init__` produces `@reference.write` only, not a property definition. The class member_index never contains these attributes, so `walk_property_chain()` fails.
2. **`extract_receiver_info` doesn't handle nested attribute chains**: For `self.db.query()`, the Python metadata extractor produces `property_chain: ["self.db", "query"]` (flat string) instead of `["self", "db", "query"]` (parsed chain). The JavaScript extractor already handles this correctly by delegating to `extract_property_chain`.

Both bugs must be fixed together — neither alone resolves any false positive.

### False Positive Inventory

| Category | Count | Pattern                                       | Examples                                                                 |
| -------- | ----- | --------------------------------------------- | ------------------------------------------------------------------------ |
| A        | 6     | `self.attr = Constructor()` in `__init__`     | `self.rest_client.GET/HEAD/OPTIONS/DELETE/POST/PATCH`                    |
| B        | 3     | Factory function return, no type annotation   | `qbc = _get_pyqb_client(); qbc.authenticate/importfromcsv/purge_records` |
| C        | 1     | Constructor parameter `Type[X]` instantiation | `uploader_class(profile).upload_to_qb()`                                 |

Phase 1 addresses Category A (6 entries). Categories B and C require separate tasks (return type inference and generic type support respectively).

Evidence: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json`

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Root cause of remaining 10 instance-method false positives identified
- [ ] #2 `extract_receiver_info` handles nested attribute chains (delegates to `extract_property_chain` like JavaScript)
- [ ] #3 `self.attr = X()` in `__init__` creates PropertyDefinition on the containing class via `assignment.property` handler
- [ ] #4 Unit tests for `extract_receiver_info` nested chains in `metadata_extractors.python.test.ts`
- [ ] #5 Unit tests for instance field handler in `capture_handlers.python.test.ts`
- [ ] #6 Split `receiver_resolution.integration.test.ts` into language-specific submodules
- [ ] #7 Integration test in `receiver_resolution.integration.python.test.ts` verifying full `self.attr.method()` call resolution
- [ ] #8 Follow-up tasks created for Category B (factory return types) and Category C (Type[X] generics)
<!-- AC:END -->

## Implementation Plan

### Fix 1: `extract_receiver_info` nested attribute chains (Break Point 2)

**File**: `packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.python.ts`

For nested attributes where `object_node` is an `attribute` (not `identifier`), delegate to `extract_property_chain` to get the full chain, then check if `chain[0]` is a self-reference keyword (`self`/`cls`/`super`). This matches the pattern already used in the JavaScript extractor (`metadata_extractors.javascript.ts` line 361).

### Fix 2: Instance attribute property definitions (Break Point 1)

The existing `@assignment.property` capture (`python.scm` line 766) already fires for `self.attr = X()` but has no handler. Add a handler in `capture_handlers.python.ts` for the `assignment.property` capture that:

1. Checks if the assignment target is `self.X` (object is `self` identifier)
2. Checks if we're inside `__init__` of a class (via `find_containing_class`)
3. Calls `builder.add_property_to_class(class_id, ...)` to create the PropertyDefinition

This follows the "builder extraction" principle from CAPTURE-SCHEMA.md — the query already captures the AST node, the handler extracts semantic meaning. No new tree-sitter query needed.

### Files to Change

| File                                                   | Change                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `metadata_extractors.python.ts`                        | Fix `extract_receiver_info` to delegate to `extract_property_chain` for nested attributes |
| `capture_handlers.python.ts`                           | Add `assignment.property` handler + register in `PYTHON_HANDLERS`                         |
| `metadata_extractors.python.test.ts`                   | Unit tests for nested chain extraction                                                    |
| `capture_handlers.python.test.ts`                      | Unit tests for instance field PropertyDefinition creation                                 |
| `receiver_resolution.integration.test.ts`              | Extract shared helpers; keep as parent for language-specific submodules                    |
| `receiver_resolution.integration.python.test.ts`       | Python tests extracted from parent + new `self.attr.method()` integration tests           |
| `receiver_resolution.integration.typescript.test.ts`   | TypeScript tests extracted from parent (this.method, super.method, edge cases)            |
| `receiver_resolution.integration.javascript.test.ts`   | JavaScript tests extracted from parent (this.method, polymorphic this)                    |
| `receiver_resolution.integration.rust.test.ts`         | Rust tests extracted from parent (self.method)                                            |
| `index_single_file.python.test.ts`                     | Test that `self.attr = Constructor()` produces PropertyDefinition on the class            |

### Step 0: Split integration tests into language-specific submodules

`receiver_resolution.integration.test.ts` (1002 lines) mixes TypeScript, Python, JavaScript, and Rust tests in a single file. Per the `{module}.{language}.test.ts` convention (and matching `callable_instance.python.test.ts` in the same directory):

1. Extract shared test helpers (temp dir setup, project builder, etc.) into `receiver_resolution.integration.test.ts` as the parent module
2. Move `describe("TypeScript - ...")` blocks → `receiver_resolution.integration.typescript.test.ts`
3. Move `describe("Python - ...")` blocks → `receiver_resolution.integration.python.test.ts`
4. Move `describe("JavaScript - ...")` blocks → `receiver_resolution.integration.javascript.test.ts`
5. Move `describe("Rust - ...")` blocks → `receiver_resolution.integration.rust.test.ts`
6. Move cross-language `describe("Polymorphic ...")` sub-blocks into respective language files

This enables adding new Python `self.attr.method()` tests without further bloating the file.

### Test Cases

**`metadata_extractors.python.test.ts`:**

- `self.db.query()` → `property_chain: ["self", "db", "query"], is_self_reference: true`
- `self.a.b.c()` → `property_chain: ["self", "a", "b", "c"], is_self_reference: true`
- `cls.factory.create()` → `property_chain: ["cls", "factory", "create"], is_self_reference: true`
- `obj.attr.method()` → correct chain with `is_self_reference: false`

**`capture_handlers.python.test.ts`:**

- `self.attr = Constructor()` inside `__init__` → PropertyDefinition with `name: "attr"` on class
- `self.attr = value` inside `__init__` → PropertyDefinition (no type) on class
- `self.attr = X()` outside `__init__` → no PropertyDefinition created (scoped to `__init__` only)

**`receiver_resolution.integration.python.test.ts`:**

- `self.db = Database()` in `__init__`, `self.db.query()` in another method → `Database.query` resolved in call graph

### Design Decisions

- **Reuse existing `@assignment.property` capture** rather than adding a new `@definition.instance_field` query. The capture already fires for `self.attr = X()`. This avoids duplicate captures and deep tree-sitter nesting.
- **Scope to `__init__` only** for Phase 1. Python allows instance attribute creation in any method, but convention is `__init__`. This covers all 6 Category A false positives.
- **Capture ALL `self.attr = value` patterns in `__init__`**, not just constructor calls. The property needs to exist in the member_index regardless of RHS type. Type inference is a separate concern handled by constructor bindings.
- **Python-only changes**. TypeScript/JavaScript don't need equivalent changes because they have explicit class field syntax. All changes are in language-specific files.
- **No changes to `receiver_resolution.ts`**. The resolution layer is language-agnostic and already works correctly when the member_index is populated and property chains are correct.
