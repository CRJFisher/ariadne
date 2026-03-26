# Ariadne Control Flow Detection: Requirements Document

## Motivation

Code Charter renders call graphs — function nodes connected by "calls" edges. A call graph says "function A calls function B." A flowchart says "if the user is premium, apply the discount; otherwise show the upgrade prompt." The gap between these two representations is **control flow context**: under what conditions does a call happen, in what order relative to other calls, and through which branches of the code.

Ariadne already parses source code with tree-sitter, builds scope trees, resolves symbol references, and produces call graphs. The scope tree already captures block scopes for every control flow construct (`if_statement`, `for_statement`, `while_statement`, `try_statement`, etc.). The infrastructure for tracking which calls occur inside which blocks **partially exists** — each `CallReference` carries a `scope_id` pointing to its immediate enclosing block scope. What is missing is the semantic annotation that makes this structural data usable: which kind of block is it, what is its condition, and which blocks are alternative branches of the same decision.

This document specifies the requirements for extending ariadne with control flow detection capabilities, organized into three tiers of increasing depth.

## Current State

### Scope Type System

`ScopeType` in `@ariadnejs/types` defines nine scope kinds. All control flow constructs — `if`, `for`, `while`, `try`, `catch`, `finally`, `switch`, `match`, `with`, comprehensions — map to a single generic `"block"` type. The scope tree preserves parent-child relationships and locations but carries no information about what kind of block a scope represents.

```typescript
// @ariadnejs/types/src/scopes.ts
type ScopeType =
  | "global"
  | "module"
  | "class"
  | "function"
  | "method"
  | "constructor"
  | "block" // ← every control flow construct
  | "parameter"
  | "local";
```

`BaseScopeNode` stores `id`, `parent_id`, `name`, `type`, `location`, and `child_ids`. Block scopes have `name: null` and `type: "block"`. No additional metadata.

### Tree-Sitter Queries

The `.scm` query files capture control flow constructs as `@scope.block`. The tree-sitter node type (the actual discriminant) is available on the captured node but is not preserved in the scope data.

**TypeScript** (`typescript.scm`):

```scheme
(for_statement) @scope.block
(for_in_statement) @scope.block
(while_statement) @scope.block
(do_statement) @scope.block
(if_statement) @scope.block
(switch_statement) @scope.block
(switch_case) @scope.block
(try_statement) @scope.block
(catch_clause) @scope.block
(finally_clause) @scope.block
```

**Python** (`python.scm`):

```scheme
(for_statement) @scope.block
(while_statement) @scope.block
(with_statement) @scope.block
(if_statement) @scope.block
(elif_clause) @scope.block
(else_clause) @scope.block
(try_statement) @scope.block
(except_clause) @scope.block
(finally_clause) @scope.block
(match_statement) @scope.block
(case_clause) @scope.block
(list_comprehension) @scope.block
(dictionary_comprehension) @scope.block
(set_comprehension) @scope.block
(generator_expression) @scope.block
```

**Rust** (`rust.scm`):

```scheme
(unsafe_block) @scope.block.unsafe
(async_block) @scope.block.async
(if_expression) @scope.block
(match_expression) @scope.block
(for_expression) @scope.block
(while_expression) @scope.block
(loop_expression) @scope.block
(match_arm) @scope.block
```

### Where Information Is Lost

In `@ariadnejs/core`, `process_scopes()` iterates tree-sitter captures and creates `LexicalScope` nodes. Each capture has a `category` and `entity` derived from the query name (e.g., `@scope.block` → category `SCOPE`, entity `"block"`). The function `map_capture_to_scope_type()` maps the entity to a `ScopeType`:

```typescript
// @ariadnejs/core scopes.ts — map_capture_to_scope_type()
case "block":
  return "block";  // ALL control flow becomes this
default:
  if (capture.category === SemanticCategory.SCOPE) {
    return "block";  // fallback: unknown scopes also become "block"
  }
```

At this point the tree-sitter node is still available as `capture.node`, which has:

- `.type` — the grammar node type (`"if_statement"`, `"for_statement"`, etc.)
- `.childForFieldName("condition")` — the condition expression node
- `.childForFieldName("consequence")` / `.childForFieldName("alternative")` — branch bodies
- `.childForFieldName("left")` / `.childForFieldName("right")` — loop variable and iterable
- `.childForFieldName("handler")` / `.childForFieldName("finalizer")` — try/catch/finally parts

None of this is extracted. The boundary extractor (`extract_block_boundaries()` in `boundary_base.ts`) converts the node to a `Location` and discards everything else.

### Call-to-Scope Attribution

Each `CallReference` carries a `scope_id` field set to the **immediate enclosing scope** — which may be a block scope inside a control flow construct. During call graph construction, `find_enclosing_function_scope()` walks up the scope tree from this block scope to the nearest function/method/constructor scope, and groups calls by that enclosing function. The block-level attribution is preserved on individual `CallReference` objects but is not surfaced in the `CallableNode` or `CallGraph` output.

```typescript
// @ariadnejs/types call_chains.ts — CallReference
interface CallReference {
  readonly location: Location;
  readonly name: SymbolName;
  readonly scope_id: ScopeId; // immediate block scope
  readonly call_type: "function" | "method" | "constructor";
  readonly resolutions: readonly Resolution[];
  readonly is_callback_invocation?: boolean;
}

// @ariadnejs/types call_chains.ts — CallableNode
interface CallableNode {
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly enclosed_calls: readonly CallReference[]; // flat list, no structure
  readonly location: Location;
  readonly definition: AnyDefinition;
  readonly is_test: boolean;
}
```

`CallableNode.enclosed_calls` is a flat list of all calls within a function body. The list preserves source order (calls are sorted by location), but there is no structural grouping — no way to tell from the data alone whether two calls are sequential, in opposite branches of an if/else, or nested inside a loop.

### What Already Works

The combination of `CallReference.scope_id` and the scope tree means that, given access to the scope tree, a consumer can already determine which block scope a call lives in. What is missing is:

1. **The scope tree does not say what KIND of block each scope is** — `"block"` is opaque.
2. **No condition text** — even if you know a scope is an if-block, you do not know what condition gates it.
3. **No sibling linkage** — if-then and if-else are separate child scopes under the same parent, but nothing marks them as branches of the same decision.
4. **No structured representation** — consumers must reconstruct the control flow structure themselves from the raw scope tree.

---

## Requirements

### Tier 1: Block Kind Annotation

**Goal**: Each block scope carries its control flow kind and, where applicable, its condition text and sibling branch links. This is the foundational data layer that all downstream analysis (CFG construction, flowchart rendering, LLM-powered summarization) builds on.

#### R1.1 — Block Kind Discriminant

Add a `block_kind` field to `LexicalScope` (or a parallel annotation type) that preserves the tree-sitter node type as a semantic discriminant.

**Required block kinds by language:**

| Block Kind        | TypeScript                                | Python                                                                                  | Rust                      | JavaScript                   |
| ----------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------- | ---------------------------- |
| `"if"`            | `if_statement`                            | `if_statement`                                                                          | `if_expression`           | `if_statement`               |
| `"else_if"`       | (chained `if_statement` in `alternative`) | `elif_clause`                                                                           | (chained `if_expression`) | (chained `if_statement`)     |
| `"else"`          | (statement_block in `alternative`)        | `else_clause`                                                                           | (block in `alternative`)  | (statement in `alternative`) |
| `"for"`           | `for_statement`                           | `for_statement`                                                                         | `for_expression`          | `for_statement`              |
| `"for_in"`        | `for_in_statement`                        | (covered by `for_statement`)                                                            | —                         | `for_in_statement`           |
| `"while"`         | `while_statement`                         | `while_statement`                                                                       | `while_expression`        | `while_statement`            |
| `"do_while"`      | `do_statement`                            | —                                                                                       | —                         | `do_statement`               |
| `"switch"`        | `switch_statement`                        | —                                                                                       | —                         | `switch_statement`           |
| `"switch_case"`   | `switch_case`                             | —                                                                                       | —                         | `switch_case`                |
| `"try"`           | `try_statement`                           | `try_statement`                                                                         | —                         | `try_statement`              |
| `"catch"`         | `catch_clause`                            | `except_clause`                                                                         | —                         | `catch_clause`               |
| `"finally"`       | `finally_clause`                          | `finally_clause`                                                                        | —                         | `finally_clause`             |
| `"match"`         | —                                         | `match_statement`                                                                       | `match_expression`        | —                            |
| `"match_arm"`     | —                                         | `case_clause`                                                                           | `match_arm`               | —                            |
| `"with"`          | —                                         | `with_statement`                                                                        | —                         | —                            |
| `"loop"`          | —                                         | —                                                                                       | `loop_expression`         | —                            |
| `"unsafe"`        | —                                         | —                                                                                       | `unsafe_block`            | —                            |
| `"async"`         | —                                         | —                                                                                       | `async_block`             | —                            |
| `"comprehension"` | —                                         | `list_comprehension`, `dict_comprehension`, `set_comprehension`, `generator_expression` | —                         | —                            |
| `"generic"`       | (fallback for unrecognized blocks)        | (fallback)                                                                              | (fallback)                | (fallback)                   |

The field is `null` for non-block scopes (function, class, module, etc.).

#### R1.2 — Condition Text Extraction

Add a `condition_text` field to block scopes that carries the source text of the governing expression.

**Extraction rules by block kind:**

| Block Kind                                   | Tree-sitter Field                                                         | Example Output                               |
| -------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `"if"`, `"else_if"`                          | `condition` (TS/JS/Rust) or `condition` (Python)                          | `"user.is_premium"`                          |
| `"while"`                                    | `condition`                                                               | `"retries < MAX_RETRIES"`                    |
| `"for"`                                      | Full initializer/condition/increment (TS/JS) or `left` + `right` (Python) | `"const item of items"` or `"item in items"` |
| `"for_in"`                                   | `left` + `right`                                                          | `"key in object"`                            |
| `"switch"`, `"match"`                        | `value` / `subject`                                                       | `"request.method"`                           |
| `"switch_case"`, `"match_arm"`               | `value` / `pattern`                                                       | `"'GET'"` or `"Some(value)"`                 |
| `"catch"`                                    | `parameter` (TS/JS) or exception type (Python)                            | `"error: ApiError"` or `"ValueError as e"`   |
| `"else"`, `"finally"`, `"loop"`, `"generic"` | —                                                                         | `null`                                       |

Condition text is truncated to a maximum length (128 characters) to prevent bloat from complex expressions. Truncated conditions end with `"…"`.

#### R1.3 — Sibling Branch Linkage

Add a `sibling_scope_ids` field that links block scopes that are alternative branches of the same control flow decision.

**Sibling groups:**

- `if` / `else_if` / `else` — all branches of the same if-chain are siblings of each other
- `try` / `catch` / `finally` — all parts of the same try-statement are siblings
- `switch_case` entries under the same `switch` — all cases are siblings
- `match_arm` entries under the same `match` — all arms are siblings

**Detection approach**: When processing an `if_statement` node, its `consequence` and `alternative` children produce child scopes. After scope creation, a post-processing pass inspects the tree-sitter parent of each block scope to find sibling scopes.

Sibling linkage enables consumers to determine that calls in an `if`-branch and calls in the corresponding `else`-branch are **alternatives** (one or the other executes), not sequential (both execute).

#### R1.4 — Backwards Compatibility

All new fields are optional/nullable:

- `block_kind: BlockKind | null` — null for non-block scopes
- `condition_text: string | null` — null when no condition applies
- `sibling_scope_ids: readonly ScopeId[]` — empty array when no siblings

Existing consumers that read only `type`, `location`, `parent_id`, `child_ids`, and `name` are unaffected.

The `ScopeId` format (`"type:file:line:col:end_line:end_col"`) does not change. Block scopes continue to use `"block"` as their scope type in the ID string. `block_kind` is metadata on the scope node, not part of the identity.

#### R1.5 — Language Coverage

- **Phase 1**: TypeScript and JavaScript (shared grammar, nearly identical node types)
- **Phase 2**: Python (different node types for elif/else/except, comprehensions)
- **Phase 3**: Rust (expressions not statements, match arms, unsafe/async blocks)

Each language needs a mapping from its tree-sitter node types to the `BlockKind` discriminant.

#### R1.6 — Acceptance Criteria

- [ ] For a TypeScript function containing `if (x) { a() } else { b() }`, the scope tree has two child block scopes under the function: one with `block_kind: "if"`, `condition_text: "x"`, and one with `block_kind: "else"`, `condition_text: null`. Both have each other's ID in `sibling_scope_ids`.
- [ ] For a Python `for item in items: process(item)`, the block scope has `block_kind: "for"` and `condition_text: "item in items"`.
- [ ] For a TypeScript `try { a() } catch (e) { b() } finally { c() }`, three sibling block scopes exist: `block_kind: "try"`, `block_kind: "catch"` with `condition_text: "e"`, and `block_kind: "finally"`.
- [ ] For a Python `match value:` with three `case` clauses, three sibling block scopes exist with `block_kind: "match_arm"` and respective `condition_text` values.
- [ ] Existing tests pass without modification. New fields default to null/empty.
- [ ] `CallReference.scope_id` continues to point to the immediate block scope, which now carries `block_kind`.

---

### Tier 2: Intra-Function Control Flow Graph

**Goal**: Provide a structured representation of control flow within each function, grouping calls into basic blocks connected by typed edges. This enables flowchart rendering without requiring consumers to manually reconstruct control flow from the raw scope tree.

#### R2.1 — Basic Block

A basic block is a maximal sequence of calls within the same scope with no branching between them. Calls are ordered by source position.

```typescript
interface BasicBlock {
  readonly id: string;
  readonly scope_id: ScopeId;
  readonly calls: readonly CallReference[];
  readonly location: Location; // spans from first to last call in block
}
```

A basic block may have zero calls (representing an empty branch) — this preserves the structural shape of the control flow even when branches contain no function calls.

#### R2.2 — Control Flow Edge

Edges connect basic blocks and carry semantic type and optional label.

```typescript
type CfgEdgeKind =
  | "sequential" // normal fall-through
  | "conditional" // branch based on condition (if/switch/match)
  | "loop_entry" // enter a loop body
  | "loop_back" // loop iteration back-edge
  | "exception" // enter catch/finally from try
  | "fallthrough"; // switch case fallthrough

interface CfgEdge {
  readonly source_block_id: string;
  readonly target_block_id: string;
  readonly kind: CfgEdgeKind;
  readonly label: string | null; // condition text for conditional edges
}
```

#### R2.3 — Intra-Function CFG

One CFG per function/method/constructor, derived from the scope tree annotated in Tier 1.

```typescript
interface IntraFunctionCfg {
  readonly function_id: SymbolId;
  readonly entry_block_id: string;
  readonly exit_block_ids: readonly string[];
  readonly blocks: ReadonlyMap<string, BasicBlock>;
  readonly edges: readonly CfgEdge[];
}
```

#### R2.4 — Construction Algorithm

The CFG is derived from existing data (no new parsing required), using:

1. `CallableNode.enclosed_calls` — the flat list of calls
2. `CallReference.scope_id` — immediate block scope of each call
3. The scope tree with Tier 1 annotations — `block_kind`, `condition_text`, `sibling_scope_ids`

**Algorithm outline**:

1. Group `enclosed_calls` by their immediate `scope_id`
2. Sort calls within each scope by source position
3. For each scope, create a basic block containing its calls
4. Create edges based on scope tree structure:
   - Calls in the same scope at sequential positions → `sequential` edge (or grouped into a single basic block)
   - Scopes that are children of the function body scope → entered sequentially in source order
   - Sibling scopes (from `sibling_scope_ids`) → `conditional` edges from a decision point
   - Loop scopes → `loop_entry` from predecessor, `loop_back` from end of loop body to loop header
   - Try/catch → `exception` edge from try-block to catch-block

#### R2.5 — Attachment to CallableNode

The CFG is an optional field on `CallableNode`:

```typescript
interface CallableNode {
  // ... existing fields ...
  readonly cfg?: IntraFunctionCfg;
}
```

Functions with no block scopes (single straight-line execution) have `cfg: undefined`. The flat `enclosed_calls` list remains as-is for backwards compatibility.

#### R2.6 — Acceptance Criteria

- [ ] For a function `function f() { a(); if (x) { b() } else { c() }; d() }`, the CFG contains 4 basic blocks: `[a()]`, `[b()]`, `[c()]`, `[d()]`, connected by: `[a()] → conditional("x") → [b()]`, `[a()] → conditional("!x") → [c()]`, `[b()] → sequential → [d()]`, `[c()] → sequential → [d()]`.
- [ ] For a function with a for-loop containing calls, the CFG has a `loop_entry` edge into the loop body and a `loop_back` edge from the end of the body to the loop header.
- [ ] For a function with `try { a() } catch { b() }`, the CFG has an `exception` edge from the try-block to the catch-block.
- [ ] Functions with no block scopes (only sequential calls) have `cfg: undefined`.
- [ ] The CFG handles nested control flow (if inside a for, try inside an if, etc.).
- [ ] Early returns are represented as edges to an exit block.

---

### Tier 3: Data Flow Annotations

**Goal**: Track what data flows between function calls — which arguments are passed, what return values are used. This enables edge labels like "passes user object" and data-flow-aware visualization.

#### R3.1 — Argument Text Extraction

Capture the source text of individual arguments at each call site.

```typescript
interface CallReference {
  // ... existing fields ...
  readonly argument_texts?: readonly string[];
}
```

Argument texts are extracted from the tree-sitter `arguments` node's children, truncated to 80 characters each.

**Implementation note**: This requires capturing argument nodes during reference processing in the indexing phase (not during call resolution, when tree-sitter nodes are no longer available). The `FunctionCallReference`, `MethodCallReference`, and `ConstructorCallReference` variants in `SymbolReference` carry the data through to `CallReference` construction.

#### R3.2 — Return Value Usage

Track how the return value of each call is used by inspecting the parent node of the call expression.

```typescript
type ReturnValueUsage =
  | { kind: "assigned"; variable_name: SymbolName }
  | {
      kind: "passed_as_argument";
      to_call_location: Location;
      argument_index: number;
    }
  | { kind: "returned" }
  | { kind: "condition" } // used in if/while condition
  | { kind: "chained" } // method chaining: a().b()
  | { kind: "discarded" }; // return value unused
```

#### R3.3 — Parameter-to-Argument Mapping

Given argument texts (R3.1) and the callee's `FunctionDefinition.signature.parameters`, positional mapping produces:

```typescript
interface ArgumentParameterMapping {
  readonly argument_index: number;
  readonly argument_text: string;
  readonly parameter_name?: SymbolName;
  readonly parameter_type?: SymbolName;
}
```

This enables edge labels like "user: User" or "order_id: string" showing what data flows along each call edge.

#### R3.4 — Acceptance Criteria

- [ ] For `process(user.id, cart.items)` calling `function process(user_id: string, items: Item[])`, `argument_texts` is `["user.id", "cart.items"]` and parameter mapping produces `[{arg: 0, text: "user.id", param: "user_id"}, {arg: 1, text: "cart.items", param: "items"}]`.
- [ ] For `const result = fetch_data()`, return value usage is `{ kind: "assigned", variable_name: "result" }`.
- [ ] For `if (validate(input))`, return value usage is `{ kind: "condition" }`.
- [ ] For `process(fetch_data())`, the inner call's return value usage is `{ kind: "passed_as_argument", to_call_location: ..., argument_index: 0 }`.

---

## Implementation Guidance

### Pipeline Integration Points

Ariadne's indexing pipeline processes files in this order:

1. **Parse** (tree-sitter) → `Parser.Tree`
2. **Query** (tree-sitter `.scm`) → `CaptureNode[]`
3. **Scopes** → `ScopeTree` ← **Tier 1 changes here**
4. **Definitions** → functions, classes, variables
5. **References** → `SymbolReference[]` ← **Tier 3 argument extraction here**
6. **Name resolution** → scope-based symbol lookup
7. **Call resolution** → `CallReference[]`
8. **Call graph** → `CallGraph` ← **Tier 2 CFG construction here**

### Files Affected

**Tier 1 (types)**:

- `@ariadnejs/types/src/scopes.ts` — add `BlockKind` type, add fields to `BaseScopeNode` or create a parallel `ControlFlowAnnotation` map

**Tier 1 (core)**:

- `@ariadnejs/core/src/index_single_file/scopes/scopes.ts` — modify `map_capture_to_scope_type()` (or add a parallel extraction), modify `process_scopes()` to populate new fields, add sibling detection post-processing pass
- `@ariadnejs/core/src/index_single_file/scopes/boundary_base.ts` — extend `extract_block_boundaries()` to capture condition text from tree-sitter field nodes

**Tier 2 (types)**:

- `@ariadnejs/types/src/call_chains.ts` — add `IntraFunctionCfg`, `BasicBlock`, `CfgEdge` types; add optional `cfg` field to `CallableNode`

**Tier 2 (core)**:

- New module: `@ariadnejs/core/src/trace_call_graph/build_intra_function_cfg.ts` — CFG construction from scope tree + enclosed_calls
- `@ariadnejs/core/src/trace_call_graph/trace_call_graph.ts` — call `build_intra_function_cfg()` during `build_function_nodes()` and attach result to `CallableNode`

**Tier 3 (types)**:

- `@ariadnejs/types/src/call_chains.ts` — add `argument_texts` to `CallReference`
- `@ariadnejs/types/src/symbol_references.ts` — add `argument_texts` to call reference variants

**Tier 3 (core)**:

- `@ariadnejs/core/src/index_single_file/references/references.ts` — extract argument node texts during reference processing
- `@ariadnejs/core/src/resolve_references/call_resolution/call_resolver.ts` — carry argument_texts from `SymbolReference` through to `CallReference`

### Performance Considerations

- **Tier 1**: Negligible overhead. Reads one additional field from already-captured tree-sitter nodes during scope processing. Per-file, incremental.
- **Tier 2**: O(n) in the number of calls per function. Computed during call graph construction. Can be made lazy (only computed when requested).
- **Tier 3**: One additional tree-sitter child traversal per call site during reference capture. Marginal cost.

All changes are per-file or per-function. No whole-program analysis is required. This aligns with ariadne's incremental `update_file()` architecture.

### Scope ID Stability

The `ScopeId` format uses `"block"` as the type component for all block scopes. This does **not** change. The new `block_kind` is metadata on the scope node, not part of the scope identity string. This ensures:

- Scope IDs remain stable across the change
- Scope lookups by ID continue to work
- Serialized scope IDs (e.g., in `CallReference.scope_id`) remain valid

### No Tree-Sitter Query Changes Required

The existing `.scm` queries already capture all necessary control flow nodes. The block kind and condition information are extracted from the tree-sitter `SyntaxNode` object (available as `capture.node` during scope processing), not from new query captures. This minimizes the surface area of changes.
