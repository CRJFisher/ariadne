# TASK-347 — Final Refactoring Plan: Type Identity in the Lexical Scope Tree

> Produced by a deep multi-agent review of the TASK-347 tree (7 code-reading agents → 3 competing structural designs → 3-lens judge panel → synthesis). Grounded in the live code at `packages/core/src/index_single_file/scopes`, `packages/core/src/resolve_references/call_resolution`, and the definition layer.

## 1. Problem restatement

The lexical scope tree is assembled by **pure positional containment**. In `process_scopes` (`packages/core/src/index_single_file/scopes/scopes.ts:194-250`), every scope-creating capture — class body, impl body, method, constructor — becomes a `LexicalScope` keyed solely by its own body `location` (`scope_string`, `packages/types/src/scopes.ts:108-117`) and parented to the smallest geometrically-containing scope via `find_containing_scope` (`scopes.ts:365-391`). `LexicalScope` (`packages/types/src/index_single_file.ts:29-47`) carries `{ id, parent_id, name, type, location, child_ids }` and **nothing that records which type identity a member belongs to**.

Two failures fall out of this single defect:

- **Rust** (`no_enclosing_class_scope`): each `impl Foo` / `impl Trait for Foo` block is captured as an anonymous `@scope.block` (`query_code_tree/queries/rust.scm:45-47`), producing N physically-disjoint sibling block scopes for one `Foo`. Geometry can never unify them, so a `self.method()` in one impl block cannot reach a method declared in a sibling impl block.
- **Python** (`no_parent_class`): `__init__` is captured as a `@scope.constructor` (`query_code_tree/queries/python.scm:261-267`) but the tree records no link from that constructor scope back to the class it constructs, so a `ClassName(...)` call site cannot route to `__init__`.

The receiver-resolution consumer compensates today with two crutches in `receiver_resolution.ts`: `find_class_from_scope` (`:423-458`) reverse-scans the entire `member_index` to re-derive an owning class from any method it finds in a scope, and `find_containing_class_scope` (`:381-411`) special-cases Rust block scopes by probing that scan. Both are O(members) per lookup and neither survives disjoint impl blocks.

The structural fix: **attach to every method/constructor scope the `SymbolId` of the type it belongs to, and expose a lookup that returns all members of a type identity regardless of which physical body block declared them.**

## 2. Chosen structural approach

**Stamp the canonical type-identity `SymbolId` directly onto member scopes, resolved at the PASS-3 seam from definitions that are already type-unified, and expose one members-by-type lookup that reuses the existing `member_index` (widened to include constructors).**

This is **Design 1's identity key and minimal data-model** (one nullable field on `LexicalScope`; reuse `ClassDefinition.symbol_id`; widen the existing `member_index`; delete `find_class_from_scope`) grafted with **Design 2's "resolve once, key by `SymbolId`" discipline** — but resolved at the point the research proves it is already free: the end of PASS 3.

### The exact type-identity KEY

The key is **`ClassDefinition.symbol_id`** — a `class:`-kinded `SymbolId`, location-anchored via `class_symbol(name, location)` / `create_struct_id` (anchored to the `struct_item`/`class_definition` node, `symbol_factories.rust.ts:38-50`). This is **not** a name and **not** a new identity type. The identity is **already unified** across all Rust impl blocks (every `impl Foo` method routes through `builder.find_class_by_name("Foo")` → the one struct id, `methods.rust.ts:44`) and **already carries** Python `__init__` (`add_constructor_to_class`, `capture_handlers.python.ts:231-244`). The only gap is the scope tree's missing back-link.

### Why the key avoids every collision case

The decisive structural choice — **resolve the scope→type edge at the end of PASS 3, inside the per-file `DefinitionBuilder` that just built the unified definitions** — makes collision-safety fall out for free, because PASS 3 has _already_ done the resolution:

1. **Rust generics** (`impl<T> Foo<T>`, `impl Foo<i32>`): `extract_impl_type` (`symbol_factories.rust.ts:250-272`) already peels the base `type_identifier` out of `generic_type`, yielding bare `Foo`; `find_class_by_name("Foo")` lands on the one `struct Foo` id. No new normalization is written — the existing peel is reused.
2. **Rust paths** (`impl crate::geometry::Foo`): resolved by the same `extract_impl_type` → `find_class_by_name` path the method definitions already use, so the scope edge binds to exactly the id the methods bound to.
3. **Rust same-name-different-module** (`mod a { struct Foo }` / `mod b { struct Foo }`): the key is a location-anchored `SymbolId`, never a bare string. Because the edge is resolved from each method's _already-resolved_ `ClassDefinition.symbol_id` (not by re-resolving a name in the consumer), the two `Foo`s stay distinct exactly as the definition layer already keeps them distinct.
4. **Python nested classes** (`Outer.Inner`): `find_containing_class` (`symbol_factories.python.ts`) already binds an inner method to the _nearest_ `class_definition`, anchoring on `Inner`'s own location, so `Inner`'s members key on `Inner`'s id.
5. **Cross-file impl blocks** (`impl Foo` in file A, `struct Foo` in file B): no collision and no gap, because the member scope's `enclosing_type_id` is the project-wide `SymbolId` and the project-level `member_index` is already cross-file-unified at the definition layer. The consumer reads one global key.

This is strictly safer than persisting a `{type_name, file_path}` on the scope node and re-binding it in a within-file name binder that could first-match-merge two `Foo`s: **no name is ever persisted on the scope and no name is ever re-resolved in the consumer.** The persisted value is always the resolved `SymbolId`.

## 3. Data-model changes

All in `packages/core/src/index_single_file/scopes` and its `@ariadnejs/types` dependency.

### 3.1 `LexicalScope` — one new field

`packages/types/src/index_single_file.ts:29-47`:

```ts
export interface LexicalScope {
  readonly id: ScopeId;
  readonly parent_id: ScopeId | null;
  readonly name: SymbolName | null;
  readonly type: ScopeType;
  readonly location: Location;
  readonly child_ids: readonly ScopeId[];
  readonly enclosing_type_id: SymbolId | null; // NEW
}
```

Non-null only for `method` / `constructor` scopes and Rust impl-body `block` scopes. `null` for module, class, free-function, parameter, and control-flow block scopes. The value is the owning class/struct/enum `ClassDefinition.symbol_id`.

### 3.2 `member_index` — include constructors (widen the existing index, do not add a parallel one)

`packages/core/src/resolve_references/registries/definition.ts:134-168`. Today `flat_members` collects `methods` + `properties` only; constructors land in `by_symbol` (`:160-166`) but never `flat_members`. Add constructors to `flat_members` so the existing `get_member_index()` (`:302`) becomes the single unified members-by-type lookup, keyed by `ClassDefinition.symbol_id`:

```ts
if (def.kind === "class" && def.constructors) {
  for (const ctor of def.constructors) {
    this.by_symbol.set(ctor.symbol_id, ctor);
    const ctor_loc_key = location_key(ctor.location);
    this.location_to_symbol.set(ctor_loc_key, ctor.symbol_id);
    flat_members.set(ctor.name, ctor.symbol_id); // NEW: constructors reachable by type identity
  }
}
```

No new `TypeIdentityHandle`, no new `MemberTypeIndex`, no new `SemanticIndex` field, no new registry. The "members of a type identity" lookup is the already-keyed-by-`ClassDefinition.symbol_id` `member_index`.

### 3.3 No change to `ScopeBoundaries`

`ScopeBoundaries` (`boundary_base.ts:17-25`) stays `{ symbol_location, scope_location }`. The type identity is **not** threaded through the boundary contract, because the producer seam resolves it from definitions, not from boundary extraction. This keeps every `toEqual({ symbol_location, scope_location })` literal in `boundary_extractor.test.ts` and `rust_scope_boundary_extractor.test.ts` green.

## 4. Producer changes, file by file

The producer attaches `enclosing_type_id` at the **PASS-3 seam** in the orchestrator, where the type-unified `ClassDefinition`s and the still-in-hand scope map coexist. This reuses the existing `body_scope_id` linkage (PASS 3 already computes which body scope each method/constructor occupies) rather than building a parallel walk.

### 4.1 `scopes.ts` — initialize the field; add the back-fill pass

`packages/core/src/index_single_file/scopes/scopes.ts:233-240` — set the field to `null` at the single scope-construction site:

```ts
const scope: LexicalScope = {
  id: scope_id,
  parent_id: parent.id,
  name: scope_name,
  type: scope_type,
  location,
  child_ids: [],
  enclosing_type_id: null, // back-filled at the PASS-3 seam
};
```

Add one exported pure function to the same module:

```ts
export function attach_enclosing_type_ids(
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  classes: readonly ClassDefinition[],
  enums: readonly EnumDefinition[]
): ReadonlyMap<ScopeId, LexicalScope>;
```

It walks every `ClassDefinition`/`EnumDefinition`, and for each of its `methods[]` and `constructors[]` reads the member's `body_scope_id` (already populated by PASS 3, `definitions.ts:88,100,293-321`), then writes `enclosing_type_id = class_def.symbol_id` onto that body scope (returning a new map with the updated scopes). For Rust, because all impl blocks' methods already resolve to one `struct Foo` id at definition-build time, **every** impl-block method body scope across **every** impl block receives the same `Foo` id — unification achieved without touching `parent_id` geometry. It also stamps the same id onto the impl-block `block` scope itself (the `parent_id` of those method scopes) so a `self`-keyword scope walk finds it. This is language-agnostic: it consumes the already-unified definition output, so no per-language logic lives here.

### 4.2 `index_single_file.ts` — wire the back-fill into the pipeline

`packages/core/src/index_single_file/index_single_file.ts:143-162`. After PASS 3 produces `builder_result`, back-fill the scope map before it ships in the `SemanticIndex`:

```ts
const builder_result = process_definitions(context, handler_registry);

const scopes_with_types = attach_enclosing_type_ids(
  context.scopes,
  builder_result.classes,
  builder_result.enums
);
```

and return `scopes: scopes_with_types` (`:162`). The `ProcessingContext` threaded into PASS 4 still uses the pre-stamp scopes (references don't read `enclosing_type_id`); only the persisted `SemanticIndex.scopes` carries the field downstream to `ScopeRegistry`.

### 4.3 `boundary_base.ts` — no change

Untouched. The `CommonScopeBoundaryExtractor` dispatch and per-kind methods are unaffected; type identity does not flow through boundaries.

### 4.4 `rust_scope_boundary_extractor.ts` — delete the dead synthetic path; re-tag the impl body

`extract_impl_boundaries` (`:142-162`) is **dead on the live path** — `rust.scm:45-47` captures the impl body as `@scope.block`, so the `case "impl_item"` under `extract_rust_class_like_boundaries` (only reachable when `scope_type === "class"`) never fires in production.

Two coordinated edits:

- **`query_code_tree/queries/rust.scm:45-47`**: keep the impl body as `@scope.block` (do **not** retag to `@scope.class` — that would change scope _type_ and break `scopes.test.ts` block-count assertions for no benefit). The impl-block `block` scope receives its `enclosing_type_id` in the back-fill pass (§4.1), not from a boundary change.
- **`rust_scope_boundary_extractor.ts`**: delete the now-confirmed-dead `extract_impl_boundaries` and its `case "impl_item"` dispatch (NO backwards compatibility — remove, do not shim). The `extract_impl_type` peel logic it duplicated already lives in `symbol_factories.rust.ts:250` and is reused by the definitions pass.

The impl-block `block` scope is recognized as the parent of the method body scopes; the back-fill stamps it by reading any contained method's owning `ClassDefinition`. No method-scope ancestor walk is written in this file — the linkage is the existing `body_scope_id`.

### 4.5 `python_scope_boundary_extractor.ts` — no change

Untouched. Python's `__init__` constructor scope and method scopes receive `enclosing_type_id` in the back-fill pass via `body_scope_id` of the `ConstructorDefinition`/`MethodDefinition` that `add_constructor_to_class`/`add_method_to_class` already attached to the class. The class identity is reached through the definition the extractor's captures already produced — no new `function_definition → class_definition` walk is added here.

> **Why no extractor walks?** Walking the AST in each extractor to find the enclosing class duplicates work PASS 3 already does (`find_containing_class` for Python, `find_containing_impl`+`find_class_by_name` for Rust). Reusing `body_scope_id` means the producer change is one language-agnostic back-fill pass consuming the unified definitions, not four per-language traversals.

## 5. Consumer changes

The consumer reads `enclosing_type_id` directly and the constructor-widened `member_index`. All three failing evidence cases resolve. No public signature of `resolve_method_call` / `resolve_constructor_call` changes — the lookups arrive through the existing `ReceiverResolutionContext` (`receiver_resolution.ts:59-65`) and the `definitions` argument.

### 5.1 Exposed lookup API

- **Per-scope**: `scope.enclosing_type_id: SymbolId | null`, read off `LexicalScope` via `context.scopes.get_scope(scope_id)` — already persisted by `ScopeRegistry` (no registry change needed; `update_file` stores the whole `LexicalScope`).
- **Per-type members**: the existing `DefinitionRegistry.get_member_index()` keyed by `ClassDefinition.symbol_id`, now constructor-inclusive (§3.2).

### 5.2 `receiver_resolution.ts` — direct lookup replaces the heuristic

- **`find_containing_class_scope`** (`:381-411`): walk `parent_id` up; return the first scope whose `enclosing_type_id` is non-null. For that scope, the owning type is `scope.enclosing_type_id` directly — no `find_class_from_scope` probe, no Rust block special-case (`:401-405` deleted).
- **`find_class_from_scope`** (`:423-458`): **DELETED**. The O(members) reverse-scan of `member_index` is fully replaced by reading `enclosing_type_id`.
- **`resolve_keyword_base`** (`:169-209`): for `self`/`this`/`cls`/`super`, obtain the owning type `SymbolId` from the containing scope's `enclosing_type_id`. The `no_enclosing_class_scope` failure (`:179`) now fires only when a keyword genuinely has no enclosing member scope.

**Rust `no_enclosing_class_scope` resolves**: `increment`'s impl-block method scope and `reset`'s sibling-impl-block method scope both carry `enclosing_type_id = Foo_id` (back-fill, §4.1). `find_containing_class_scope` returns `Foo_id` from either block; Phase-2 `resolve_method_on_type` (`method_lookup.ts:131-140`) reads `member_index.get(Foo_id)`, which holds **every** impl block's methods (already unified at the definition layer), so `reset` is found.

### 5.3 `function_call.ts` — read identity instead of walking parents

`function_call.ts:80-91`: the positional `body_scope → parent(class) → parent(module)` walk that emits `no_parent_class` is replaced by reading `enclosing_type_id` off the constructor's body scope, yielding the class `SymbolId` directly.

### 5.4 `constructor.ts` — constructor reachable via the widened index

`find_constructor_in_class_hierarchy` (`constructor.ts:159-168`) reads `class_def.constructors[0].symbol_id`, which is already populated for Python (`add_constructor_to_class`). The structural fix that makes `ClassName(...)` route is twofold and both halves now hold: (a) the constructor scope carries `enclosing_type_id = Engine_id`, so any path needing the owning class from the `__init__` scope gets it directly; (b) `member_index.get(Engine_id)` now includes `__init__` (§3.2), so `cls(...)` and explicit-mixin `ClassName.__init__(self, ...)` calls — which resolve through the type-identity→members lookup rather than `ClassDefinition.constructors` — find it.

**Python `no_parent_class` resolves**: `Engine("v8")` resolves `Engine` → `Engine_id`; `find_constructor_in_class_hierarchy` finds `__init__` via the populated `constructors`; the scope link removes the broken positional walk.

## 6. Sub-task mapping

| Task                                                                         | Concrete work items                                                                                                                                                                                                    | Subsumed by shared structural change?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **347** (architectural)                                                      | New `enclosing_type_id` field on `LexicalScope` (§3.1); `attach_enclosing_type_ids` back-fill pass (§4.1–4.2); constructor-widened `member_index` (§3.2); delete `find_class_from_scope` + Rust block heuristic (§5.2) | **This IS the shared change.** Everything below grafts onto it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **347.1** (fault_area: bind members to a resolvable enclosing-type identity) | Fully delivered by the back-fill pass writing `ClassDefinition.symbol_id` onto each member body scope via `body_scope_id`                                                                                              | **Subsumed** — language-agnostic core.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **347.1.1** (Python: parent constructors so `ClassName(...)` → `__init__`)   | No Python-extractor change; `__init__`/`cls`/method body scopes stamped by back-fill (§4.5); constructor added to `member_index` (§3.2); consumer reads identity (§5.3–5.4)                                            | **Subsumed** by the shared change + constructor-index widening. No language-specific producer code.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **347.1.2** (Rust: unify sibling impl blocks under one `Foo`)                | Delete dead `extract_impl_boundaries` (§4.4); back-fill stamps every impl-block method + impl `block` scope with the unified `Foo` id (§4.1)                                                                           | **Mostly subsumed** — the unification is shared (driven by the already-unified definition layer). The only Rust-specific work is the **deletion** of dead code, not new logic.                                                                                                                                                                                                                                                                                                                                                                            |
| **347.1.3** (interim triage classifier)                                      | None                                                                                                                                                                                                                   | **Becomes unnecessary.** Once the root cause lands, the `no_enclosing_class_scope` (Rust cross-impl) and `no_parent_class` (Python constructor) FP shapes stop being emitted at the source, so there is nothing for the interim predicate to suppress. Per the constitution's no-surplus rule and YAGNI, **do not author the classifier predicate** — the structural fix retires it. If a residual FP shape survives (e.g. cross-file impl on an extern type), that is a distinct, narrower signal handled by normal triage, not this interim mitigation. |

## 7. Sequencing

Structural-change-first so the language fixes graft onto a stable identity:

1. **Type field** — add `enclosing_type_id: SymbolId | null` to `LexicalScope` (`index_single_file.ts:29-47`); initialize to `null` at the construction site (`scopes.ts:233-240`). Update the ~5 hand-built `LexicalScope` literals in `scopes.test.ts` to include `enclosing_type_id: null`. _Compiles; no behavior change._
2. **Constructor index** — widen `flat_members` to include constructors (`definition.ts:160-166`). Add a `method_lookup.test.ts`/`constructor.test.ts` assertion that `get_member_index().get(class_id)` contains the constructor name. _Isolated; no scope dependency._
3. **Back-fill pass** — implement `attach_enclosing_type_ids` in `scopes.ts`; wire it into `index_single_file.ts:143-162`. _This activates identity for Python and Rust simultaneously, since both feed unified definitions._
4. **Rust dead-code removal** — delete `extract_impl_boundaries` and its dispatch in `rust_scope_boundary_extractor.ts`; realign the synthetic-`"class"` unit tests (`rust_scope_boundary_extractor.test.ts:159-224`) to assert the live `@scope.block` path. _Depends on step 3 proving the live path carries identity._
5. **Consumer simplification** — delete `find_class_from_scope` and the Rust block heuristic; rewrite `find_containing_class_scope` / `resolve_keyword_base` (`receiver_resolution.ts`) and `function_call.ts:80-91` to read `enclosing_type_id`. _Depends on steps 1+3._
6. **Integration tests** — add the Rust multi-impl and Python `ClassName(...)` E2E cases (§8). _Validates the whole chain._

Steps 1–2 are independent and can land in either order; 3 depends on 1; 4–5 depend on 3; 6 is last.

## 8. Test plan

Per project rules: add to **existing** test files; pick the tier by scope (`build_index_single_file`/inline for AST-single-construct, `Project + update_file` for cross-file resolution); typed-literal `toEqual`, never `toMatchObject`; assert exact `SymbolId`s and `is_exported` where relevant.

### 8.1 Scope-tree tier — `scopes.test.ts` (`build_index_single_file`, inline)

- Under `describe("Rust ...")`, new `it`: two `impl Foo` blocks; assert both method body scopes carry the **same** non-null `enclosing_type_id`, equal to `Foo`'s `class_symbol` id, with a typed-literal `toEqual`.
- Collision guard, same describe: `impl<T> Foo<T>` and `impl Foo` produce method scopes with the **same** `enclosing_type_id`; two `struct Foo` in different `mod`s produce method scopes with **distinct** `enclosing_type_id`s (forces the location-anchored-`SymbolId` key, not a bare name).
- Under `describe("Python Class Body-Based Scope")`, extend the `__init__` neighbour: assert the `__init__` constructor scope's `enclosing_type_id` equals the enclosing class's `class_symbol` id.
- Update the hand-built `LexicalScope` literals in `describe("create_processing_context")` and `describe("body-based scope assignment")` to add `enclosing_type_id: null`.

### 8.2 Definition/index tier — `definition` member index

Add an assertion (in the existing `method_lookup.test.ts` or the definition registry's own test) that for a class with a constructor, `get_member_index().get(class_id)` contains the constructor name → constructor `SymbolId`.

### 8.3 Rust boundary extractor — `rust_scope_boundary_extractor.test.ts`

Realign the two synthetic `describe("Impl boundaries")` tests (`:159-224`) that call `extract_boundaries(impl_node, "class", ...)`: since `extract_impl_boundaries` is deleted, these assert the **live** `@scope.block` path (impl body → `extract_block_boundaries`) instead of the removed synthetic dispatch.

### 8.4 E2E tier — `Project + update_file`

**Rust multi-impl** — `receiver_resolution.rust.test.ts`, new `it` in `describe("self.method()")`:

```rust
struct Counter { count: i32 }

impl Counter {
    fn increment(&mut self) {
        self.reset();          // cross-impl: reset() lives in the other impl block
    }
}

impl Counter {
    fn reset(&mut self) {
        self.count = 0;
    }
}
```

Assert the `self.reset()` reference resolves to `reset`'s `SymbolId` (today fails with `no_enclosing_class_scope`). Add the trait-impl + inherent-impl split variant to cover `impl Display for Widget` joining the same `Widget` identity as inherent `impl Widget`.

**Python `ClassName(...)` → `__init__`** — `receiver_resolution.python.test.ts`, new `it`:

```python
class Engine:
    def __init__(self, name):
        self.name = name

    def start(self):
        return self.name

def boot():
    e = Engine("v8")     # construction must route to Engine.__init__
    return e.start()
```

Assert the `Engine("v8")` construct reference resolves to the `__init__` `SymbolId` (today fails with `no_parent_class`). Add the explicit-mixin case (`Base.__init__(self, 1)` / `Mixin.__init__(self, 2)`) asserting both class `__init__`s become referenced.

### 8.5 Insulated (must stay green, do not edit)

`boundary_extractor.test.ts` (no `LexicalScope` construction, `ScopeBoundaries` unchanged); `constructor.test.ts`'s existing hand-built-registry cases (the resolver logic is unchanged — only the upstream scope linkage and member index change).

## 9. Risks & open questions

1. **Generics/path peel correctness**: `enclosing_type_id` correctness for Rust depends on `extract_impl_type`'s peel (`symbol_factories.rust.ts:250-272`) matching the struct's registered name so `find_class_by_name` binds. The peel currently handles `generic_type` and `type_identifier` with a raw-text fallback for `scoped_type_identifier` (paths). If a path form falls into the fallback and the full text doesn't match the bare struct name, the impl's methods won't bind to the struct at the **definition** layer either — meaning this is a _pre-existing_ definition-layer limitation that the scope edge inherits, not a regression. The collision-guard test (§8.1) surfaces it. **Open question for a human**: should `extract_impl_type` peel the final segment out of `scoped_type_identifier` as part of this work, or is that a separate hardening task? Recommend separate (YAGNI) unless a repro exists.

2. **Cross-file impl blocks**: `impl Foo` in file A, `struct Foo` in file B. At single-file PASS-3 time, file A's `find_class_by_name("Foo")` returns `undefined`, so file A's impl methods are not added to a `ClassDefinition` and their body scopes get `enclosing_type_id = null`. This matches the **definition layer's current single-file unification scope** — it is a documented existing boundary, not a new gap. The consumer falls back gracefully (emits the existing failure, no crash). Resolving cross-file impls would require a project-level re-stamp after all files index; defer until a cross-file Rust repro exists (constitution YAGNI). **Note for the human**: this is the one case where the interim classifier (347.1.3) _could_ still see an FP — but it is narrow and distinct from the cross-impl/constructor shapes the root cause eliminates.

3. **`enums` in the back-fill**: Rust impl blocks can target enums (`add_method_to_enum`, `find_enum_by_name`). The back-fill must walk `builder_result.enums` as well as `.classes`, keyed by the enum's `SymbolId`. The `member_index` build (`definition.ts:134`) currently keys only `class`/`interface`; confirm whether enum methods are already in `member_index` or need the same widening. **Open question**: verify enum-method receiver resolution has a member-index entry, or extend §3.2 to enums.

4. **Scope-count test churn**: keeping the impl body as `@scope.block` (not retagging to `@scope.class`) deliberately avoids perturbing `scopes.test.ts` block/function-count and `parent_id` assertions. The only scope-test additions are the new `enclosing_type_id` assertions and the `null` field on hand-built literals — mechanical, no count changes.

5. **Perf**: the back-fill is one O(members) pass per file at index time (replacing nothing at index time but eliminating the O(members) `member_index` reverse-scan _per lookup_ in `find_class_from_scope`). Net: a small fixed index-time cost for an unbounded per-lookup saving. Strictly favorable.

6. **`ProcessingContext` vs `SemanticIndex` scope divergence**: PASS 4 reads `context.scopes` (pre-stamp); the persisted `SemanticIndex.scopes` is the stamped map. Confirm no PASS-4 reference path reads `enclosing_type_id` (it does not today). If a future reference path needs it, re-stamp before PASS 4 instead. Keep the back-fill _after_ PASS 4 in the orchestrator so references keep using `context.scopes` unchanged.
