---
id: TASK-349.4
title: "Link Rust associated new() constructors and substitute Self so Type::new() resolves to the constructor"
status: Done
assignee: []
created_date: "2026-06-26 13:00"
labels:
  - name_resolution
  - rust
dependencies:
  - TASK-349.1
parent_task_id: TASK-349
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Spun off from TASK-349.1 after pipeline investigation revealed a second, independent root cause behind the Rust constructor false-positives. TASK-349.1 (the producer change) makes a `Type::new()` call reference carry the terminal type name plus a `path_prefix`; this task makes that reference actually resolve to the constructor.

## Root cause — the associated `new()` is never linked as the struct's constructor

A Rust `impl Parker { fn new() -> Self { … } }` is captured by `handle_definition_constructor` (`index_single_file/query_code_tree/capture_handlers/methods.rust.ts:146`) and added via `builder.add_method_to_class`. That call registers `new` as a plain **method** in the member index but leaves the `ClassDefinition.constructors` array **empty** (verified: a `Parker` struct indexes as `kind: "class"` with `constructors: []`, and `get_definitions_by_name("new")` returns `method:new`). Consequently `find_constructor_in_class_hierarchy` (`resolve_references/call_resolution/constructor.ts:159`) returns `null`, and `resolve_constructor_call` falls back to returning the **class symbol** (`constructor.ts:100`). The `new` associated function is therefore never marked reachable, so it surfaces as a false-positive entry point even when `Parker::new()` is called from in scope.

This is distinct from the name-reduction defect (349.1) and from the path-walking defect (349.5): even with the type already bound in scope (`use sync::Parker`), the constructor link is missing.

## Change

- **Resolve `Type::new()` to the associated constructor function.** In `resolve_constructor_call`, once the type symbol is resolved to a `ClassDefinition`, when `find_constructor_in_class_hierarchy` yields nothing, look up the associated constructor in the member index (`DefinitionRegistry.get_member_index().get(type_id).get("new")`) and return that method symbol. Decide between two equivalent altitudes and pick one: (a) populate `ClassDefinition.constructors` at capture time in `handle_definition_constructor` so the existing hierarchy walk finds it, or (b) add the member-index fallback in the resolver. Option (a) is the cleaner root-cause fix (Rust's `new` convention *is* the constructor) but must not double-count `new` as both a method and a constructor; option (b) is localized to the resolver.
- **`Self::new()` substitution.** A `Self::new()` call inside an `impl`/`trait` carries `name = "Self"`. Resolve `Self` to the enclosing impl/trait type by walking the call's scope to the containing class scope (reuse `find_containing_class_scope` + `find_class_from_scope` from `call_resolution/receiver_resolution.ts`; the latter is currently module-private and must be exported), then resolve the constructor as above. This requires threading the `ScopeRegistry` into `resolve_constructor_call` (currently absent from its signature; the sole caller is `call_resolver.ts:241`).

## Verification — evidence-case integration tests + fixtures

Demonstrate the fix against the **actual evidence cases** from the `name_resolution` cluster — the real `Type::new()` constructor false-positives in the corpus. Add integration tests that reproduce each evidence shape as a fixture under `tests/fixtures/rust/code/` (or inline `Project` + `update_file`) and assert the `new` (or associated constructor) definition flips from a **false-positive entry point** to **resolved/reachable**, with the call resolving to the constructor rather than the bare class symbol. Update any existing fixtures whose call-graph expectations change. Confirm the caller files are within the corpus' indexed-file set before counting a row resolved (epic risk: examples/tests-resident callers).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `Project` + `update_file`: a `use`-imported `Parker::new()` resolves to the `new` associated function (the `new` definition is reachable, not an entry point), not merely to the `Parker` class symbol.
- [x] #2 `Self::new()` inside an `impl` resolves to the enclosing type's `new` constructor.
- [x] #3 `new` is not double-counted (a struct with one `fn new` exposes exactly one constructor target; no duplicate reachable symbols).
- [x] #4 Existing constructor-resolution tests for TypeScript/Python stay green — the change is gated to the Rust associated-constructor path and does not alter the TS `[namespace, class]` `property_chain` branch.
- [~] #5 Integration tests over fixtures reproducing the cluster's `Type::new()` evidence cases demonstrate each constructor resolves (no longer an entry point); fixture additions/updates accompany any changed call-graph expectations. *(Partial: the evidence **shapes** are reproduced as fixtures and verified end-to-end; the literal sqlx/tokio corpus flip plus the indexed-file-set confirmation is a corpus-rerun verification step — see Implementation Notes, mirroring 349.1's AC#7.)*

<!-- AC:END -->

## Implementation Notes

## High-level summary

A Rust `Type::new()` call now resolves to the associated `new` function rather than to the bare struct symbol, so the constructor is reachable instead of surfacing as a false-positive entry point. The producer (349.1) already reduces a constructor call to its terminal type name plus a `path_prefix`; this task makes the resolver link that call to the constructor. Two cases close: a `use`-imported `Type::new()` whose type binds in scope, and a `Self::new()` whose terminal type is the `Self` keyword. The change is confined to the Rust associated-constructor path — gated on `path_prefix` — so the TypeScript/Python `new ClassName()` resolution is untouched.

## What changed

**Member-index constructor link (`call_resolution/constructor.ts`).** Rust's `impl T { fn new() -> Self }` is captured by `handle_definition_constructor` but stored via `add_method_to_class`, so `new` lands in the flat member index as a plain method and `ClassDefinition.constructors` stays empty. `find_constructor_in_class_hierarchy` therefore returns nothing and `resolve_constructor_call` previously fell back to the class symbol, leaving `new` unreferenced. `resolve_constructor_call` now, when the hierarchy walk yields nothing **and** `call_ref.path_prefix` is non-empty, calls the new `find_associated_constructor(type_id, definitions)` to return the `new` member. `find_associated_constructor` guards callability — a field named `new` (`struct T { new: u32 }`) overwrites the `fn new` method in the flat member index, so the helper rejects a non-callable hit, mirroring the `is_callable_definition` guard already on the function-call member lookup. The `path_prefix` gate is the Rust discriminant: TS/JS/Python never emit a scoped-path prefix on a constructor call, so their `new ClassName()` path never reaches this branch.

**`Self::new()` substitution (`call_resolution/constructor.ts`).** A `Self::new()` call carries `name = "Self"`, which is never in scope. When the type does not otherwise resolve and the terminal name is `Self`, the resolver walks the call's scope to the enclosing impl/trait type via `find_containing_class_scope` + `find_class_from_scope` (the latter promoted from module-private to exported in `receiver_resolution.ts`), then links the constructor as above. This required threading the `ScopeRegistry` into `resolve_constructor_call`; its sole production caller (`call_resolver.ts`) passes `context.scopes`.

## Verification

- AC#1 / AC#3 — `project.rust.integration.test.ts > Associated Constructor Resolution`: a `use`-imported `User::new()` (fixtures `modules/user_mod.rs` + `modules/uses_user.rs`) resolves to exactly the `new` member (`toEqual([user_new])`, asserted not to contain the class symbol) and `new` is absent from `call_graph.entry_points`.
- AC#2 — same block: `Self::new()` in the new fixture `modules/self_constructor.rs` resolves to `Widget::new` via the enclosing-impl substitution, and `new` is not an entry point.
- AC#4 — the full `@ariadnejs/core` suite is green (2845 tests); the member-index link and member-index callability behaviour are unit-tested in `constructor.test.ts > Rust associated constructor (member-index link)`, including a case proving the fallback does **not** fire without a `path_prefix` (the TS `new ClassName()` path), a `find_associated_constructor` null case, and the field-named-`new` callability guard.
- AC#5 (partial, by design) — the cluster's `Type::new()` / `Self::new()` **shapes** are reproduced as fixtures and verified end-to-end. Confirming the literal sqlx/tokio corpus rows flip from entry point to reachable — and that their `examples/`/`tests/` caller directories are within the corpus' indexed-file set (the epic's coverage precondition) — requires a corpus rerun outside this repo and remains the closing verification step, exactly as recorded for 349.1's AC#7.

## Review outcome

A multi-lens review (correctness ×2, contracts, completeness, IA, adversarial cold-read) surfaced one actionable finding: `find_associated_constructor` lacked the callability guard its sibling function-call member lookup already enforces, so a Rust field named `new` could shadow the `fn new` method. Fixed by rejecting non-callable hits. IA suggestions to extract the Self-substitution into `receiver_resolution.ts` were declined — the task explicitly directs reuse-and-export of `find_containing_class_scope`/`find_class_from_scope`, and the contracts review confirmed no circular import results. A `Self::new()`-in-a-trait-default-method edge was judged out of scope (AC#2 is "inside an `impl`").
