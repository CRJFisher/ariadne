---
id: TASK-190.16.2
title: Add receiver_kind and syntactic_features to CallReference
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
  - packages/types/src/call_chains.ts
  - packages/core/src/index_single_file/references/references.ts
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase A2.

The auto-classifier needs to distinguish method calls on direct identifiers from calls on call-chains, index accesses, and type casts without re-walking the AST. `references.ts:determine_reference_kind` already has the tree-sitter node in hand but collapses the distinction.

Add two fields to `CallReference`:

```typescript
type ReceiverKind =
  | "none"
  | "identifier"
  | "self_keyword"
  | "member_expression"
  | "call_chain"
  | "index_access"
  | "type_cast"
  | "parenthesized"
  | "new_expression";

interface SyntacticFeatures {
  is_new_expression: boolean;
  is_super_call: boolean;
  is_optional_chain: boolean;
  is_awaited: boolean;
  is_callback_arg: boolean;
  is_inside_try: boolean;
  is_dynamic_dispatch: boolean;
}
```

Populate both at index time in `packages/core/src/index_single_file/references/references.ts`. These are the signals that classifiers for F1 (aliased receiver), F3 (inline constructor chain), and F9 (dynamic dispatch) will key off.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `ReceiverKind` and `SyntacticFeatures` types defined in `packages/types/src/call_chains.ts`
- [ ] #2 Every `CallReference` carries both fields, populated at index time from the tree-sitter node
- [ ] #3 Tests cover each `ReceiverKind` variant across at least TypeScript and Python
- [ ] #4 Tests cover each `SyntacticFeatures` flag (at least one positive + one negative case per flag)
<!-- AC:END -->
