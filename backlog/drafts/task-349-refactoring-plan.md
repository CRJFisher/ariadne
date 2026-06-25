# TASK-349 Refactoring Plan: Carrying Receiver Types into receiver_resolution

## The unifying problem

Every TASK-349 leaf is the same failure expressed in a different language and at a different capture site: a receiver's type is **knowable at a declaration or assignment site**, but that type fact never reaches a form the call resolver can consult, so chained method calls like `this.field.method()` / `self.df.method()` fail and the callee surfaces as a false entry point.

The single consult site is `walk_property_chain` (`receiver_resolution.ts:301-370`). For each link in a property chain it:

1. Finds the member symbol via `context.types.get_type_member(current_type, property_name)`, with a fallback to `context.definitions.get_member_index()` (`receiver_resolution.ts:310-319`).
2. Reads the member's type — **`get_symbol_type(member_symbol)` first** (`receiver_resolution.ts:330`), then a **`def.type` fallback** (`receiver_resolution.ts:332-356`): for a `property`/`parameter` def with a populated `member_def.type`, it resolves that bare name in the member's defining scope via `context.resolutions.resolve(member_def.defining_scope_id, member_def.type)`.
3. Emits `method_not_on_type` (`receiver_resolution.ts:321-326`) when the member is not found, or `member_type_unknown` (`receiver_resolution.ts:358-363`) when the member is found but neither path yields a type.

There are therefore **two independent paths** that can satisfy the consult site:

- **Path A — `symbol_types` funnel.** `get_symbol_type` (`type.ts:406`) reads `this.symbol_types`, populated by `resolve_type_metadata` STEP 1 for single names (`type.ts:202-217`) and STEP 1b for namespace chains (`type.ts:219-248`). Both feed off `bindings.ts` via `extract_type_data` (`type.ts:127-172`).
- **Path B — `def.type` fallback.** When `symbol_types` has no entry, `walk_property_chain` resolves `member_def.type` directly (`receiver_resolution.ts:347-354`).

The root cause is that the **type carrier on the definition (`def.type`, and its missing namespace sibling) is fed inconsistently**:

- **349.1.1 (TS generic fields):** `extract_property_type` (`symbol_factories.typescript.ts:395-408`) returns the _full_ generic-type node text — `def.type = 'TestingInjector<unknown>'` — which `resolutions.resolve` cannot match. Path B fails on a decorated name; Path A never populates.
- **349.1.2 (JS JSDoc params/locals):** plain JS params/locals have no AST `type` field, so the param/variable handlers set `def.type = undefined` (`capture_handlers.javascript.ts:252, 270, 329`). Both paths see nothing, even though the JSDoc `@param {Type}` text is already in the AST as a `comment` node.
- **349.1.3 (Python cross-method `self.X`):** `handle_assignment_property` (`capture_handlers.python.ts:300-352`) fires only inside `__init__` (`capture_handlers.python.ts:318-329`) and stores RHS type as a single dotted string (`'pd.DataFrame'`) that resolves as neither a bare name (Path B) nor a chain (Path A lacks a property chain carrier).

**Consequence for the plan:** the fix is almost entirely _capture-time_. For 349.1.1 and 349.1.2 the cheaper Path B (a resolvable bare `def.type`) is sufficient — the `bindings`/`symbol_types` additions are **not required** for those leaves. The bindings funnel additions are required only for 349.1.3, whose namespace-qualified RHS (`['pd','DataFrame']`) has no `def.type`-resolvable single name and must go through STEP 1b.

This contradicts an over-simplified "all three converge on populating `symbol_types`" model: the consult-side `def.type` fallback is load-bearing, and each leaf must declare _which path_ it relies on, backed by a test that proves it.

## Target architecture

### Producer contract (the shared abstraction)

Every typed definition slot (param / local / property) carries up to two optional, **unresolved** carriers:

- `type?: SymbolName` — a **bare** type name (no generic args, no namespace prefix). Already on `ParameterDefinition` (`symbol_definitions.ts:126`), `VariableDefinition` (`symbol_definitions.ts:198`), `PropertyDefinition` (`symbol_definitions.ts:114`).
- `type_namespace_chain?: readonly SymbolName[]` — for dotted/namespace-qualified RHS (`['pd','DataFrame']`). **New**, added to `PropertyDefinition` only.

A bare resolvable `type` is consumed by **Path B** (`def.type` fallback) with no funnel change. A `type_namespace_chain` requires **Path A** STEP 1b. The carriers are filled by language-specific capture adapters; downstream resolution is uniform.

> Correction on precedent: there is **no existing `VariableDefinition` namespace-chain carrier**. The variable namespace path derives from a _constructor reference_ (`extract_constructor_bindings` reading `ref.property_chain`, `constructor.ts`), not from a field on the definition. `type_namespace_chain` on `PropertyDefinition` is therefore a genuinely new kind of carrier — the Python `self.X = pd.DataFrame()` RHS is captured at indexing time (`handle_assignment_property`), not as a `constructor_call` reference, so it cannot reuse `extract_constructor_bindings`.

### Capture-time normalizer (new shared helper)

A single `base_type_name` primitive returns the bare base name from a possibly-decorated type expression, with two thin façades over one core:

- **AST façade** — a `generic_type` tree-sitter node returns its `type_identifier` child text; a plain identifier returns `.text`. Fixes 349.1.1.
- **String façade** — strips a trailing `<...>` from a JSDoc/annotation string; splits a dotted `'pd.DataFrame'` into `{ chain: ['pd','DataFrame'], base: 'DataFrame' }`. Serves 349.1.2 (bare JSDoc names) and 349.1.3 (chain split).

### Feeder (bindings.ts — Path A only, for 349.1.3)

The property loop at `bindings.ts:95-100` already emits `prop.type` into the single-name stream and keeps working once `prop.type` is a bare resolvable name. The **one addition** is emitting `prop.type_namespace_chain` into a property-keyed namespace stream (`LocationKey -> SymbolName[]`), merged into the existing `namespace_constructor_bindings` map at `extract_type_data` (`type.ts:167`) — **no new STEP**, an extra source for STEP 1b.

### Funnel & consult (unchanged)

STEP 1 (`type.ts:202-217`) and STEP 1b (`type.ts:219-248`) write `symbol_types`. STEP 1b is active in production: `project.ts:403-409` supplies `import_source_resolver`. The consult side (`walk_property_chain:330`, `resolve_identifier_base:254`) needs **zero edits**.

> Caveat (verified): STEP 1 keys on `get_symbol_at_location(loc_key)` (`type.ts:204`) and skips when no symbol is registered there. Whether a property's location is registered in `get_symbol_at_location` determines whether Path A can populate `symbol_types` for properties at all. If it is not, Path B (`def.type` fallback) is the only working path for properties, and STEP 1b's namespace write would silently no-op. **This must be verified empirically before relying on the funnel for the Python leaf.**

## Shared components to build

| Component                                                        | File                                                                                                                                                  | Purpose                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_type_name` normalizer (AST + string façades over one core) | `packages/core/src/index_single_file/query_code_tree/symbol_factories/base_type_name.ts` (new)                                                        | Bare base-name extraction. AST: `generic_type` → `type_identifier` child (fixes `symbol_factories.typescript.ts:395-408`). String: strip trailing `<...>`, split dotted into `{chain, base}`. Consumed by all three leaves. Union/array shapes return the original string (let `resolutions.resolve` miss) per YAGNI. |
| `PropertyDefinition.type_namespace_chain`                        | `packages/types/src/symbol_definitions.ts:112`                                                                                                        | Additive `readonly type_namespace_chain?: readonly SymbolName[]`. Carries `['pd','DataFrame']`. No `schema_version` bump (in-memory, additive).                                                                                                                                                                       |
| `add_property_to_class` signature extension                      | `packages/core/src/index_single_file/.../definitions.ts:702`                                                                                          | Builder must accept and persist `type_namespace_chain` — without this the new carrier cannot be populated. (Unlisted-but-required edit.)                                                                                                                                                                              |
| Property namespace-chain binding stream                          | `packages/core/src/resolve_references/type_preprocessing/bindings.ts:95-100`                                                                          | Emit `prop.type_namespace_chain` as `LocationKey -> SymbolName[]`, merged into `namespace_constructor_bindings` at `type.ts:167`. Single-name `prop.type` emit unchanged.                                                                                                                                             |
| `find_enclosing_callable_node`                                   | `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts:183` (extracted from `find_containing_callable`) | Returns the enclosing function **node** (not a `SymbolId`) so the JSDoc `@param` extractor can reach the function's preceding `/** */` comment. `find_containing_callable` refactored to call it.                                                                                                                     |
| The `symbol_types` funnel (existing)                             | `type.ts:202-248`, consult at `type.ts:406`                                                                                                           | STEP 1 + STEP 1b are the sole Path-A resolution. Not new code; the refactor feeds it uniformly for 349.1.3 only.                                                                                                                                                                                                      |

## Per-leaf adapters

### 349.1.1 — Resolve `this.field.method()` on generic-typed fields

- **Root cause:** `extract_property_type` (`symbol_factories.typescript.ts:395-408`) returns the `generic_type` node's full `.text` (`'TestingInjector<unknown>'`), unresolvable by `resolutions.resolve`.
- **Fix:** when the selected inner type node is `generic_type`, return `base_type_name(node)` (its `type_identifier` child) instead of `node.text`. `extract_parameter_type` (`symbol_factories.typescript.ts:413-436`) inherits the fix via delegation. **Gate strictly on `child.type === 'generic_type'`** — the plain-identifier path returns `.text` unchanged.
- **Path:** Path B (`def.type` fallback at `receiver_resolution.ts:347-354`). No `bindings`/`symbol_types` change required for this leaf.
- **Cross-language parity:** mirror in `symbol_factories.python.ts:386` for the generic/subscript path (celery/sqlalchemy evidence shape).
- **Data-structure changes:** none.
- **Evidence triage (important):** the 349.1.1 task evidence has 14 members of mixed shape. **In scope:** generic-erasure (`TestingInjector<unknown>`, `Map<string,number>`), `MergedExtensionsList`. **Already working at HEAD (regression guards, not fixes):** `private readonly config?: ApplicationConfig` resolves today — assert it does not change. **Out of scope for this leaf** (route to 349.1.4 or a separate leaf): the Rust operator-indexing case (`delay_queue.rs:669`, `[]` desugaring to `Index::index`) and the django two-level module-qualified attribute chain (`geometry.py:772`) — neither is touched by generic stripping.

### 349.1.2 — Extract JSDoc `{Type}` onto JS param/local `def.type`

- **Root cause:** plain-JS param/variable handlers set `def.type` from field-only extractors that return `undefined` (`capture_handlers.javascript.ts:252, 270, 329`); the JSDoc `@param {Type}`/`@type {Type}` survives only as raw docstring text. `extract_property_type` (`symbol_factories.javascript.ts:299`) already proves the JSDoc-first pattern works end-to-end for class fields.
- **New extractors** (`symbol_factories.javascript.ts`, beside `extract_jsdoc_type:252`, `find_preceding_jsdoc:269`):
  - `extract_jsdoc_param_type(comment_text, param_name)` — name-keyed `@param {Type} name` parser (the only genuinely new parsing), routing the matched `{Type}` through `base_type_name`'s string façade.
  - `extract_param_jsdoc_type(node, param_name)` — ascend via `find_enclosing_callable_node` to the function node, then `find_preceding_jsdoc` → `extract_jsdoc_param_type`.
  - `extract_variable_jsdoc_type(node)` — mirror `extract_property_type`: `find_preceding_jsdoc` → `extract_jsdoc_type`, fallback `extract_type_annotation`.
- **Seam** (`capture_handlers.javascript.ts`): in `handle_definition_param`/`handle_definition_parameter` set `type: extract_parameter_type(capture.node) ?? extract_param_jsdoc_type(capture.node, capture.text)`; in `handle_definition_variable` set `type: extract_variable_jsdoc_type(capture.node)`.
- **Path:** Path B for params (`resolve_identifier_base:269-279`) and Path B for chained locals. No funnel change required.
- **Data-structure changes:** none (`ParameterDefinition.type`/`VariableDefinition.type` already exist). No `reset_documentation_state` lifecycle (stateless AST walks, per `extract_property_type` precedent).
- **Scope:** the 11 webpack `buildChunkGraph.js` members (`@param {ModuleGraph}/{Compilation}/{ChunkGraph}/{ChunkGroup}` + JSDoc-typed locals) — all bare class names. Generic/union JSDoc (`{Array<Module>}`, `{Compilation|null}`) is **not** normalized (returns original string, documented known-unresolved).

### 349.1.3 — Propagate constructor/annotated RHS onto `self.X` across method boundaries

- **Root cause:** `handle_assignment_property` (`capture_handlers.python.ts:300-352`) fires only in `__init__` (`318-329`) and stores RHS as a single dotted string (`'pd.DataFrame'`, `340-343`) that resolves as neither a bare name (Path B) nor a chain (no carrier for Path A STEP 1b).
- **Fix:**
  1. `capture_handlers.python.ts` — remove the `__init__`-only filter; fire for any `self.X = ...` in a class method (the `find_containing_class` guard already scopes to a class body). When RHS `function` is an `attribute` node, collect the chain and set `type_namespace_chain` (via `base_type_name`); when it is a plain identifier, set the bare `type` as today.
  2. `symbol_definitions.ts:112` — add `type_namespace_chain?: readonly SymbolName[]` to `PropertyDefinition`.
  3. `definitions.ts:702` — extend `add_property_to_class` to accept/persist `type_namespace_chain`.
  4. `bindings.ts:95-100` — emit the property namespace chain into a new stream; merge at `type.ts:167`.
  5. STEP 1b (`type.ts:219-248`) resolves it for free; `symbol_types[property_id]` is populated, `member_index` already ties the property to its owning class.
- **Path:** Path A (STEP 1b) — the only viable path for namespace-qualified RHS. The bare-`Database()` shape still uses the single-name `type` (Path B).
- **Optional contingency** (`call_resolver.ts:276-296`): a Phase-2 property late-binding via `register_late_binding` for property targets. **Implement the static STEP 1b path first**; reach for this only if a cross-file test proves STEP 1b insufficient. Note `self.X = pd.DataFrame()` is captured by `handle_assignment_property` (an indexing handler), **not** as a `method_call` reference with `potential_construct_target` — so the existing late-binding hook is not automatically reachable for properties and would require a new emission. This is the difference between "contingency" and "mandatory" and must be checked.
- **Data-structure changes:** `PropertyDefinition.type_namespace_chain` (additive, no schema bump); new property namespace stream in `bindings.ts` + matching field in `ExtractedTypeData`.
- **Scope:** pandas `DataFrame`/`Series`/`HDFStore`/`Styler`-as-construction assigned in `setup()`; `Categorical()` into a **local** as a regression guard for the variable path. **Out of scope** (→ 349.1.4): Cython object-typed `self.obj`, fixture-injected `Styler._repr_html_`, and any pandas class **not present in the indexed corpus**.

## The interim classifier (349.1.4)

349.1.4 is the safety net for evidence members that **no in-repo fix can resolve**: external library classes absent from the indexed corpus (e.g. pandas if not indexed), Cython object types, fixture-injected members, and the out-of-scope Rust/django shapes from 349.1.1. It changes only the triage/classifier surface — not the resolver — so it cannot regress the type path.

It lands **first** as scaffolding so each evidence member is triaged into "fix here" vs "classify" _before_ resolver code is written, de-risking the highest-uncertainty assumption (whether the construction class is even in-corpus). Members routed to the classifier get classifier tests, never resolver tests.

## Sequencing & dependencies

| Step | Leaf                                   | Depends on | Rationale                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | -------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | 349.1.4 interim classifier             | —          | Triages every evidence member into fix-vs-classify before resolver work. Orthogonal to the resolver; gates the in-corpus precondition for 349.1.3.                                                                                                                                                                                                                                                         |
| 1    | shared structural foundation           | 0          | Add `PropertyDefinition.type_namespace_chain` + `add_property_to_class` param; create `base_type_name.ts` (+ unit tests); extract `find_enclosing_callable_node`; add the property namespace stream to `bindings.ts` + merge at `type.ts:167`. No capture site fills the new carriers yet, so behavior is unchanged — **except** existing Python property-set `toEqual` tests are unaffected until step 4. |
| 2    | 349.1.1 (TS generic base-name)         | 1          | Smallest behavioral change; exercises the AST façade; proves Path B resolves an end-to-end case (`referenced.has`). Mirror in `symbol_factories.python.ts:386`.                                                                                                                                                                                                                                            |
| 3    | 349.1.2 (JS JSDoc → `def.type`)        | 1, 2       | New stateless JSDoc extractors via `base_type_name` string façade + `find_enclosing_callable_node`; wire into JS param/variable handlers. Pure JS-side, Path B.                                                                                                                                                                                                                                            |
| 4    | 349.1.3 (Python cross-method `self.X`) | 1          | Largest, highest-risk (external-import resolution, multi-method dedup). Can run in parallel with 2–3 after step 1, but lands last so the funnel is battle-tested first. Will modify existing Python property-set assertions — see blast radius.                                                                                                                                                            |

## Risks & blast radius

1. **349.1.3 core assumption may be false.** External pandas classes may not be in the indexed corpus; `resolve_namespace_export` (`type.ts:242`) then returns nothing and no in-repo fix resolves them. STEP 1b also requires the import to be classified `import_kind === 'namespace'` (`type.ts:237`) **and** the source file resolvable — both preconditions beyond mere in-corpus presence. _Mitigation:_ validate each of the 9 evidence members against the actual fixture corpus at step 0; route external ones to 349.1.4. This is the single highest-risk assumption and a hard precondition gate.

2. **Dropping the `__init__` filter creates competing properties.** `add_property_to_class` keys properties by `definition.symbol_id` (`definitions.ts:721`), which is location-based, so the same `self.X` in two methods produces two distinct `PropertyDefinition`s; `member_index` (class → name → id) is last-writer-wins by name. _Mitigation:_ pick a deterministic canonical site (prefer `__init__`/first declaration); add a `capture_handlers.python.test.ts` case asserting the canonical type wins.

3. **Existing Python property-set tests break at step 4.** Many tests assert a class's property set with `toEqual` literals against `__init__`-only attrs (per CLAUDE.md). Widening capture to all methods adds properties and breaks those assertions. _Mitigation:_ update the affected `toEqual` literals as part of step 4; do not treat them as regressions. The "existing tests stay green" guarantee holds only through step 3.

4. **349.1.1 premise is partly inaccurate at HEAD.** Optional/readonly/private fields (`private readonly config?: ApplicationConfig`) already resolve; only generic-erased declarations genuinely fail. _Mitigation:_ gate the AST change strictly on `generic_type`; add regression guards for the already-working shapes.

5. **`base_type_name` over-stripping.** Unions/arrays/generic-namespace types could be mangled. _Mitigation:_ bare-name-only now; return the original string for unions/arrays; add explicit known-unresolved test cases.

6. **349.1.2 param-node ascent.** `find_preceding_jsdoc(param_node)` will not reach the function's preceding comment. _Mitigation:_ always go through `find_enclosing_callable_node` first; add unit + arrow-function-assigned-to-const tests.

7. **Property location may not be in `get_symbol_at_location`.** If so, STEP 1 / STEP 1b cannot populate `symbol_types` for properties and Path B is the only working path. _Mitigation:_ empirically verify before relying on the funnel for 349.1.3.

8. **Cross-file resolution boundary.** A JSDoc `{Compilation}` that is only a type-only import yields no resolution — outside what type extraction alone can fix. _Mitigation:_ scope leaf success to emitting the correct _name_; flag type-only-import members for the classifier; assert producer output (`def.type === 'Compilation'`) separately from the e2e resolution assertion.

9. **Indexing-time volume.** Widening `self.X` capture grows `member_index`/`symbol_types`. _Mitigation:_ measure before/after on a large Python fixture against the triage runtime budget.

## Test & verification strategy

Three layers, extending existing files per CLAUDE.md (`toEqual` with typed literals, never `toMatchObject`, exact extracted strings, no `toBeDefined`).

**Layer 1 — shared component units.**

- `base_type_name.test.ts` (new, colocated): AST façade returns `type_identifier` for `generic_type`, `.text` for plain identifier; string façade strips trailing `<...>`, splits `'pd.DataFrame'` → `{chain:['pd','DataFrame']}`, returns bare `'Compilation'` unchanged, returns union/array strings unstripped (documented known-unresolved).
- `symbol_factories.javascript.test.ts`: `extract_jsdoc_param_type` over a webpack-style multi-tag block maps each name → type; `undefined` for absent tags; optional `[name]` and trailing-dash variants. `find_enclosing_callable_node` ascends param → function/method/arrow.

**Layer 2 — capture/indexing units.**

- `symbol_factories.typescript.test.ts` (349.1.1): `extract_property_type` yields `'TestingInjector'` for `injector: TestingInjector<unknown>`, `'Map'` for `items: Map<string,number>`; **regression guard** — `private readonly config?: ApplicationConfig` still yields `'ApplicationConfig'`.
- `capture_handlers.javascript.test.ts` (349.1.2, extend JSDoc describe ~line 1594): built `ParameterDefinition.type === 'Compilation'` for `@param {Compilation} compilation`; `VariableDefinition.type === 'ChunkGraph'` for `/** @type {ChunkGraph} */ const cg`; destructured-binding and arrow-const cases.
- `capture_handlers.python.test.ts` (349.1.3): `toEqual` the `PropertyDefinition` for `self.df = pd.DataFrame()` in `setup()` with `type_namespace_chain: ['pd','DataFrame']`; `self.db = Database()` with `type: 'Database'`; same-attr-in-two-methods canonical-winner case; updated property-set literals for the widened-capture classes.
- `bindings.test.ts`: assert the new property namespace-chain binding map with `toEqual`.

**Layer 3 — resolver units + e2e.**

- `receiver_resolution.test.ts`: seed `symbol_types` via **`register_late_binding(symbol_id, type_id, file_path)`** (`type.ts:421`) — **not** a nonexistent `set_test_resolutions` helper — then assert `resolve_receiver_type` returns `ok(method)` and no longer emits `method_not_on_type`/`member_type_unknown`. Isolates the consult contract. **Additionally**, add a test per leaf that distinguishes _which path resolves_ (Path A vs Path B): for 349.1.1/349.1.2, assert resolution succeeds with `symbol_types` empty (proving Path B); for 349.1.3, assert it requires `symbol_types` populated (Path A).
- End-to-end via `Project.update_file` (asserting `project.resolutions.get_all_referenced_symbols()` `.has(method_id)`, per `receiver_resolution.python.test.ts:266-269`):
  - `receiver_resolution.typescript.test.ts` — generic-typed field `this.injector.method()` resolves (349.1.1).
  - `receiver_resolution.javascript.test.ts` — JSDoc-typed param `x.method()` and `@type`-typed local (349.1.2).
  - `receiver_resolution.python.test.ts` — `import pandas as pd` + `self.df = pd.DataFrame()` in `setup()` + `self.df.merge()` in a sibling method resolves; `cat = pd.Categorical()` into a local as a regression guard (349.1.3).

**Evidence → regression mapping.**

- 349.1.1 `TestingInjector` generic erasure → Layer 2 TS unit + Layer 3 TS e2e; Rust `Index::index` and django module-qualified → 349.1.4 classifier tests.
- 349.1.2 11 webpack `buildChunkGraph` members → Layer 1 param parser + Layer 2 handler + Layer 3 JS e2e.
- 349.1.3 pandas `DataFrame`/`Series`/`HDFStore`/`Styler`-as-construction → Layer 2 Python capture + Layer 3 Python e2e; `Categorical`-into-local → Layer 3 regression guard; Cython `self.obj`, fixture-injected `Styler._repr_html_`, external-only pandas → 349.1.4 classifier tests.

The observable contract asserted everywhere: `method_not_on_type` (`receiver_resolution.ts:321-326`) stops firing for the chained cases.

## Open questions

1. **Are `pd.DataFrame`/`pd.Series`/`pd.HDFStore`/`pd.Categorical` classes actually in the indexed fixture corpus?** If pandas is external, STEP 1b (`type.ts:242`) cannot resolve them in-repo and they belong to 349.1.4. Validate at step 0 — the single highest-risk assumption.
2. **Is a property's location registered in `get_symbol_at_location` (`type.ts:204`)?** Determines whether the bindings funnel can populate `symbol_types` for properties at all, or whether Path B is the only working property path.
3. **Does `add_property_to_class` (`definitions.ts:702`) dedup by `attr_location` or by `(class, attr_name)`?** Determines the canonical-site policy when the `__init__` filter is removed.
4. **Is the `call_resolver.ts:276-296` Phase-2 property late-binding actually reachable** for `self.X` (which is captured by an indexing handler, not a `method_call` reference), or does it need a new emission? Resolve empirically before implementing; default to the static STEP 1b path (YAGNI).
5. **Should `base_type_name` be one module with both façades** (AST needs tree-sitter node types; string is pure) under `symbol_factories/`, and does that satisfy the file-naming hook's language-suffix rules?
6. **Does JS `@type` on a destructured local** (`/** @type {Compilation} */ const { x } = ...`) attach the comment to the `lexical_declaration` reachable by `find_preceding_jsdoc`, or to a binding node that misses it? Needs a parsed-AST probe before committing the variable-handler wiring.
7. **Is the `symbol_factories.python.ts:386` generic-base-name parity fix** (celery/sqlalchemy evidence) in-scope for 349.1.1 or a deferred follow-up?
