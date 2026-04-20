---
id: TASK-190.16.1
title: Add resolution_failure diagnostic to CallReference
status: Done
assignee: []
created_date: "2026-04-17 14:37"
labels:
  - self-repair
  - auto-classifier
  - resolver
  - ariadne-core
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - packages/types/src/call_chains.ts
  - packages/core/src/resolve_references/call_resolution/call_resolver.ts
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
  - packages/core/src/resolve_references/call_resolution/method_lookup.ts
  - packages/core/src/resolve_references/call_resolution/function_call.ts
  - packages/core/src/resolve_references/call_resolution/method_call.ts
  - packages/core/src/resolve_references/call_resolution/constructor.ts
  - packages/core/src/resolve_references/call_resolution/collection_dispatch.ts
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase A1.

The resolver internally distinguishes many failure modes (name out of scope, import chain walked to a dead end, method lookup missed on a known type, …) but currently collapses them all to `null`/`[]` at the boundary: `call_resolver.ts:281`, `receiver_resolution.ts:{133,169,288}`, `method_lookup.ts:{96,118}`, `function_call.ts:{39-77}`, `method_call.ts:{77-81}`, `constructor.ts:{71,78}` all return with no trace.

Capturing the `(stage, reason, partial_info)` triple at each null-return site exposes the resolver's own state as a typed diagnostic. Downstream consumers — including the auto-classifier planned in Phase C, `explain_call_site()` from Phase A3, and any future introspection tooling — read this diagnostic; none re-implement the resolver's reasoning. **The enum names what the resolver observed, never what a classifier concludes.**

Extend `CallReference` in `packages/types/src/call_chains.ts` with an optional `resolution_failure: ResolutionFailure` field populated only when `resolutions.length === 0`. Refactor the resolver's return type from `SymbolId[]` to `Result<SymbolId[], ResolutionFailure>` so every null-return site must name its failure — this yields compile-time coverage of the reason enum and avoids drift as new resolution paths land.

```typescript
interface ResolutionFailure {
  stage:
    | "name_resolution"
    | "receiver_resolution"
    | "method_lookup"
    | "import_resolution"
    | "type_inference";
  reason:
    | "name_not_in_scope"
    | "import_unresolved"
    | "reexport_chain_unresolved"
    | "receiver_type_unknown"
    | "receiver_type_is_primitive"
    | "method_not_on_type"
    | "polymorphic_no_implementations"
    | "collection_dispatch_miss"
    | "dynamic_dispatch"
    | "receiver_is_external_import";
  partial_info: {
    resolved_receiver_type?: SymbolId;
    import_target_file?: FilePath;
    last_known_scope?: ScopeId;
  };
}
```

No backwards-compatibility hedging — change the resolver signature and update all callers.

**Sequencing:** This is the largest single change in the initiative and enables most of Phase C. Land it as its own independent PR before the downstream phases. The `Result<SymbolId[], ResolutionFailure>` refactor touches every resolver null-return site (`call_resolver.ts:281`, `receiver_resolution.ts:{133,169,288}`, `method_lookup.ts:{96,118}`, `function_call.ts:{39-77}`, `method_call.ts:{77-81}`, `constructor.ts:{71,78}`, `collection_dispatch.ts`).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `ResolutionFailure` type exported from `packages/types/src/call_chains.ts`
- [x] #2 Resolver functions return `Result<SymbolId[], ResolutionFailure>`; every null-return site names a specific stage + reason
- [x] #3 Every existing resolver test still passes; added tests cover at least one entry per reason enum value
- [x] #4 `CallReference.resolution_failure` is populated on resolution failure and absent on success (zero memory overhead for the common case)
- [x] #5 No call site has a `// TODO: resolution_failure` or similar placeholder — enum coverage is compile-time-enforced
<!-- AC:END -->
