---
id: TASK-190.17.12
title: >-
  triage-curator: update `render_classifier.ts` emitted strings; bulk re-render
  builtins
status: To Do
assignee: []
created_date: "2026-04-28 19:18"
updated_date: "2026-04-28 19:30"
labels:
  - triage-curator
  - skill-retarget
  - codegen
dependencies:
  - TASK-190.17.6
  - TASK-190.17.11
parent_task_id: TASK-190.17
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

The triage-curator's `render_classifier.ts` is a code generator: it emits TypeScript source for newly-authored builtin classifiers. Today it emits an `import type { EnrichedFunctionEntry } from "../../entry_point_types.js"` string into every generated file. That string is part of a _core public contract_ now — the rendered file lives in `packages/core/src/classify_entry_points/builtins/`.

This sub-sub-task updates the renderer and bulk-regenerates every existing classifier so they all use the new import.

## Renderer changes

`.claude/skills/triage-curator/src/render_classifier.ts:47,87`:

- Line 47 (the rendered import statement): change from `import type { EnrichedFunctionEntry } from "../../entry_point_types.js"` to `import type { EnrichedEntryPoint } from "@ariadnejs/types"`.
- Line 87 (the rendered function signature): change from `entry: EnrichedFunctionEntry` to `entry_point: EnrichedEntryPoint` (also picks up the `entry → entry_point` rename from `.1`).

## Test updates

`.claude/skills/triage-curator/src/render_classifier.test.ts:51,54` — update literal-string assertions to match the new emitted output:

```ts
expect(src).toContain(
  'import type { EnrichedEntryPoint } from "@ariadnejs/types"'
);
expect(src).toContain("entry_point: EnrichedEntryPoint,");
```

## Bulk re-render

After `.5` and `.11` land, every `auto_classify/builtins/check_*.ts` file (now in `packages/core/src/classify_entry_points/builtins/`, ~60-90 files) has the old import string. Two options:

1. **Re-run `render_classifier`** over every existing registry rule. Most reliable.
2. **Codemod** the import string + parameter type across all files. Faster; equivalent result if the renderer is idempotent.

Pick option 1 — it's deterministic and any drift becomes immediately visible via `git diff` on subsequent runs.

## Verification

- `pnpm test` passes in `.claude/skills/triage-curator/` (literal-string assertions match).
- `pnpm build` passes in `packages/core/` (every regenerated `check_*.ts` compiles with the new import).
- Spot-check a representative `check_*.ts` and confirm it imports `EnrichedEntryPoint` from `@ariadnejs/types`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 render_classifier.ts:47 emits import type { EnrichedEntryPoint } from "@ariadnejs/types"
- [ ] #2 render_classifier.ts:87 emits entry_point: EnrichedEntryPoint parameter
- [ ] #3 render_classifier.test.ts:51,54 literal-string assertions updated
- [ ] #4 Every existing builtins/check\_\*.ts file (~60-90) regenerated via render_classifier
- [ ] #5 All regenerated check\_\*.ts files compile cleanly via tsc
- [ ] #6 pnpm test passes in .claude/skills/triage-curator/
- [ ] #7 pnpm build passes in packages/core/
- [ ] #8 CI step compiles every regenerated check\_\*.ts after sync-permanent-rules to catch render-classifier rewrite drift (mitigates Risk 6)
<!-- AC:END -->
