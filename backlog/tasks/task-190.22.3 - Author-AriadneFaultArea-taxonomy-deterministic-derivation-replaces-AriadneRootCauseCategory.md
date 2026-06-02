---
id: TASK-190.22.3
title: >-
  Author AriadneFaultArea taxonomy + deterministic derivation (replaces
  AriadneRootCauseCategory)
status: Done
assignee: []
created_date: "2026-06-01 14:18"
updated_date: "2026-06-01 14:48"
labels:
  - self-repair
  - schema
  - fault-taxonomy
dependencies:
  - TASK-190.22.1
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
  - packages/types/src/call_chains.ts
  - packages/types/src/entry_point.ts
  - packages/types/src/ariadne_root_cause.ts
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The `plan` engine (TASK-190.22.9) groups false-positives by "which part of Ariadne is at fault" and routes each fix to the right code area. This requires a standardised fault-area taxonomy. The key design decision: the fault area is a **DERIVED VIEW** over the deterministic signal Ariadne core already emits — NOT a new independently-stored enum. Phase 1 (190.22.1) stores `diagnosis` + `resolution_failure {stage,reason}` on each verdict; the area is **computed-on-read** from those by a pure total function. This is grounded entirely in existing code, adds no speculative stored field, and is refactor-safe (a core IA refactor edits only the folder-map, never stored data). It strictly refines and REPLACES the coarse 6-value `AriadneRootCauseCategory` (`packages/types/src/ariadne_root_cause.ts`) — a no-shim replacement, not a parallel taxonomy.

## The taxonomy — `AriadneFaultArea` (10 values + `other`), each anchored 1:1 to a core folder

- `syntactic_extraction` → `core/src/index_single_file/query_code_tree` (+ references/definitions extractors) — query/capture never produced the call site.
- `scope_construction` → `core/src/index_single_file/scopes` — malformed/missing scope tree (`no_enclosing_class_scope`, `definition_has_no_body_scope`, `no_parent_class`, `class_definition_not_found`).
- `name_resolution` → `core/src/resolve_references/name_resolution.ts` — in-scope name lookup failed (`name_not_in_scope`).
- `import_resolution` → `core/src/resolve_references/import_resolution` — cross-file import/re-export linking (`import_unresolved`, `reexport_chain_unresolved`).
- `receiver_type_inference` → `core/src/resolve_references/call_resolution/receiver_resolution.ts` + `type_preprocessing` — receiver/member type lost (`receiver_type_unknown`, `member_type_unknown`, `method_not_on_type`@receiver_resolution).
- `method_lookup` → `core/src/resolve_references/call_resolution/method_lookup.ts` (+ `constructor.ts`) — type known, member absent (`method_not_on_type`@method_lookup, `constructor_target_not_a_class`).
- `polymorphic_dispatch` → `method_lookup.ts` (`resolve_polymorphic_method`) — interface receiver, no implementations (`polymorphic_no_implementations`).
- `collection_dispatch` → `core/src/resolve_references/call_resolution/collection_dispatch.ts` — value-in-collection / dynamic key (`collection_dispatch_miss`, `dynamic_dispatch`).
- `coverage_config` → `core/src/project` — call sites live in excluded files (unindexed test dirs).
- `entry_point_classification` → `core/src/classify_entry_points` (+ `trace_call_graph`) — resolution succeeded but the function is still flagged (`callers-in-registry-wrong-target`, or genuine EP miss).
- `other` — **escape hatch from the taxonomy**; `needs_judgement`. Carries a required free-text `description` of the unclassified signal (the raw `(stage, reason)`/`diagnosis` that matched no folder-anchored area — e.g. a newer core version emitting a reason this types package does not yet know, or residual case 2). The `plan` phase (TASK-190.22.5) consumes the description to BOTH extend the taxonomy (add the missing folder-anchored area) AND plan the underlying fix.

## Derivation (TOTAL, deterministic) — key on `(stage, reason)`, NOT reason alone

CRITICAL correctness point (verified against emit sites): the same `reason` is emitted from multiple stages with different meaning — e.g. `method_not_on_type` → `receiver_type_inference` when stage=`receiver_resolution` but → `method_lookup` when stage=`method_lookup`; `name_not_in_scope` shares the `name_resolution` stage with the scope-construction reasons. So the primary table is `(stage, reason) → area` covering all 14 reasons. Fallback when `resolution_failure` is absent: `diagnosis → area` (`no-textual-callers`/`callers-in-registry-wrong-target` → `entry_point_classification`; `callers-not-in-registry` → `coverage_config` if callers only in unindexed tests, else `syntactic_extraction`). Precedence: `resolution_failure` (most specific) first, else `diagnosis`. Full per-cell table with emit-site line numbers is in the design spec (see references).

## Schema + placement

- New file `packages/types/src/ariadne_fault_area.ts` (next to its deterministic peers `call_chains.ts`/`entry_point.ts`). String-literal union (match existing convention), NOT branded enum. `area` is COMPUTED, never stored.
- `AriadneFaultLocation { area, resolution_stage?, resolution_reason?, language?, needs_judgement, description? }`. `description` is the escape-hatch free-text — required (non-empty) iff `area === "other"`, absent otherwise.
- `ARIADNE_FAULT_AREA_FOLDER: Record<AriadneFaultArea, string>` — SEPARATE refactor-safe lookup (repo-relative POSIX paths).
- `derive_fault_area(input): AriadneFaultLocation` — pure total function encoding the (stage,reason) table + diagnosis fallback; exhaustively type-checked against the source enums.
- Barrel export from `packages/types/src/index.ts`.

## Callers to update (no shims)

- `packages/types/src/backlog_task.ts:23` — `cluster_hint: AriadneRootCauseCategory` → `AriadneFaultArea`.
- Delete `packages/types/src/ariadne_root_cause.ts` once consumers move (it's strictly refined by the new taxonomy).
- `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts` — populate the two disambiguators (`has_uncaptured_indexed_grep_hit` from `GrepHit.captures`; `callers_only_in_unindexed_tests` from `grep_call_sites_unindexed_tests`) so the planner derives without re-grepping.
- Consumed by the `plan` engine (TASK-190.22.9): it derives the area per verdict at grouping time and routes groups to `ARIADNE_FAULT_AREA_FOLDER[area]`.

## Residual-judgement cases (deterministic default + `needs_judgement: true`; the plan strategist decides)

1. `callers-not-in-registry` with an indexed grep hit that HAS captures (ref produced but no CallReference reached registry) — default `syntactic_extraction`.
2. `callers-in-registry-unresolved` with NO `resolution_failure` (resolver returned empty without emitting a diagnostic — itself an Ariadne defect) — default `other`; file a task to add the missing emit.
3. `no-textual-callers` — genuine entry point vs true-positive classification miss — default `entry_point_classification`.
4. `collection_dispatch_miss` whose root cause is an upstream unresolved import — may re-route to `import_resolution`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `packages/types/src/ariadne_fault_area.ts` defines the 10-value (+`other`) `AriadneFaultArea` union, `AriadneFaultLocation`, and the `ARIADNE_FAULT_AREA_FOLDER` map (area→core folder, separate from the value list); barrel-exported
- [x] #2 `derive_fault_area` is a pure TOTAL function keyed on `(stage, reason)` (not reason alone) with a `diagnosis` fallback; exhaustively covers all 14 `ResolutionFailureReason` values and all 4 `diagnosis` values; unit-tested per cell with the documented expected area
- [x] #3 `area` is computed-on-read, never stored; the only stored fault signal remains the deterministic `diagnosis` + `resolution_failure` (from 190.22.1)
- [x] #4 `AriadneRootCauseCategory` is replaced: `backlog_task.ts` `cluster_hint` uses `AriadneFaultArea`, `ariadne_root_cause.ts` is deleted, all consumers updated (no shim/alias)
- [x] #5 `extract_entry_point_diagnostics.ts` populates the two disambiguator signals (`has_uncaptured_indexed_grep_hit`, `callers_only_in_unindexed_tests`) the fallback derivation needs
- [x] #6 The 4 residual-judgement cases return their documented default with `needs_judgement: true`; a test asserts the flag is set for each
- [x] #7 `pnpm typecheck && pnpm test` green; the derivation table type-checks exhaustively against the source enums (a new reason/stage forces a compile error until mapped)
- [x] #8 `other` is a true escape hatch: `derive_fault_area` accepts the raw `(stage, reason, diagnosis)` strings and, when the signal matches no known enum value (malformed/forward-incompatible data) OR hits residual case 2, returns `area: "other"` with `needs_judgement: true` and a non-empty `description` quoting the unmatched signal; a test asserts the `description` is populated for both an unknown-reason input and the residual case-2 input
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

**Why this exists.** The `plan` engine groups triage false-positives by "which part of Ariadne is at fault" and routes each fix to the owning core folder. That demands a single, standardised fault taxonomy. The key design decision — settled in the restructure plan — is that the fault area is a **derived view** over the deterministic signal core already emits (`diagnosis` + `resolution_failure {stage, reason}`), not a new independently-stored enum. Nothing speculative is persisted; the area is computed-on-read by a pure total function, so a future core IA refactor edits only a folder lookup, never stored data.

**The approach.** A new `packages/types/src/ariadne_fault_area.ts` defines the `AriadneFaultArea` string-literal union (folder-anchored areas + `other`), a separate refactor-safe `ARIADNE_FAULT_AREA_FOLDER` map (area → repo-relative core path), the `AriadneFaultLocation` result shape, and `derive_fault_area` — a pure total function. The derivation keys on **`(stage, reason)`**, not `reason` alone, because `method_not_on_type` means receiver-type inference at the `receiver_resolution` stage but member lookup at the `method_lookup` stage. A grep of all 30 core emit sites confirms `method_not_on_type` is the **only** reason whose *area* depends on the stage — several reasons (`name_not_in_scope`, `no_parent_class`, `collection_dispatch_miss`) fire from more than one stage, but every stage maps to the same area, so reason-keying is correct for them. The primary table is a `Record<ResolutionFailureReason, AriadneFaultArea>` exhaustive over all 14 reasons (adding a reason *in code* is a compile error until mapped); when `resolution_failure` is absent it falls back to a `diagnosis`-keyed branch consulting two disambiguator booleans. This strictly refines and **replaces** the coarse 6-value `AriadneRootCauseCategory`, which is deleted with no shim.

**The `other` escape hatch.** `derive_fault_area` accepts the *raw* `(stage, reason, diagnosis)` strings as they arrive from disk. Known enum values flow through the exhaustive tables; a signal that matches no known value — malformed data, or a newer core version emitting a reason/stage this types package does not yet know — falls to `area: "other"` with `needs_judgement: true` and a required free-text `description` quoting the unmatched signal. This is the self-extending seam: the `plan` phase (TASK-190.22.5, downstream) reads that `description` to both propose extending the taxonomy with the missing folder-anchored area and plan the underlying fix. This task owns only the data shape and deterministic population; the plan-phase behavior is out of scope.

**What changes, at altitude.**

- New `ariadne_fault_area.ts` owns the taxonomy, the folder map, and `derive_fault_area`; barrel-exported from `packages/types/src/index.ts`.
- `extract_entry_point_diagnostics.ts` stamps two disambiguator signals onto `EntryPointDiagnostics` — `has_uncaptured_indexed_grep_hit` (from `GrepHit.captures`) and `callers_only_in_unindexed_tests` (recomputed in the async `attach_unindexed_test_grep_hits` pass, where both grep arrays are final) — so the fallback derivation reads them instead of re-grepping. The inline `diagnosis` union is extracted to a named `EntryPointDiagnosis` type so the derivation's exhaustiveness tracks the source.
- `AriadneRootCauseCategory` is removed: `ariadne_root_cause.ts` is deleted and every consumer (`backlog_task.ts` `cluster_hint`, the curator's `types.ts`/`get_investigate_context.ts`/`validate_investigate_responses.ts`, and the `triage-curator-investigator` agent's closed-set prompt) moves to `AriadneFaultArea` and its `ARIADNE_FAULT_AREAS` / `is_ariadne_fault_area` peers — no shim.

**How to navigate.** Start at `ariadne_fault_area.ts`: the union + folder map at the top read as the spec, `derive_fault_area` below encodes the `(stage, reason)` table then the `diagnosis` fallback. The four residual-judgement cases all return a deterministic default plus `needs_judgement: true` and are pinned by per-cell tests in `ariadne_fault_area.test.ts`. Within the fallback, the coverage-gap signal (`callers_only_in_unindexed_tests`) is checked **before** the diagnosis switch: callers confined to excluded dirs surface as `no-textual-callers` (the indexed grep finds nothing), so routing on the diagnosis alone would misread a coverage gap as a genuine entry point — the multi-agent review caught this and the signal now wins, making `coverage_config` reachable.

**What to watch.** The taxonomy enumerates **10** folder-anchored areas + `other` (the Description's "9 + other" count is a stale prose miscount — every listed area is a needed derivation target, so all are implemented). The `area` is never stored; the only persisted fault signal remains `diagnosis` + `resolution_failure`. `ARIADNE_FAULT_AREA_FOLDER` values are repo-relative paths to the owning module (a file for the call-resolution areas, a folder elsewhere); the `description`-iff-`other` invariant is enforced by funnelling every `other` return through one `other_location` helper and pinned by tests.

<!-- SECTION:NOTES:END -->
