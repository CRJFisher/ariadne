---
id: TASK-362.10
title: >-
  Harden the file-naming hook: language sub-folder block, generic-name denylist,
  drop go/java
status: To Do
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

- [ ] #1 file_naming.ts blocks language-named sub-folders (e.g. call_resolution/python/) while extractors/ shared-base paths still pass
- [ ] #2 generic basenames (utils/types/common/errors/helpers/constants/analytics/misc/shared .ts) are blocked outside index.ts and \*.test.ts
- [ ] #3 LANGUAGES is [typescript,javascript,python,rust]; .go.ts/.java.ts no longer validate; file-naming.md matches
- [ ] #4 new .claude/hooks/file_naming.test.ts covers every added check
- [ ] #5 file-naming.md states name-fully-true and {folder}.ts-is-the-main-impl, and the .cjs reference is fixed to .ts
<!-- AC:END -->
