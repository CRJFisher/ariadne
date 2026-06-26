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

A Rust qualified-path call (`worker::create(7)`, `crate::runtime::Driver::start(8)`, `Parker::make(5)`) is emitted with `name` set to the _entire scoped path text_, and `Type::new()` associated constructors are emitted with `name` = the full path and **no `property_chain`**. Phase-1's scope map only ever holds bare terminal names (`create`, `Driver`, `make`), so every multi-segment / turbofish / `Self` form misses. This is the largest population in the group (56 members, Rust-heavy + one TS static row). The correct altitude is the **reference builder**, where the `name` is first assigned — not Phase-1, which is being asked to resolve a name that does not exist.

This is one coherent change, not 56 independent localized fixes.

## Producer edits

- **`index_single_file/query_code_tree/metadata_extractors/metadata_extractors.rust.ts`** — extend `extract_call_name` to return the terminal `name` for a bare `scoped_identifier` (the `path: … name: (identifier)` field); it currently returns `undefined` for that node (`metadata_extractors.rust.ts:766`). Add a path-prefix extractor that returns the leading segments with turbofish (`::<…>`) stripped. This is the load-bearing edit.
- **`index_single_file/references/references.ts`** — in the `FUNCTION_CALL` and `CONSTRUCTOR_CALL` branches, when the node is a `scoped_identifier` (or `constructor.associated`), set `name` to the terminal identifier and attach the leading segments as a `property_chain`. Remove the `capture.text` full-path fallback (`references.ts:563`) for Rust qualified calls.

## Data-model edits (additive; no schema bump per project memory)

- Add `property_chain` to Rust `function_call` references (mirrors `MethodCallReference.property_chain`).
- Populate `property_chain` on Rust associated `constructor_call` references (currently always `null` for `Type::new()`), carrying the type path.

## Consumer edits

- **`call_resolution/constructor.ts`** (`resolve_constructor_call`, line 47) — consume the new `property_chain`: when present, resolve the leading type path against the in-scope module/type/alias and look up the terminal type, symmetric to the existing TS `property_chain` namespace branch (lines 56-67). Add `Self` substitution to the enclosing impl type (bind `Self` in each impl/trait scope to the enclosing type's `SymbolId`, or special-case `name === "Self"` at the constructor resolver).
- **`call_resolution/function_call.ts`** (`resolve_function_call`, line 129) — when the bare terminal name does not resolve, consult the path-prefix `property_chain` to scope the lookup (module-qualified `worker::create`, type-qualified `Parker::make`).
- `function_call.ts`/`method_call.ts` need no edit for the common case where the terminal name is uniquely in scope — the function-call resolver already resolves `ref.name` via the scope map.

## Collision safety

Resolution proceeds in two tiers: (1) bare terminal name in the scope map, used only when the terminal name is **unambiguous**; (2) path-prefix scoping otherwise. The terminal name alone is not a safe global key (two types can both define `new`); the retained path-prefix is the disambiguating guard and must be enforced, not assumed. Alias hops (`ll::Semaphore`, `time_alt::Timer`, type/cfg aliases) ride on tier-2 but additionally require the leading segment to resolve through a `use`/type alias — if the alias is itself a cross-file re-export, that hop is `import_resolution`, so verify the alias target is in the same crate before assuming this change covers it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `build_index_single_file` on inline Rust asserts each qualified call emits the terminal `name` plus the expected path-prefix `property_chain`: `worker::create` → name `create`, chain `["worker"]`; `crate::runtime::Driver::new` → constructor name `Driver`, chain `["crate","runtime","Driver"]`; `Cell::<u8>::new` → name `Cell`, turbofish stripped.
- [ ] #2 `Self::new` resolves to the enclosing impl/trait type's `new`.
- [ ] #3 `Project` + `update_file` cross-file: `Parker::new`, `worker::create`, and `crate::…::Driver::new` resolve to their definitions.
- [ ] #4 Tier-1 bare-terminal lookup short-circuits only when the terminal name is unambiguous in scope; an ambiguous terminal (two in-scope types defining `new`) is disambiguated via the path-prefix tier-2 lookup.
- [ ] #5 All existing `metadata_extractors.rust.test.ts` `extract_call_name`/`extract_property_chain` cases stay green.

<!-- AC:END -->
