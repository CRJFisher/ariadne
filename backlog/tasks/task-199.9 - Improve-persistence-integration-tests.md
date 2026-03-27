---
id: TASK-199.9
title: Improve persistence integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:15"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - persistence
dependencies: []
parent_task_id: TASK-199
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

Persistence has solid test coverage (20 integration + 3 property-based + 4 benchmarks). Key gaps:

### High priority

- **`can_use_cache` + git-accelerated warm load** — the primary performance optimization is never tested end-to-end. No test creates a real git repo, populates cache, commits, then verifies fast-path skips content hashing.
- **`load_project` + `FileSystemStorage`** — the production storage backend is only tested via contract tests, never in the full pipeline (all integration tests use `InMemoryStorage`).

### Medium priority

- Scoped loading (`files`/`folders`/`file_filter`) + caching — untested together
- Stale manifest entries for deleted files — manifest grows unboundedly
- `parse_gitignore()` in file_loading — zero test coverage

### Low priority

- Atomic write crash safety — hard to test deterministically
- `deserialize_semantic_index` with pre-parsed object input

## Actions

1. Add git-accelerated warm load end-to-end test (create temp git repo, populate cache, commit, verify fast-path)
2. Add `load_project` + `FileSystemStorage` integration test
3. Add `parse_gitignore` tests
4. All inline code (appropriate for this module)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

Persistence tests generally have good assertions (fresh === cached comparisons). Ensure any new tests use exact value comparisons for manifest entries, cache hit/miss counts, and restored index contents — not just `toBeDefined()` or truthiness checks.

<!-- SECTION:NOTES:END -->
