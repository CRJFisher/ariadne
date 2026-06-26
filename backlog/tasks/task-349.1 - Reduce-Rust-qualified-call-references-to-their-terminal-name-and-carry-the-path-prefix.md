---
id: TASK-349.1
title: "Reduce Rust qualified call references to their terminal name and carry the path prefix"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-349
priority: high
ordinal: 1000
plan_dedup_key: e983b2e86a74354cebc10d4ccc76a25b65f516318c438a86a61ebee7c5da7a81
plan_source_task: pt-908261da97472d8f
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A Rust qualified-path call (`worker::create(7)`, `crate::runtime::Driver::start(8)`, `Parker::make(5)`) is emitted with `name` set to the _entire scoped path text_, and `Type::new()` associated constructors are emitted with `name` = the full path and **no path prefix**. Phase-1's scope map only ever holds bare terminal names (`create`, `Driver`, `make`), so every multi-segment / turbofish / `Self` form misses with `{stage: "name_resolution", reason: "name_not_in_scope"}`. The correct altitude is the **reference builder**, where the `name` is first assigned — not Phase-1, which is being asked to resolve a name that does not exist.

## Scope: producer + function-call resolution (one atomic unit)

A prototype showed the producer change is **not independently landable**. Reducing `utils::helper()` to the bare name `helper` makes it indistinguishable from a local `helper()`, so when a local function shadows an import (`tests/fixtures/rust/code/modules/shadowing.rs`: `use utils::{helper}` plus a local `fn helper`), the qualified `utils::helper()` call resolves to the **local shadow instead of the import** — a correctness regression caught by `project.rust.integration.test.ts > Shadowing` (helper-call count `2 → 3`). The producer's name reduction is only correct **with** the path-prefix resolver that honours the qualifier. They are therefore one task.

This task covers Rust **function calls** (qualified `mod::fn` and associated `Type::fn`). Constructor resolution is two further, separable root causes (no regression on their own) handled in order afterward:

- **TASK-349.4** — Rust `fn new()` is stored as a plain method, so `Type::new()` resolves to the class, never the constructor; plus `Self::new()` substitution.
- **TASK-349.5** — resolve inline-full-path constructors (`crate::…::Driver::new`) whose type is not bound by a bare name in scope, via the path-prefix type walk (reuses the resolver built here).

The TS static-dispatch row (`LanguageServiceTestEnv.setup()`) is **excluded**: it is captured as a `MethodCallReference` (`is_method_call` returns true for `member_expression` callees) on the method-lookup lane and shares no mechanism with the terminal-name path.

## Capture facts (verified against `rust.scm` + `tree-sitter-rust`)

The producer must branch on the **actual captured node**, which differs by call shape — no `.scm` edit is needed; all in-scope forms are already captured (with the wrong name):

| Source | Capture (`rust.scm`) | `capture.node.type` handed to the builder |
| --- | --- | --- |
| `worker::create(7)` | `@reference.call` on the whole `scoped_identifier` (rust.scm:655-660, `#not-match new`) | `scoped_identifier` |
| `Parker::make(5)` | same | `scoped_identifier` |
| `Cell::<u8>::make()` | same | `scoped_identifier` (path child is a `generic_type`) |
| `crate::runtime::Driver::new()` | `@reference.constructor.associated` on the **`path` child** (rust.scm:663-669) | `scoped_identifier` (`crate::runtime::Driver`) |
| `Cell::<u8>::new()` | same | `generic_type` (`Cell::<u8>`) |
| `Self::new()` | same | `identifier` (`Self`) |
| `worker::create::<i32>()` (outer turbofish) | **uncaptured** — the `generic_function` rule (rust.scm:671-676) matches only `function: (identifier)` | — |

Out of scope: the outer-turbofish form is a real `.scm` gap but is not in any acceptance criterion — track as a separate query-gap follow-up, do not block this task.

## Producer edits

- **`metadata_extractors.rust.ts`** (`extract_call_name`, ~line 766) — add a branch for a bare `scoped_identifier` (return the `name` field) and for a `generic_type` (return the `type` field, turbofish stripped). **Do not** add a bare-`identifier` branch: the existing test "should return undefined for non-call nodes" (`metadata_extractors.rust.test.ts:1279`, a bare `x`) depends on `identifier` returning `undefined`. `Self`/`Config` keep `name` via `capture.text` (correct by identity).
- **`metadata_extractors.rust.ts`** — add a **new** `extract_call_path_prefix(node, mode)` (a separate function from `extract_property_chain` at line 292, which must stay byte-for-byte behaviourally identical — `extract_property_chain` returns the full chain _including_ the terminal and is asserted by `extract_property_chain` tests; reusing it would break AC #5). `"function"` mode drops the terminal segment (`worker::create` → `["worker"]`); `"constructor"` mode keeps the full type path (`crate::runtime::Driver` → `["crate","runtime","Driver"]`, `Cell::<u8>` → `["Cell"]`, `Self` → `["Self"]`). Strip turbofish at every segment (a `generic_type` segment → its `type` child).
- **`metadata_extractors/types.ts`** — declare `extract_call_path_prefix?` as an **optional** method on the `MetadataExtractors` interface (Rust-only; TS/JS/Python never carry a scoped-path prefix, so they omit it and `references.ts` calls it as `?.`).
- **`references.ts`** (`process`, FUNCTION_CALL ~592 and CONSTRUCTOR_CALL ~607) — attach the prefix via `extractors?.extract_call_path_prefix?.(capture.node, mode)`. The terminal-name refinement makes the `capture.text` full-path fallback inert for Rust qualified calls (the fallback switch at ~563 only handles TS/JS `call_expression`/`new_expression`, so it is left untouched — this is why no TS/JS path regresses).

## Data-model edits (additive; no schema bump per project memory `project_plan_pipeline_no_schema_bumps`)

- A dedicated `path_prefix?: readonly SymbolName[]` field on `FunctionCallReference` and `ConstructorCallReference` (`packages/types/src/symbol_references.ts`), plus the matching optional params on `create_function_call_reference` / `create_constructor_call_reference` (`references/factories.ts`). It is **held separately from `property_chain`** rather than overloading it: `property_chain` carries the TS `[namespace, class]` shape and two TS-oriented consumers bake in that index convention — `call_resolution/constructor.ts:56` (reads `[0]`=namespace, `[1]`=class) and `type_preprocessing/constructor.ts:59` (`length > 1` ⇒ namespace-qualified) — so a Rust type-last chain in the same field would mis-bind them. `path_prefix` is the Rust `mod`/type path that scopes a terminal-name lookup; `FunctionCallReference` has no `property_chain` field today, and `ConstructorCallReference.property_chain` stays unset for Rust.

## Consumer edits — function calls (required for the safe landing)

- **`call_resolution/function_call.ts`** (`resolve_function_call` ~129, `find_function_resolution` ~34) — when `ref.path_prefix` is present, resolve **via the path first** (the author wrote the qualifier; honour it), falling back to the bare terminal only on a path miss. This is sound by construction and avoids the unsound global `get_definitions_by_name` ambiguity scan.
  - **Module-qualified** (`worker::create`, and the shadow case `utils::helper`): resolve the leading segment to the `mod`/`use` module, then resolve the terminal as that module's export/member. This is what makes `utils::helper()` bind to the import rather than the local shadow.
  - **Type-qualified associated fn** (`Parker::make`): resolve the leading segment to a type, then look up the terminal in `DefinitionRegistry.get_member_index().get(type_id)`. Associated functions are stored as `kind: "method"`, so the method-rejection gate at `function_call.ts:53` must be **bypassed only when `path_prefix` is non-empty** (a bare `make()` must still be rejected).
  - Normalize a leading `crate`/`self`/`super` segment (anchor to crate/module roots) before resolving.

## Collision safety

The retained `path_prefix` is the disambiguating guard and must be **enforced, not assumed**. When the terminal name is ambiguous (a local shadow, or two in-scope modules/types exposing the same name), the prefix selects the correct target. Evaluate ambiguity **in scope**, not via a global name scan; the single-valued `by_scope` map collapses same-name bindings, so path-prefix resolution must detect its own collisions rather than trust last-write-wins. Same-crate alias hops (`use ll::Semaphore`) ride this path only when the leading segment resolves through a `use`/type alias in the same crate; a cross-file re-export hop is `import_resolution` and out of scope — bail rather than fabricate an edge.

## Verification — evidence-case integration tests + fixtures

Unit assertions on the producer are necessary but not sufficient. The fix must be demonstrated against the **actual evidence cases** from the `name_resolution` false-positive cluster — the real qualified-function-call shapes in the corpus (e.g. sqlx `examples/…` module-qualified calls, tokio `tests/…` associated calls). Add integration tests that reproduce each evidence shape as a fixture under `tests/fixtures/rust/code/` (or inline `Project` + `update_file`) and assert the called definition flips from a **false-positive entry point** to **resolved/reachable**. Update any existing fixtures whose expected call graph changes under the new resolution. Honour the indexed-file-set precondition the epic flags (epic risk: sqlx rows live under `examples/`, tokio under `tests/`) — confirm those caller directories are actually indexed by the corpus run, otherwise the rows are `coverage_config`, not `name_resolution`, and the fix would not flip them.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `build_index_single_file` on inline Rust asserts each qualified call emits the terminal `name` plus the expected `path_prefix`: `worker::create` → name `create`, prefix `["worker"]`; `crate::runtime::Driver::new` → constructor name `Driver`, prefix `["crate","runtime","Driver"]`; `Cell::<u8>::new` → name `Cell`, turbofish stripped.
- [ ] #2 All existing `metadata_extractors.rust.test.ts` `extract_call_name`/`extract_property_chain` cases stay green; new `extract_call_name` and `extract_call_path_prefix` cases assert the terminal-name and prefix behaviour directly.
- [ ] #3 `Project` + `update_file` cross-file: `worker::create(7)` (module-qualified) resolves `create` in the `worker` module — `create` is reachable, not an entry point.
- [ ] #4 `Parker::make(5)` (type-qualified associated function) resolves to `make` in `Parker`'s member index.
- [ ] #5 **Regression guard:** `project.rust.integration.test.ts > Shadowing` stays green — when a local `fn helper` shadows `use utils::{helper}`, bare `helper()` resolves to the local while `utils::helper()` resolves to the **import**; the terminal-name reduction does not collapse the qualified call onto the local shadow.
- [ ] #6 A bare unqualified call (no `path_prefix`) resolves exactly as before — the method-rejection gate is only bypassed when `path_prefix` is non-empty.
- [ ] #7 Integration tests over fixtures reproducing the cluster's qualified-function-call evidence cases (sqlx/tokio module- and type-qualified calls) demonstrate each called function resolves (no longer an entry point); fixture additions/updates accompany any changed call-graph expectations, and the caller files are confirmed within the corpus' indexed-file set.

<!-- AC:END -->
