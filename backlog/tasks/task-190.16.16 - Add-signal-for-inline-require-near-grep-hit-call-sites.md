---
id: TASK-190.16.16
title: Add signal for inline `require()` near grep-hit call sites
status: Done
assignee: []
created_date: '2026-04-22 14:01'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `require-indirection` false-positive group covers JS symbols whose callers reach them exclusively through inline `require()` expressions inside function bodies (e.g. `lib/EntryOptionPlugin.js:88` does `const EnableWasmLoadingPlugin = require("./wasm/EnableWasmLoadingPlugin"); EnableWasmLoadingPlugin.checkEnabled(...)` two lines later). Ariadne only resolves top-level module imports, not inline requires, so the call edge is never created and the target looks unreachable.

Discriminating this group specifically (not just as a subset of the broader `callers-outside-scope-strict-grep-evidence` rule) requires a new signal that answers: "for a grep hit at `{file, line}`, does the same file contain `require(<relative-path-of-defining-file>)` within N lines above the hit (or anywhere in the enclosing function body)?" This signal is not expressible in the current predicate DSL, nor in the closed `SIGNAL_CHECK_OPS` union used by builtin classifier specs — `grep_line_regex` only sees a single hit's `content`, and there is no cross-line or enclosing-scope lookup.

Concrete proposal: add a new SignalCheck op (tentatively `grep_hit_neighbourhood_matches`) that takes a `pattern: string` and a `window: number` (lines of context above the hit) and matches when the pattern is present in any of the `window` lines preceding each grep hit. Rendered behaviour: the runtime reads the hit file and scans `[line - window, line)` for the pattern. With this op, a `require-indirection` classifier would read `{ op: "grep_hit_neighbourhood_matches", pattern: "require\\([\"']\\.\\.?/.*<basename>[\"']\\)", window: 5 }` (where `<basename>` is substituted from the entry's `file_path`) combined with `diagnosis_eq: callers-not-in-registry` and `language_eq: javascript`.

Until this signal exists the group's members fall through to `callers-outside-scope-strict-grep-evidence` (builtin `callers_not_in_registry_with_grep`, precision 0.952). That is acceptable as a broad fallback but loses the specific root-cause tag `require-indirection` — which is the tag an upstream Ariadne fix (teaching the resolver about inline requires) would target.

Confirmed entries (all four):
- lib/wasm/EnableWasmLoadingPlugin.js:65 `checkEnabled` — called at lib/EntryOptionPlugin.js:90 preceded by inline `require("./wasm/EnableWasmLoadingPlugin")` on line 88.
- lib/node/ReadFileCompileAsyncWasmPlugin.js:40 `apply` — instantiated at lib/wasm/EnableWasmLoadingPlugin.js:124-130 preceded by inline `require("../node/ReadFileCompileAsyncWasmPlugin")` on line 124; also a lazy getter in lib/index.js:572-574.
- lib/optimize/ModuleConcatenationPlugin.js:63 `apply` — instantiated at lib/WebpackOptionsApply.js:619 preceded by inline `require("./optimize/ModuleConcatenationPlugin")` on line 617; also a lazy getter in lib/index.js:494-496.
- lib/electron/ElectronTargetPlugin.js:28 `apply` — instantiated at lib/WebpackOptionsApply.js:{182,188,194,204} each preceded by an inline `require("./electron/ElectronTargetPlugin")`; also a lazy getter in lib/index.js:578-580.

## Implementation notes

- Op carries `{pattern: string; window: number}`; both validators (curator + registry) reject `window <= 0`, and the registry validator pre-compiles `pattern`. Window arithmetic is `[h.line - window, h.line - 1]` 1-based inclusive — the hit line itself is excluded.

## Reviewer follow-ups (applied)

- `validate_investigate_responses` now pre-compiles regex patterns for `grep_line_regex`, `decorator_matches`, `file_path_matches`, `name_matches`, and `grep_hit_neighbourhood_matches` so authoring-time errors surface immediately rather than at registry-load.
- Renderer hoists `new RegExp(...)` out of the per-line inner loop in the rendered builtin (and out of the per-hit `.some(...)` callback for `grep_line_regex`).
- Predicate evaluator gains explicit boundary tests: top-of-file (window dwarfs the available lines, exercising `Math.max(0, ...)`) and missing-file (the hit's file is absent from `lines_by_file`).
<!-- SECTION:DESCRIPTION:END -->
