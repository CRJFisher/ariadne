---
id: TASK-190.16.3
title: Expose call-site introspection APIs from @ariadne/core
status: Done
assignee: []
created_date: "2026-04-17 14:37"
labels:
  - self-repair
  - auto-classifier
  - ariadne-core
  - introspection
dependencies:
  - TASK-190.16.2
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - packages/core/src/index.ts
  - packages/core/src/index_single_file/query_code_tree/query_code_tree.ts
  - packages/core/src/index_single_file/query_code_tree/query_loader.ts
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase A3.

Expose two introspection APIs from `@ariadne/core` so the auto-classifier and the curator skill can query resolver state directly rather than inferring it from indirect evidence:

- `explain_call_site(file, line)` — returns `{ capture_fired, receiver_kind, resolution_failure?, candidate_definitions, import_trace? }`.
- `list_name_collisions(name)` — returns all definitions sharing a name (used by the F10 collision classifier).

Also export the tree-sitter query primitives the classifier will reuse:

```typescript
export { query_tree } from "./index_single_file/query_code_tree/query_code_tree";
export { LANGUAGE_TO_TREESITTER_LANG } from "./index_single_file/query_code_tree/query_loader";
```

Library-only exposure; MCP tool wrappers are deferred. Depends on the `resolution_failure` and `receiver_kind` fields being populated, but does not depend on `call_resolver.ts` signature changes.

### Facts-only principle

These APIs are strictly factual: they return what the resolver observed and what the AST looks like. They never return classifier verdicts, F-codes, `group_id` suggestions, or registry lookups. If the curator needs an additional neutral signal (e.g., "was this imported from a declared-types-only module?"), extend the return shape with that fact; never add a field that encodes skill-layer taxonomy. The rule: any field that would need to change when the skill's registry changes is wrong-shaped and belongs in the skill.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `packages/core/src/introspection/` module exists with `explain_call_site.ts` and `list_name_collisions.ts`
- [x] #2 Both functions exported from `packages/core/src/index.ts`
- [x] #3 `query_tree` and `LANGUAGE_TO_TREESITTER_LANG` exported from `packages/core/src/index.ts`
- [x] #4 Unit tests cover happy path + at least 3 failure cases for `explain_call_site`
- [x] #5 Unit tests cover name-collision detection across files
- [x] #6 `explain_call_site()` return shape matches exactly `{ capture_fired, receiver_kind, resolution_failure?, candidate_definitions, import_trace? }`
<!-- AC:END -->

## Implementation Notes

- `ExplainCallSiteResult` fields are all `readonly`; optional fields are omitted entirely when absent (not set to `undefined`) to match the resolver's zero-overhead convention.
- `find_call_at` picks the leftmost call on a line deterministically when no column is supplied. Two known limits documented on the API docstring: chained calls are not individually addressable by `(line, column)` (inner and outer share start position); `ResolutionFailureReason` values surfaced through this API are a subset of the full union (deep reasons short-circuit to `name_not_in_scope`).
- TASK-205 was created during delivery to track the `project.<field>.<method>()` receiver-resolution gap that surfaced when whitelisting the two new registry methods.
- Skill-level documentation of the API caveats is scheduled into TASK-190.16.9 AC #4 (`reference/signal_inventory.md` "Known API caveats" subsection).
