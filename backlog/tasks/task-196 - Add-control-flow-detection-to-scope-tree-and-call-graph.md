---
id: TASK-196
title: Add control flow detection to scope tree and call graph
status: To Do
assignee: []
created_date: "2026-03-26 11:25"
updated_date: "2026-03-26 11:30"
labels:
  - feature
  - control-flow
  - code-charter
dependencies: []
documentation:
  - backlog/drafts/ariadne-control-flow-detection-requirements.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Ariadne parses source code and produces call graphs (function A calls function B). Code Charter wants to render flowcharts that show _under what conditions_ calls happen, in what order, and through which branches. The gap is **control flow context**.

Ariadne already captures block scopes for every control flow construct (if, for, while, try, etc.) via tree-sitter queries. Each `CallReference` carries a `scope_id` pointing to its immediate block scope. What is missing is the semantic annotation that makes this structural data usable: which _kind_ of block is it, what is its condition, and which blocks are alternative branches of the same decision.

This epic adds control flow detection in three tiers:

**Tier 1 — Block Kind Annotation**: Each block scope carries its control flow kind (`if`, `for`, `while`, `try`, `catch`, `match`, etc.), condition text (`"x > 0"`), and sibling branch links (if/else are alternatives, not sequential).

**Tier 2 — Intra-Function CFG**: A structured control flow graph per function, grouping calls into basic blocks connected by typed edges (sequential, conditional, loop_entry, loop_back, exception).

**Tier 3 — Data Flow Annotations**: Argument text extraction at call sites, return value usage tracking (assigned/passed/returned/condition/chained/discarded), and parameter-to-argument mapping.

### Where Information Is Currently Lost

In `process_scopes()`, `map_capture_to_scope_type()` maps ALL block entities to ScopeType `"block"`. The tree-sitter node (which has `.type` like `"if_statement"`, `.childForFieldName("condition")`, etc.) is available but discarded after `extract_block_boundaries()` converts it to a bare `Location`.

### Pipeline Integration Points

1. **Tier 1** changes step 1 (per-file indexing → scope processing)
2. **Tier 2** adds a new module in step 3 (call graph construction)
3. **Tier 3** changes step 1 (reference processing) and step 2 (call resolution)

Tiers 1 and 3 are independent and can be implemented in parallel. Tier 2 depends on Tier 1.

### Key Design Constraints

- `ScopeId` format (`"block:file:line:col:end_line:end_col"`) does NOT change — `block_kind` is metadata, not identity
- No tree-sitter query changes required — all info is extracted from `capture.node` during scope processing
- All new fields are optional — backwards compatible
- Per-file, incremental — compatible with `update_file()` architecture
- NO backwards compatibility shims — just change the code (per project constitution)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 For a TypeScript function containing `if (x) { a() } else { b() }`, the scope tree has block scopes with `block_kind: "if"` and `block_kind: "else"`, with condition_text and sibling_scope_ids correctly populated
- [ ] #2 For a Python `for item in items: process(item)`, the block scope has `block_kind: "for"` and `condition_text: "item in items"`
- [ ] #3 For a TypeScript `try { a() } catch (e) { b() } finally { c() }`, three sibling block scopes exist with correct block_kind values
- [ ] #4 For a Python `match value:` with three case clauses, three sibling match_arm scopes exist
- [ ] #5 Intra-function CFG is produced for functions with control flow: basic blocks connected by typed edges (sequential, conditional, loop_entry, loop_back, exception)
- [ ] #6 For `function f() { a(); if (x) { b() } else { c() }; d() }`, the CFG has 4 basic blocks with conditional edges from a() to b()/c() and sequential edges to d()
- [ ] #7 Argument texts are extracted at call sites: `process(user.id, cart.items)` produces `argument_texts: ["user.id", "cart.items"]`
- [ ] #8 Return value usage is detected: `const result = fetch()` → assigned, `if (validate())` → condition, `foo();` → discarded
- [ ] #9 Parameter-to-argument mapping works across files using resolved callee definitions
- [ ] #10 All four languages supported: TypeScript, JavaScript, Python, Rust
- [ ] #11 Existing tests pass — new fields default to null/empty
- [ ] #12 CallReference.scope_id continues to point to the immediate block scope, which now carries block_kind
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

## Implementation Plan

### Dependency Graph

```
196.1 (T1 types) ───────────┬──────────── 196.5 (T2 types)
       │                     │                    │
       ▼                     │                    │
196.2 (T1 block_kind)       │                    │
       │                     │                    │
       ▼                     │                    ▼
196.3 (T1 siblings) ────────┼────────────► 196.6 (T2 build_cfg)
       │                     │                    │
       ▼                     │                    ▼
196.4 (T1 tests)            │             196.7 (T2 tests)
                             │
196.8 (T3 types) ◄──────────┘ (independent of T1)
       │
       ▼
196.9 (T3 extraction)
       │
       ▼
196.10 (T3 tests)
```

**Tier 1 and Tier 3 are independent** — can be implemented in parallel.
**Tier 2 depends on Tier 1** — needs annotated scope tree.

### Phasing (5 phases, ~9 PRs)

**Phase A — Type foundations (parallel):**

- PR 1: task-196.1 (BlockKind type, LexicalScope extension)
- PR 2: task-196.8 (argument_texts, ReturnValueUsage types)
- PR 3: task-196.5 (CFG types, CallableNode.cfg)

**Phase B — Core extraction (parallel, after Phase A):**

- PR 4: task-196.2 + task-196.3 (block_kind population + sibling linkage)
- PR 5: task-196.9 (argument text + return value extraction)

**Phase C — Tier 1 testing (after PR 4):**

- PR 6: task-196.4 (Tier 1 tests, fixtures, existing test updates)

**Phase D — CFG construction (after PR 4):**

- PR 7: task-196.6 + task-196.7 (CFG builder + tests)

**Phase E — Tier 3 testing (after PR 5):**

- PR 8: task-196.10 (Tier 3 tests)

### Known Limitations (accepted for this epic)

1. **TS/JS else blocks are NOT separate scopes** — calls in else get the parent if_statement scope. Requires query changes to fix.
2. **Ternary expressions** not block scopes — both branches share scope_id.
3. **Short-circuit evaluation** (foo() && bar()) — bar() conditional but not in separate scope.
4. **Switch fall-through** — treated as independent branches.
5. **Early returns** — not explicitly modeled in CFG. Overapproximates reachability (sound).

### Risk Mitigation

- Run full test suite before/after each tier (baseline: ~5700 passing tests)
- Make all new fields optional to minimize test update surface
- Regenerate JSON fixtures via `npm run generate-fixtures -- --all`
- Pin Rust tree-sitter grammar version exactly (currently ^0.21.0)

### Files Affected Summary

**Types (packages/types/src/):**

- scopes.ts — BlockKind type, BaseScopeNode extension
- index_single_file.ts — LexicalScope extension
- call_chains.ts — CFG types, CallableNode.cfg, CallReference extensions, ReturnValueUsage, ArgumentParameterMapping
- symbol_references.ts — argument_texts/return_value_usage on call variants

**Core (packages/core/src/):**

- index_single_file/scopes/boundary_base.ts — ScopeBoundaries extension, truncate helper
- index_single_file/scopes/extractors/\*.ts — per-language block_kind mapping + condition extraction
- index_single_file/scopes/scopes.ts — process_scopes() threading, link_sibling_scopes()
- index_single_file/references/references.ts — argument text + return value extraction
- index_single_file/references/factories.ts — factory function extensions
- index_single_file/query_code_tree/metadata_extractors/\*.ts — new extractor methods
- resolve_references/call_resolution/call_resolver.ts — propagation + parameter mapping
- trace_call_graph/build_cfg.ts — NEW: CFG construction
- trace_call_graph/trace_call_graph.ts — ScopeRegistry param, cfg attachment
- project/project.ts — pass scopes to trace_call_graph

**Tests (~165 new tests + ~80 existing test updates):**

- scopes/block_kind.test.ts — NEW (~79 unit tests)
- scopes/block_kind.integration.test.ts — NEW (~19 integration tests)
- trace_call_graph/build_cfg.test.ts — NEW (~32 unit tests)
- trace_call_graph/build_cfg.integration.test.ts — NEW (~6 integration tests)
- metadata_extractors/\*.test.ts — extensions (~22 tests)
- call_resolver.test.ts — extensions (~8 tests)
- project.integration.test.ts — extensions (~10 tests)
- ~60-80 existing tests updated with new LexicalScope fields
- 85 JSON fixture files regenerated
<!-- SECTION:PLAN:END -->
