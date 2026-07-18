---
id: TASK-362.10
title: >-
  Harden the file-naming hook: language sub-folder block, generic-name denylist,
  drop go/java
status: Done
assignee: []
created_date: "2026-07-05 11:39"
labels:
  - information-architecture
  - claude-customisation
  - enforce
dependencies: []
parent_task_id: TASK-362
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). This is an **enforce-layer** task — deterministic checks added to the existing file-naming hook. Zero always-on context: all checks are in-process additions to an already-firing hook.

Extend `.claude/hooks/file_naming.ts` (shared by the PreToolUse validator `file_naming_validator.ts` and the Stop audit `file_naming_validator_stop.ts`) with three deterministic checks, and update the paired rule doc.

### 1. Language sub-folder block

Add `LANGUAGE_FOLDER_SEGMENTS` (the language keywords) and `validate_no_language_folder(parts)` called from `validate_src_file` BEFORE the per-filename checks. Block any directory segment (excluding the filename) that exactly equals a language keyword — e.g. `call_resolution/python/foo.ts` — with a message prescribing the dotted-suffix alternative (`<feature>.python.ts` in the parent folder). Ensure the `EXTRACTOR_DIRS` shared-base branch is evaluated first so `extractors/` paths still pass.

### 2. Generic-name denylist

Add `BLOCKED_GENERIC_BASENAMES = {utils.ts, types.ts, common.ts, errors.ts, helpers.ts, constants.ts, analytics.ts, misc.ts, shared.ts}`, checked first in `validate_src_file`, exempting `index.ts` and `*.test.ts`. Block message prescribes concept naming and cites `.claude/rules/file-naming.md`. Do NOT extend the denylist to `.claude/` paths (review ruling — the denylist is for `packages/*/src`).

### 3. Trim LANGUAGES

Reduce `LANGUAGES` to `[typescript, javascript, python, rust]` (go/java are YAGNI surplus that currently make `foo.go.ts` a valid name), and fix `file-naming.md`'s supported-languages line to match `language-patterns.md`. Re-add is one line if support ever lands.

### 4. Tests

Create `.claude/hooks/file_naming.test.ts` (none exists) asserting: each banned basename blocks and a concept name passes; a language sub-folder path blocks; an `extractors/` shared-base path passes; `.go.ts`/`.java.ts` names no longer validate (adjust any existing assertions to the four-language set).

### 5. Rule doc

In `.claude/rules/file-naming.md` add ~12 terse lines under a Naming Philosophy heading: a name must be fully true (describe ALL content; split into precisely-named leaves when it stops being true); `{folder}/{folder}.ts` is reserved for the folder's main implementation (a store/sub-step never claims the folder name, e.g. a `ResolutionRegistry` store is `resolution_registry.ts`); the banned-category list (same closed set as the hook); and fix the stale `file_naming_validator.cjs` reference to `.ts`.

**Sequencing:** the language sub-folder block, the go/java trim, and their tests are independent and can land immediately. The generic-name denylist requires the existing offenders (`packages/types/src/common.ts`, `packages/types/src/errors.ts`, `packages/skill-fs/src/errors.ts`, `packages/core/.../scopes/utils.ts`) to be renamed to concept names first or in the same change — coordinate with 362.5 (types package) and 362.8 (hygiene sweep). No grandfathering per the constitution.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 file_naming.ts blocks language-named sub-folders (e.g. call_resolution/python/) while extractors/ shared-base paths still pass
- [x] #2 generic basenames (utils/types/common/errors/helpers/constants/analytics/misc/shared .ts) are blocked outside index.ts and \*.test.ts
- [x] #3 LANGUAGES is [typescript,javascript,python,rust]; .go.ts/.java.ts no longer validate; file-naming.md matches
- [x] #4 new .claude/hooks/file_naming.test.ts covers every added check
- [x] #5 file-naming.md states name-fully-true and {folder}.ts-is-the-main-impl, and the .cjs reference is fixed to .ts
<!-- AC:END -->

## Implementation Notes

## High-level summary

The file-naming hook now enforces three rules it previously only documented:
a directory below `src/` may not be named after a language, a filename may not
be a bare category name, and a dotted language part must name a language whose
suffix the hook accepts. Both hook entry points — the PreToolUse validator that
gates every Write and Edit, and the Stop audit that sweeps the workspace at
session end — share the checks, so a name is rejected at the moment it is typed
and again if it reaches the tree by another route.

The language lists are two lists because they answer opposite questions.
`LANGUAGES` is the accept list: the four languages whose `{module}.{language}.ts`
suffix is valid. `LANGUAGE_NAMES` is every token that names a language, and
`UNSUPPORTED_LANGUAGES` is derived by subtracting one from the other. That
derivation is load-bearing rather than tidy. `LANGUAGES` drives both accept and
reject decisions in the pre-existing validators, so trimming it alone does not
make `.go.ts` invalid — it makes `go` unrecognized, and an unrecognized dotted
part reads to the generic two-part submodule pattern as an ordinary aspect.
Measured against the pre-change hook, a bare trim leaves `foo.go.ts` and
`module.go.test.ts` valid and newly *legalizes* `go.ts` and `go.imports.ts`,
which were blocked. Deriving the reject list also makes adding a language a
single edit: appending to `LANGUAGES` removes it from `UNSUPPORTED_LANGUAGES` in
the same stroke, so the two can never disagree about whether a language is
supported.

Ordering carries meaning. The directory rule runs ahead of every filename rule,
including the extension gate, because it judges a path rather than a name: the
`.scm` query files are the artifact most likely to attract a per-language
folder, and an allowlisted extension must not exempt the path that holds it.
Among the filename rules the generic-name check runs first, because a rename is
the cheaper fix to surface when a name violates both. The generic check matches
the stem before the first dot, so `types.d.ts` and `utils.python.ts` are caught
alongside the plain forms, and language-folder matching folds case, because
`Python/` and `python/` are one directory on a case-insensitive filesystem.

A block message only ever recommends a name this validator accepts, and it
earns that by construction rather than by case analysis: the remedy builds the
candidate — the language moved into a dotted suffix ahead of any test suffix,
in the parent folder — and runs it back through `validate_src_file`, offering it
only if it passes and falling back to "name the concept" prose otherwise. The
recursion terminates because each candidate carries one language folder fewer.

A candidate still sitting under a language folder is rejected for that reason
alone, so it is ruled out before the validating call, which keeps that call
exactly one level deep and makes the depth of a path irrelevant to the cost of
blocking it.

Verification rather than enumeration is what makes the advice trustworthy,
because the cases that defeat a hand-written rule are not the obvious ones:
`python/utils.ts` would otherwise be told to become `utils.python.ts`, which the
generic denylist rejects; `python/parse.cache.ts` would be told to become
`parse.cache.python.ts`, which no submodule pattern matches; `python/config.json`
would be told to become `python.json`, which the extension gate rejects; and a
language folder directly under `src/` would be told to use a dotted suffix the
src root does not allow. Each is silently handled by asking the validator. The
one judgment the validator cannot express stays explicit: a barrel is never
given a language suffix, because `index.python.ts` is accepted but wrong.

`packages/types/src/errors.ts` is deleted along with its barrel export. It held
`AnalysisError` and `AnalysisPhase`, which nothing referenced; error reporting
flows through the `Result` type and the resolution-failure types. It was also
the last generic-named file under any `packages/*/src` — the other offenders the
task names were renamed by 362.5 and 362.8 — so the denylist lands on a clean
tree and the Stop audit stays green.

### Verification

Corpus diffing pins the safety property. Running 12,096 generated paths through
the pre-change and post-change hook and diffing the verdicts yields 2,156
tightenings and zero loosenings — nothing that was blocked before is accepted
now — and no throws. A separate sweep of 768 language-folder paths confirms all
129 offered suggestions round-trip to names the validator accepts.

Both hook entry points were driven end-to-end with real payloads. Mutation
testing confirms the tests discriminate: removing the unsupported-language
guard fails 8 tests, removing the language-prefix guard fails 10, emptying a
constant fails its pin, and collapsing the language list fails 16.

The suite runs from the repo root via `pnpm exec vitest run .claude/hooks/`,
wired into CI as its own step, and `.claude/hooks/tsconfig.json` joins the root
`typecheck` script — the hook that gates every file edit was previously
typechecked by nothing.

### Deviations from the task description

Three, each recorded because the description specifies an implementation that
does not achieve its own acceptance criteria:

- A fourth check, `validate_no_unsupported_language`, is added beyond the three
  the description names. AC #3 cannot hold without it, for the reason traced
  above.
- The constant is `LANGUAGE_NAMES` rather than `LANGUAGE_FOLDER_SEGMENTS`, since
  it also derives the suffix reject list; naming it for one consumption site
  would not be fully true. It is module-private, as nothing outside the hook
  reads it.
- The `EXTRACTOR_DIRS` branch is not reordered. It defends a collision that
  cannot occur — `extractors` is not a language name, so the directory rule
  never fires on an extractor path.

### Follow-ups

- The directory rule knows the six languages this repo reasons about, so a
  folder named for a language it does not support (`ruby/`, `cpp/`) still
  passes. The rule doc names the enforced set rather than claiming more.
- `.claude/hooks/**` is excluded by `eslint.config.js`, so the hooks are
  typechecked but not linted.
- `validate_root_file`, `validate_package_root_file` and the `debug_`/`verify_`
  src patterns predate this task and remain untested.
- Eleven constants and helpers in `file_naming.ts` predate this task and are
  exported with no consumer outside the module; un-exporting them is a hygiene
  sweep rather than part of this change.
- The `path.relative` fix in the audit and the validator's
  block-before-log ordering have no discriminating test; both need a
  filesystem or stdio harness the hook suite does not have.
- `file_naming_validator.ts` runs `main()` without a `try`/`catch`, so a throw
  anywhere in validation exits without emitting a block and the write proceeds.
  Choosing fail-open or fail-closed for the hook surface is a policy call wider
  than this task.
- `CLAUDE.md` calls `test_utils.ts` a dumping ground while the hook allowlists
  it; task 362.15 already tracks that contradiction.
