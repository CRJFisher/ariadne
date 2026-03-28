---
id: TASK-190.13
title: Fix functions missed as called due to out-of-scope callers
status: To Do
assignee: []
created_date: '2026-03-28 14:39'
updated_date: '2026-03-28 14:39'
labels: []
dependencies: []
parent_task_id: TASK-190
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Description

Ariadne reports false positive entry points when the only callers of a function exist in files outside the configured `folders` scope. Two false positive groups share this identical root cause: `callers-not-in-registry` (callers in unindexed files within the same repo) and `cross-package-caller-missed` (callers in sibling packages, e.g. `amazon_ads/scripts/daily_update.py` calling `update_field_names` functions in the `projections` package). Because those callers are never indexed, the call graph has no edges into the flagged functions, so entry point detection incorrectly classifies them as unreachable.

## Reproduction

```
File: projections/demand_forecasting/update_field_names.py
Function: update_field_names (various)
Caller: amazon_ads/scripts/daily_update.py (outside indexed folders)
Expected: Not reported as entry point (has cross-package caller)
Actual: Reported as unreachable entry point
```

## Root Cause

- **Pipeline stage**: `trace_call_graph`
- **Module**: `packages/core/src/trace_call_graph/trace_call_graph.ts` (entry point detection) and `packages/core/src/project/load_project.ts` (file discovery)
- **Code path**: `detect_entry_points` only sees functions from files within configured `folders`. Cross-package callers in sibling directories are never loaded, so call edges from those files are absent from the registry. Functions that are only ever called from outside the indexed scope appear to have zero callers and are flagged as entry points.

## Fix Approach

Add a `caller_folders` config option to `LoadProjectOptions`. Files discovered under `caller_folders` are indexed for definitions and references (so call resolution works) but are tagged as context-only. Entry point detection only considers functions from primary-scope (`folders`) files as candidates; context-only files contribute call edges but are never themselves reported as entry points.

### Files to modify

1. `packages/core/src/project/load_project.ts` — add `caller_folders?: string[]` to `LoadProjectOptions`; after loading primary `folders`, discover files in each `caller_folder` via `find_source_files`, skip any path already in the primary set, and load the remainder with a `context_only: true` flag.

2. `packages/core/src/project/project.ts` — add `context_only_files: Set<FilePath>` field; populate it when `update_file` is called with `context_only: true`; expose it so `trace_call_graph` can filter candidates.

3. `packages/core/src/trace_call_graph/trace_call_graph.ts` — accept `context_only_files` in `detect_entry_points`; skip any function whose `location.file_path` is in that set.

### Key logic

```typescript
// load_project.ts
const context_files = new Set<string>();
for (const caller_folder of caller_folders ?? []) {
  const abs = resolve_to_absolute(caller_folder, project_path);
  for (const f of await find_source_files(abs, discovery_patterns)) {
    if (!primary_files.has(f)) context_files.add(f);
  }
}
for (const f of context_files) {
  await project.update_file(f as FilePath, content, { context_only: true });
}

// trace_call_graph.ts
if (context_only_files.has(node.location.file_path)) continue;
```

### Test fixtures to add

1. Cross-package caller resolution: two packages `pkg_a/` and `pkg_b/`; `pkg_a/main.py` calls `pkg_b.util.helper()`; configure `folders: ["pkg_b"]`, `caller_folders: ["pkg_a"]`; assert `helper` is NOT an entry point.
2. Context-only functions excluded: function defined in a context-only file with no callers; assert it does NOT appear as an entry point.
3. Primary-scope orphan preserved: `pkg_b/orphan.py` defines `orphan_func()` with no callers; assert it IS an entry point.
4. No regression: `caller_folders` absent/empty produces identical results to current behavior.
5. Overlap precedence: path in both `folders` and `caller_folders` is treated as primary.

## Review Notes

- **info-architecture**: APPROVE — same fix as `callers-not-in-registry`; synthesis correctly identifies duplicate root cause and recommends merging for implementation.
- **simplicity**: APPROVE — one fix covers both false positive groups; no additional complexity introduced.
- **fundamentality**: APPROVE — `caller_folders` addresses the root cause at the project-loading and entry-point-detection stages.
- **language-coverage**: APPROVE — fix is language-agnostic; applies uniformly across Python and any other indexed language.

## Coverage

This task resolves two false positive groups:
- `callers-not-in-registry` — callers in unindexed files within the same repo
- `cross-package-caller-missed` — callers in sibling packages (the 2 `update_field_names` entries called from `amazon_ads/scripts/daily_update.py`)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Functions whose only callers are in caller_folders are not reported as entry points
- [ ] #2 Context-only files never appear as entry point candidates
- [ ] #3 Primary-scope orphan functions (no callers anywhere) remain reported as entry points
- [ ] #4 caller_folders absent or empty produces identical results to current behavior
- [ ] #5 Test fixtures added covering cross-package caller resolution for Python
- [ ] #6 No regression in existing test suite
<!-- AC:END -->
