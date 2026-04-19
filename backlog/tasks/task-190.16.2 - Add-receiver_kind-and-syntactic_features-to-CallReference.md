---
id: TASK-190.16.2
title: Add call_site_syntax to CallReference
status: To Do
assignee: []
created_date: "2026-04-17 14:37"
labels:
  - self-repair
  - auto-classifier
  - indexer
  - ariadne-core
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - /Users/chuck/.claude/plans/read-backlog-tasks-task-190-16-2-add-rec-frolicking-meerkat.md
  - packages/types/src/call_chains.ts
  - packages/types/src/symbol_references.ts
  - packages/core/src/index_single_file/references/references.ts
  - packages/core/src/resolve_references/call_resolution/call_resolver.ts
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan references: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` (Phase A2) and the refined plan at `~/.claude/plans/read-backlog-tasks-task-190-16-2-add-rec-frolicking-meerkat.md`.

The auto-classifier needs to distinguish method calls on direct identifiers from calls on call-chains, index accesses, and type casts without re-walking the AST. This task adds the *syntactic* signals a classifier keys off — paired with `CallReference.resolution_failure` (TASK-190.16.1) which carries the *resolver-state* signal.

### Schema

Add to `packages/types/src/call_chains.ts`:

```typescript
/**
 * Syntactic shape of a method-call receiver.
 * Populated only when call_type === "method" (absent for function / constructor
 * calls — those are already discriminated by call_type).
 * Closed union — new variants force a types-package bump so classifiers stay
 * exhaustive, mirroring ResolutionFailureReason.
 */
export type ReceiverKind =
  | "identifier"          // obj.m()
  | "self_keyword"        // this.m() / self.m() / super.m()
  | "member_expression"   // a.b.m()
  | "call_chain"          // foo().m() — see receiver_call_target_hint
  | "index_access"        // arr[k].m() — see index_key_is_literal
  | "type_cast"           // (x as T).m() — TS only
  | "parenthesized"       // (expr).m()
  | "non_null_assertion"; // x!.m() — TS only

/**
 * Call-site syntactic context. Two discriminators accompany `receiver_kind`,
 * populated only when they disambiguate a known failure mode:
 *   - receiver_call_target_hint → separates F3 (inline `SubClass().m()`)
 *     from F2 (factory return type unknown, `foo().m()`).
 *   - index_key_is_literal → separates resolvable literal-key dispatch from
 *     F9 (dynamic-key dispatch).
 */
export interface CallSiteSyntax {
  readonly receiver_kind: ReceiverKind;
  readonly receiver_call_target_hint?: "class_like" | "function_like" | "unknown";
  readonly index_key_is_literal?: boolean;
}
```

Extend `CallReference` with `readonly call_site_syntax?: CallSiteSyntax` — present iff `call_type === "method"`.

### Where to populate

Compute at index time in `packages/core/src/index_single_file/references/references.ts` via a new language-agnostic helper `extract_call_site_syntax(node)`. Attach to the `MethodCallReference` variant (`packages/types/src/symbol_references.ts`) during the `METHOD_CALL` branch of `ReferenceBuilder.process`. Copy onto the emitted `CallReference` in `build_call_reference` (`call_resolver.ts:325`). No new `MetadataExtractors` method — all logic keys off `node.type` literals in one file.

Reuse existing extractor outputs — `receiver_info.is_self_reference/self_keyword` already maps `"self_keyword"`; `property_chain` length + inner type distinguishes `identifier` / `member_expression` / `call_chain`.

### Out of scope (explicit)

- **Axis A (tree-sitter capture gaps):** no `CallReference` is produced, so this schema is load-bearing only for Axis B.
- **F4 (Python `module.func()`):** requires `receiver_resolves_to_import_kind` on `resolution_failure.partial_info` — part of the Phase A1 / TASK-190.16.1 surface, not here.
- **F7 (polymorphic dispatch):** already covered by `resolution_failure.reason === "polymorphic_no_implementations"`.
- **F10 (global name collision):** separate signal (`resolutions.length > 1` + cross-file derivation).

### What was removed from the original proposal

`SyntacticFeatures` (flat 7-boolean record) was dropped entirely. Every flag either duplicated existing fields (`is_optional_chain` on `MethodCallReference`; `is_super_call` via `SelfReferenceCall.keyword`; `is_new_expression` via `call_type`; `is_callback_arg` via `CallReference.is_callback_invocation`) or had no initial-10 classifier keying off it (`is_awaited`, `is_inside_try`). `is_dynamic_dispatch` was replaced by `index_key_is_literal`, which is what the F9 classifier actually needs. `ReceiverKind.none` and `"new_expression"` were dropped for redundancy with `call_type`; `"non_null_assertion"` was added to keep TS `x!.m()` out of the `"identifier"` bucket.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `ReceiverKind` (8 variants) and `CallSiteSyntax` defined in `packages/types/src/call_chains.ts` with exhaustive-match doc comments
- [ ] #2 `MethodCallReference` in `packages/types/src/symbol_references.ts` carries `call_site_syntax?: CallSiteSyntax`
- [ ] #3 `CallReference.call_site_syntax` populated at resolver time iff `call_type === "method"`; undefined otherwise
- [ ] #4 Population logic lives in a single `extract_call_site_syntax(node)` helper in `references.ts`; no new `MetadataExtractors` method added
- [ ] #5 Tests cover each `ReceiverKind` variant in TypeScript (all 8) and Python (6 — no `type_cast` / `non_null_assertion`)
- [ ] #6 Tests cover `receiver_call_target_hint` (3 cases × 2 languages) and `index_key_is_literal` (3 cases × 2 languages)
- [ ] #7 `pnpm -C packages/types build && pnpm -C packages/core build && pnpm -C packages/core test` passes
<!-- AC:END -->
