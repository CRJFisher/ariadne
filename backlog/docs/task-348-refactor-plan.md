# TASK-348 — Phase-1 Name Resolution: Bind Every In-Scope and Intra-Module Name Without a Textual Import-Binding Gap

> Large-scale refactoring plan. Produced by a multi-agent design workflow (6 code-grounded investigators → 3 independent architects → judge → synthesis). Winning structure: **layered in-place rewrite of `resolve_scope_recursive`** (soundness 10/10, coverage 9/10).

## 1. Structural Thesis

**Every one of the 104 confirmed false-positive members fails for the same reason: a bare `SymbolName` that the lexical scope-walk can reach never lands as a key in the caller scope's resolution map.** Phase-2 resolution then does `resolve(scope_id, name)` (`resolution_state.ts:121-127`), gets `null`, records `resolution_count = 0`, and the definition is mislabelled unreachable.

The Phase-2 consumers are **already correctly wired** — they are starved of bindings, not broken:

- `receiver_resolution.ts` already treats a `class`/`interface`/`enum`/`type`/`type_alias` definition as its own type;
- `constructor.ts` already resolves `Type::new`'s leading segment via `resolutions.resolve(scope_id, ...)`;
- `method_lookup.ts` already walks `member_index` for the terminal member;
- `function_call.ts` already does a bare-name lookup.

Therefore the **single durable structural change is to widen what `resolve_scope_recursive` lands in the per-scope map, while keeping the map's value-shape `Map<ScopeId, Map<SymbolName, SymbolId>>` byte-for-byte unchanged so that zero Phase-2 consumers change.**

Concretely, `resolve_scope_recursive` is rewritten in place from its current 2-step "imports-then-locals-clobber-everything" build into **explicit ordered binding layers** over one shared per-scope map, governed by a single documented precedence contract:

> **A name resolves iff its anchor segment is in scope, and module-visible names are always in scope of their descendants.**

The layers:

| Layer                                  | Binds                                                                                                                                                       | Serves                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **L0** parent inherit                  | `new Map(parent_resolutions)` (unchanged)                                                                                                                   | baseline                                   |
| **L1** module/type-visible hoist       | descendant defs whose language visibility is module-wide, seeded **at file-root scope only**                                                                | 348.1.3 sibling-scope; anchors for 348.1.1 |
| **L2** imports                         | current Step 1 + a **definition-backed fallback** when `resolve_export_chain` returns null; records which names were import-bound this scope                | 348.1.2 import binding                     |
| **L3** qualified-path-terminal members | for each in-scope type/module/alias, bind its `member_index` terminals (`new`, `setup`, associated fns) under their bare terminal name if not already bound | 348.1.1 terminal binding                   |
| **L4** local defs                      | current Step 2, but **non-clobbering of import bindings** for the same-statement self-referential case                                                      | 348.1.2 shadowing                          |

One thing this Phase-1 widening **cannot** reach: the Rust `Type::assoc_fn()` / `module::fn()` subset of 348.1.1 ("Mode B"), whose leading qualifier is **destroyed at index time** before any reference reaches Phase-1. That subset requires one index-side change to _preserve_ the qualifier — after which it rides the exact same L1+L3 binding through the existing `MethodCallReference.property_chain` path. Two further genuinely-separate point fixes (Rust `r#` raw-identifier path normalization; JS `this.cleanup = function(){}` member-assignment attachment) are tracked as named sub-items, not folded into the layered structure.

**Net placement: ~5 changes are Phase-1 / supporting-registry, 1 is index-side data-preservation, 0 are Phase-2 logic.**

---

## 2. Current Architecture (file:line grounded)

### Phase-1 binding mechanism — `resolve_scope_recursive`

`packages/core/src/resolve_references/name_resolution.ts:128-224`. Per scope it:

- **L0** copies the parent map: `const scope_resolutions = new Map(parent_resolutions);` (`:138`).
- **Step 1 / imports** (`:140-189`): for each `imp_def` from `get_scope_imports(scope_id)`, `namespace` binds to the import's own `symbol_id` (`:148`); `named`/`default` calls `get_resolved_import_path(imp_def.symbol_id)` (`:152`) then `resolve_export_chain(source_file, import_name, ...)` (`:166`). On null, a **submodule fallback** (`:177-184`) binds `imp_def.symbol_id` — **the import node itself, not the target def** — when `get_submodule_import_path` hits. Success: `scope_resolutions.set(imp_def.name, resolved)` (`:187`), keyed on the **bare local name**.
- **Step 2 / local defs** (`:191-196`): `get_scope_definitions(scope_id)` returns a complete name→symbol_id map, and **every** entry is `scope_resolutions.set(name, symbol_id)` (`:195`) — **unconditionally overriding imports and parent bindings**, with no position information.
- **Step 3** stores the map (`:199`).
- **Step 4 / recurse** (`:202-221`): passes `scope_resolutions` **down** to each child (`:208`); child results merge back. **Flow is strictly parent→child; siblings never share bindings.** `LexicalScope` has no sibling pointers.

### Consumption (read-only, bare-name)

`resolve(state, scope_id, name)` is an O(1) `resolutions_by_scope.get(scope_id)?.get(name) ?? null` (`resolution_state.ts:121-127`). There is **no scope-walk at query time** — visibility is entirely what Phase-1 flattened into `ref.scope_id`. Phase-2 consumers:

- `function_call.ts:39` — `resolve(scope_id, ref.name)` on the bare terminal.
- `constructor.ts:57` (namespace path, length>1 → `property_chain[0]`) / `:71` (simple path → `call_ref.name`).
- `receiver_resolution.ts:227` resolves the leading segment via `resolutions.resolve(scope_id, identifier)`; `:262-267` treats a class/type def as its own type. `method_lookup.ts:131-148` looks up the terminal in `member_index`.

### Definition→scope attachment & registry

- `DefinitionRegistry.update_file` builds `by_scope: Map<ScopeId, Map<name, symbol_id>>` keyed on `defining_scope_id`, **excluding `kind==='import'`** (`definition.ts:117-130`, esp. `:121`) — so imports never clobber resolved imports. `get_scope_definitions(scope_id)` returns one scope's flat map (`:316-318`); `get_member_index()` (`:302`) maps type→member→symbol.
- Scope tree is **positional**: `process_scopes` attaches via `find_containing_scope` (smallest containing area) (`scopes.ts:122-253, 365-391`); a def's `defining_scope_id = get_scope_id(name_location)` = deepest containing scope (`:275-303`). Because boundary extractors start the scope at the params/body and **exclude the name** (`boundary_base.ts:150-174`), a `fn`/`function`/`const x = () =>` name lands in the **enclosing** scope. Rust impl bodies → `@scope.block`, inline mods → `@scope.module` (`rust.scm:45-52`), so impl/`cfg(test)`-mod members attach to a **child** scope of file-root — invisible to sibling impl blocks under downward-only flow.

### Reference data model (the qualifier-loss site)

`SymbolReference` is a discriminated union (`packages/types/src/symbol_references.ts:16-24`). `MethodCallReference` (`:94-112`), `SelfReferenceCall`, `PropertyAccessReference` carry `property_chain: readonly SymbolName[]`; `ConstructorCallReference` carries optional `property_chain?` (`:156-162`). **`FunctionCallReference` (`:129-133`) carries no chain field at all.**

- TS class-static `LanguageServiceTestEnv.setup()` → `member_expression` → JS `is_method_call=true` → `MethodCallReference` with `property_chain=['LanguageServiceTestEnv','setup']`. Qualifier **survives** (just unused by Phase-1).
- Rust `Type::new()` → captured as `@reference.constructor.associated` (`rust.scm:662-669`) → `ConstructorCallReference`.
- Rust `Type::assoc_fn()` / `module::fn()` → `scoped_identifier` → Rust `is_method_call=false` for scoped_identifier (`metadata_extractors.rust.ts:725-754`) → `FunctionCallReference`. `extract_call_name` (`:801-806`) returns **only the terminal** `name`; the leading segment is **discarded** — it survives nowhere on the persisted reference. The splitter `extract_property_chain` (`:292-366`) already splits scoped_identifier on `::` and pushes all segments — it is simply not invoked on this path.

### Import resolution roots (348.1.2)

- `resolve_export_chain` (`export.ts:319-386`) reads `ExportRegistry`, populated strictly from `is_exported` defs: `add_to_registry` gates `if (!def.is_exported) return` (`export.ts:81-92`). Rust `is_exported = has_pub_modifier` (`symbol_factories.rust.ts:205-214`). **A module-private `fn` legally `use`d intra-crate is absent from the registry**, so `resolve_export_chain` returns null. Confirmed repro: `de exports: []` for plain `fn has_flatten`, `["…has_flatten"]` for `pub(crate) fn has_flatten`.
- `use crate::r#type::parse`: `resolve_rust_module_path` (`import_resolution.rust.ts:139-175`) joins `crate::r#type` → `src/r#type.rs`, a non-existent file (real: `src/type.rs`). No `r#` stripping in `extract_scoped_path` (`imports.rust.ts:22-45`) or path resolution.
- serde `let has_flatten = has_flatten(fields)`: Step 1 binds the `use crate::de::has_flatten` import (`:187`), then Step 2 (`:195`) clobbers it with the local `let`. The RHS reference (lexically before the binding) resolves to the not-yet-initialized local.

### Classifier surface (348.1.4)

`PredicateExpr` is a closed serializable DSL (`known_issues.ts:122-149`), evaluated exhaustively in `predicate_evaluator.ts:29-119`. `resolution_failure_reason_eq` (`:68-71`) compares `ResolutionFailure.reason` (`name_not_in_scope` at `call_chains.ts:114`); `language_eq` (`:41-42`); `grep_hits_all_intra_file` (`:83-88`). `has_uncaptured_indexed_grep_hit` (`entry_point.ts:97`) has **no** predicate op. The registry's sole writer is the human (`classifier-lifecycle.md`); `plan` only proposes.

---

## 3. Structural Work Items (ordered)

> **Work item 0 lands first as a pure restructure with zero behavior change, green-tested to lock the baseline.** All subsequent items are independently shippable and independently testable.

### WI-0 — Refactor `resolve_scope_recursive` into explicit named layers (pure restructure, no behavior change)

**Files:** `packages/core/src/resolve_references/name_resolution.ts:128-224`.
Replace the inline 2-step body with explicit `L0…L4` sections, each a small pure local helper, with a doc-comment stating the precedence contract (the thesis sentence). Initially **L1 and L3 are empty no-ops and L4 still clobbers** — behaviour is identical. Add a precedence comment block above the function. Green-test the full suite to lock the baseline before any behavioural layer lands.
**Closes:** none (enabling refactor). **No-shim compliant:** rewrites the canonical function in place; no `enhanced_*` variant.

### WI-1 — L4 non-clobber of import bindings (serde `has_flatten`)

**Files:** `packages/core/src/resolve_references/name_resolution.ts:191-196`.
In L2 (imports), record the set of names bound by import this scope (`import_bound_names: Set<SymbolName>`). In L4, when a local def's `kind` is `variable`/`constant` and its `name` is in `import_bound_names`, **skip the `set()`** — the import binding survives. Genuine top-level redefinition of a `function`/`class`/etc. (`def foo()` after `from x import foo`) still overrides, preserving legitimate shadows.
**Rationale:** the clobber only matters for the variable's own initializer; a same-name local var shadowing the import it is initialized _from_ is never the intended binding for that statement. This avoids threading reference-location into `resolve()` (a Phase-2-wide hot-path signature change). **Fallback only if a non-self-referential import/local collision turns up in the 104:** escalate to position-aware `resolve()` (optional reference-location arg in `resolution_state.ts:121-127`; import wins for references before the local def's `start_line`). Do not build the fallback speculatively (YAGNI).
**Closes:** 348.1.2 shadowing (the one pure name_resolution defect). Does **not** undo `definition.ts:121` (imports stay out of `by_scope`).

### WI-2 — Strip Rust `r#` raw-identifier prefix in module-path normalization

**Files:** `packages/core/src/index_single_file/query_code_tree/symbol_factories/imports.rust.ts:22-45` (`extract_scoped_path`) and/or `packages/core/src/resolve_references/import_resolution/import_resolution.rust.ts:139-175` (`resolve_rust_module_path` candidate-filename formation).
Strip a leading `r#` from each `::` segment when forming filesystem candidate names, so `use crate::r#type::parse` → `src/type.rs`. Single normalization point.
**Closes:** 348.1.2 raw-identifier sub-case. **Named separate point-fix** — independent of the export-vs-definition root cause.

### WI-3 — Definition-backed import fallback (L2)

**Files:** `packages/core/src/resolve_references/name_resolution.ts:177-188` (generalize the existing submodule-fallback block); reads `ScopeRegistry.get_file_root_scope` (`scope.ts`) + `DefinitionRegistry.get_scope_definitions` (`definition.ts:316-318`).
After `resolve_export_chain` returns null **and** the submodule fallback misses, for a **same-project resolved file** look up `import_name` in the resolved source file's root scope and bind that **real target `SymbolId`** (not `imp_def.symbol_id`). This resolves a named/default intra-project import against the target file's **definitions**, not its **exports**.
**Rationale:** Rust intra-crate visibility is broader than JS export visibility; the resolver currently models it as JS export visibility. Resolving against definitions keeps `ExportRegistry`'s JS semantics intact and **cannot** add export collisions (it never touches the export registry, so `export.ts:187-193` duplicate-export throw is untouched). Binding the real def means `resolution_count` counts it (vs the current fallback binding the import node).
**Closes:** 348.1.2 Rust no-pub dominant slice + indexed-sibling single-hop misses (fully).

### WI-4 — `DefinitionRegistry` module/type-visibility roll-up + L1 file-root seeding

**Files:** `packages/core/src/resolve_references/registries/definition.ts:99-130, 302-318` (new derived index in `update_file` + new accessor `get_module_visible_definitions(file_id)` next to `get_member_index`/`get_scope_definitions`); `packages/core/src/resolve_references/name_resolution.ts` (L1 seeding, **at file-root scope only**).
The accessor returns, per file, names whose **language semantics** make them module-visible even though their `defining_scope_id` is a child/sibling inner scope: Rust free fns + associated/inherent-impl fns across **all** impl blocks of types in the file + `cfg(test)` mod members; JS/TS function declarations (most JS already attach to the enclosing scope). Keep the `kind!=='import'` exclusion. L1 unions these into the **file-root** scope's map before recursing, so they inherit downward to every descendant call site. This is a **derived view** — it must **not** change `defining_scope_id` attachment or the scope tree.
**Closes:** 348.1.3 Rust cross-sibling-scope cases (sibling impl blocks; `cfg(test)` mod ↔ module-root) fully. Also seeds the leading `Type`/`module` anchor that 348.1.1 needs.

### WI-5 — L3 qualified-path-terminal member binding

**Files:** `packages/core/src/resolve_references/name_resolution.ts` (after L2/before L4); reads `DefinitionRegistry.get_member_index()` (`definition.ts:302`).
For each in-scope name already bound to a **type/module/alias/import** definition, bind that type's `member_index` terminals (`new`, `setup`, associated fns) under their bare terminal name **only if not already bound by a closer layer**.
**Over-binding guard (mandatory):** L3 fires **only** when the anchor segment resolves in-scope to a type/module/alias/import def, and binds **only** the member `member_index` actually maps under that anchor — never a speculative guess.
**Closes:** 348.1.1 TS class-static + Rust `Type::new` terminal-binding at Phase-1 level.
**Discipline (grafted from runner-up):** **Measure WI-4 before adding WI-5.** Land WI-4 first; for the TS `.`-static and Rust `Type::new` paths, the existing Phase-2 receiver/constructor machinery may already resolve them once the anchor is in scope (`receiver_resolution.ts:262-267`; `constructor.ts:57/71`). Add WI-5 **only if** a terminal-only function-call residual remains after WI-4.

### WI-6 — Index-side: preserve the Rust scoped-identifier qualifier (Mode B)

**Files:** `packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.rust.ts:381-436` (`extract_receiver_info`), `:725-754` (`is_method_call`), reusing `:292-366` (`extract_property_chain`); `packages/core/src/index_single_file/references/references.ts:412-456` (factory routing).
Extend Rust `is_method_call` + `extract_receiver_info` to treat a `call_expression` whose function is a `scoped_identifier` as a chain-bearing receiver: emit a **`MethodCallReference`** with `property_chain = [leading, terminal]` and a `receiver_location` at the path node — **exactly how `Type::new` already works on the constructor path**. Reuse the existing `extract_property_chain` splitter. Keep `extract_call_name` returning the terminal for `name`.
**Rationale:** Mode B is the **only** part of 348 impossible at Phase-1 alone — the qualifier is destroyed at index time and `FunctionCallReference` has no field to carry it. Routing through the existing `MethodCallReference.property_chain` reuses all working Phase-2 machinery (`receiver_resolution.ts:221-291` → `method_lookup.ts:131-148`), adds **zero** new data-model surface, and incurs **zero** `call_resolver.ts` switch ripple — strictly preferred over adding a field to `FunctionCallReference`.
**Closes:** 348.1.1 Rust `Type::assoc_fn` / `module::fn` slice (the bulk of the 56) — once the qualifier survives, WI-4/WI-5 light up resolution end-to-end.

### WI-7 — JS member-assignment attachment (`this.cleanup = function(){}`)

**Files:** `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts` + member/assignment patterns in `typescript.scm` (~`:656-662`).
Register a function bound via `this.x = function/() =>` (or a plain `function cleanup(){}` nested in a constructor) as a **scope-visible definition** under the constructor scope, so it enters `by_scope` and inherits downward.
**Closes:** the one residual 348.1.3 `cleanup` member. **Named separate point-fix** — index-time attachment defect, not a walk/layer problem.

### WI-8 — 348.1.4 interim classifier rule (proposal only)

**Files:** none in pipeline code. Per `classifier-lifecycle.md`, `plan` **proposes** into the task DB; the **human** is `registry.json`'s sole writer via `atomic_update_registry`.
Proposed `wip` `KnownIssue`, expressible with **existing** DSL ops (no `types`/evaluator change): `all(resolution_failure_reason_eq "name_not_in_scope", any(language_eq rust, language_eq python, language_eq typescript), grep_hits_all_intra_file true)`, `backlog_task: "TASK-348"`. The human flips it `status: fixed` once WI-1…WI-7 land (commit scope `fix(348.1.x)` so `reconcile-registry` detects the landed fix).
**Closes:** 348.1.4 (proposal-only by the write-boundary).

---

## 4. Sub-task → work-item map

| Sub-task                                     | Coverage                           | Where                                                                                                                                                                                                                                                                                                      | Residual point-fixes                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **348.1.1** (56, qualified-path terminal)    | **fully**, split by mode           | Mode A (TS `.`-static `LanguageServiceTestEnv.setup`, Rust `Type::new`): WI-4 hoists the anchor + **existing Phase-2** consumers fire; WI-5 as fallback. Mode B (Rust `Type::assoc_fn`/`module::fn`): **requires WI-6** to preserve the qualifier first, then rides WI-4/WI-5 + existing method machinery. | Mode B coverage **depends on WI-6 landing** — Phase-1 alone cannot fix it.                                                                                                                          |
| **348.1.2** (43, single-hop import + shadow) | **fully**                          | Rust no-pub + indexed-sibling misses → WI-3 (definition-backed fallback). serde `has_flatten` same-statement clobber → WI-1 (L4 non-clobber).                                                                                                                                                              | Rust `r#` raw-identifier → **WI-2** (named separate point-fix). The `de::has_flatten()` qualified case is correctly **out of scope** (it is a 348.1.1 qualified-terminal case, covered by L3/WI-6). |
| **348.1.3** (4, sibling inner scope)         | **partially via shared structure** | Rust cross-impl/`cfg(test)`-mod cases (`content_as_str` in a sibling impl) → WI-4 (module-visibility roll-up + L1 seeding).                                                                                                                                                                                | JS `this.cleanup = function(){}` → **WI-7** (named separate index-time attachment fix). `adjust_arg_for_abi` is cross-file → belongs to 348.1.2's import work, not .1.3.                            |
| **348.1.4** (interim classifier)             | **proposal-only**                  | WI-8 — `plan` emits a `wip` rule from existing DSL ops; human authors it via `reconcile-registry`.                                                                                                                                                                                                         | None. No code change; no new DSL op (YAGNI — existing ops suffice for the dominant intra-file shapes).                                                                                              |

---

## 5. Test Strategy

All assertions use `toEqual` with typed literal objects — **never `toMatchObject`**. Assert `resolution_count` for **both `>0` (newly fixed) and `==0` (still-correctly-unreachable)**. Colocated `*.test.ts`.

| File                                                                            | Cases                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Evidence members                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `name_resolution.test.ts`                                                       | WI-0 baseline lock (no behavior change). WI-1: same-statement self-init (`let has_flatten = has_flatten(fields)` → RHS resolves to the **import**, `resolution_count>0`) AND genuine top-level redefinition (`from x import foo` then `def foo()` → local wins after). WI-3: named/default intra-project import resolves to the real def `SymbolId`. WI-4: sibling-impl callee resolves via file-root seeding. WI-5 (if added): in-scope type terminal binds. | serde `has_flatten`; Rust no-pub `use crate::de::has_flatten`; `content_as_str`. |
| `resolution_state.test.ts`                                                      | Only if the WI-1 fallback (position-aware `resolve()`) is built: import-before-decl → import; ref-after-decl → local.                                                                                                                                                                                                                                                                                                                                         | —                                                                                |
| `definition.test.ts`                                                            | WI-4: `get_module_visible_definitions(file_id)` returns the union across sibling impl blocks + `cfg(test)` mod; asserts the `kind!=='import'` exclusion holds; asserts `by_scope`/scope tree are **unchanged** (derived-view invariant).                                                                                                                                                                                                                      | sibling impl-block fns.                                                          |
| `import_resolution.rust.test.ts`                                                | WI-2: `crate::r#type::parse` → `src/type.rs` (exact path literal). Keep existing `crate::module → module.rs`, `mod.rs` precedence cases green.                                                                                                                                                                                                                                                                                                                | `use crate::r#type::parse`.                                                      |
| `metadata_extractors.rust.test.ts`                                              | WI-6: **update** the pinned `extract_call_name`/`property_chain`/`is_method_call` expectations for scoped_identifier to the new method-call shape (toEqual literals). **Update the source-consistent test, never bend source to the old test.**                                                                                                                                                                                                               | `Type::assoc_fn`, `module::fn`.                                                  |
| `receiver_resolution.rust.test.ts`                                              | WI-6: add `Type::assoc_fn()` coverage (currently only `self.method()` is covered) — resolves end-to-end after the qualifier survives.                                                                                                                                                                                                                                                                                                                         | Rust associated-fn calls.                                                        |
| `capture_handlers.typescript.test.ts` (+ `scopes.test.ts` if attachment shifts) | WI-7: `this.cleanup = function(){}` registers a scope-visible def under the constructor scope.                                                                                                                                                                                                                                                                                                                                                                | fastify-middie `cleanup`.                                                        |
| `project.{rust,python,typescript}.integration.test.ts`                          | **Regression guard (mandatory):** assert the **116 non-348 members stay `resolution_count==0`** after every behavioural item, AND assert the 104 flip `0→>0`. Re-run the full 104-member triage after each step.                                                                                                                                                                                                                                              | the 104 vs the 116 boundary.                                                     |
| `predicate_evaluator.test.ts`                                                   | WI-8 needs **no** evaluator change (existing ops only). Touch only if the human later judges a new `has_uncaptured_indexed_grep_hit` op necessary — out of scope here.                                                                                                                                                                                                                                                                                        | —                                                                                |

---

## 6. Risks, Ordering, and Non-Regression

### Ordering / dependencies

1. **WI-0** (pure restructure, lock baseline green).
2. **WI-1** (smallest self-contained behavioural fix; serde `has_flatten`).
3. **WI-2** (isolated import-path fix).
4. **WI-3** (definition-backed fallback; dominant Rust 348.1.2 slice; verify the 116 stay unresolved).
5. **WI-4** (module-visibility roll-up + L1 seeding; 348.1.3; **then measure** whether TS class-static + Rust `Type::new` already resolve via existing Phase-2).
6. **WI-5** (L3 member-binding) **only if** WI-4 leaves a terminal-only residual.
7. **WI-6** (Rust qualifier preservation; unblocks Mode B of 348.1.1) — depends on WI-4/WI-5 being in place to "light up" the binding.
8. **WI-7** (JS member-assignment attachment) — independent, any time after WI-0.
9. **WI-8** (classifier proposal) — emitted last; human flips `status: fixed` after WI-1…WI-7 commit with `fix(348.1.x)` scope.

### Risks

- **Over-binding → false call edges (central risk).** Only 104 of 220 candidate FPs are this fault; the other 116 (upstream re-export, receiver-type inference, polymorphic dispatch, non-static entry points) must **not** resolve here. Mitigations: L1 roll-up is gated to **module-visible** defs (not every descendant); WI-3 fires **only** for same-project resolved files **after** export-chain + submodule both return null; L3 fires **only** when the anchor resolves in-scope to a type/module/alias/import and binds **only** what `member_index` maps. Enforced by the integration regression guard (the 116 stay `==0`).
- **Test churn at the data-model boundary (WI-6).** `metadata_extractors.rust.test.ts` pins `extract_call_name → 'new'` and `property_chain` outputs — these **must be updated to the new method-call shape**, not the source bent to pass.
- **Position-aware `resolve()` blast radius (WI-1 fallback).** Avoid unless forced; if built, keep the location arg optional and consult position only when a name has **both** an import and a local-def binding (the rare collision), so the common hot path is unchanged.

### Must not regress

- **`Map<ScopeId, Map<SymbolName, SymbolId>>` value-shape** — every Phase-1 change preserves it; zero Phase-2 consumer edits.
- **`definition.ts:121`** import exclusion from `by_scope` — WI-3 routes through `get_scope_definitions`/`get_module_visible_definitions`, never re-admits imports.
- **`export.ts:187-193`** duplicate-export throw — WI-3 never touches `ExportRegistry`, so it cannot add collisions.
- **Genuine top-level shadowing** (`from x import foo` then `def foo()`) — WI-1 keeps the override for non-`variable`/`constant` redefinitions.
- **Named function expression self-reference** (`javascript_typescript_scope_boundary_extractor.ts:129-142`) — the L1 roll-up is a derived view and must not relocate names that deliberately bind inside their own scope.
- **`scopes.test.ts` exact tree shapes** — WI-4 is a derived accessor; it must not change `defining_scope_id` or the scope tree, only roll up a view of it.
- **Classifier write-boundary** — WI-8 is proposal-only; no pipeline code writes `registry.json`; the human writes via `atomic_update_registry`.
