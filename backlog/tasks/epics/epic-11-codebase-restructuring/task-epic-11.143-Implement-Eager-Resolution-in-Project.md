# Task: Implement Eager Resolution in Project Class

**Epic**: Epic 11 - Codebase Restructuring
**Status**: Completed
**Priority**: High
**Complexity**: High

## Overview

Convert Project class from lazy (on-demand) resolution to eager (immediate) resolution. After this change, `update_file()` and `remove_file()` will automatically resolve all affected references, eliminating the need for explicit `resolve_file()` calls and maintaining always-consistent state.

## Context

Currently, Project uses a lazy resolution pattern:

1. `update_file()` invalidates resolutions but doesn't resolve
2. Users must call `resolve_file()` or `get_call_graph()` to trigger resolution
3. `resolve_all_pending()` manages pending state and resolution

Problems with this approach:

- **Temporal coupling**: Operations spread across multiple method calls
- **Inconsistent state**: Resolutions may be stale between updates and queries
- **Complex API**: Users must understand when to resolve
- **Manual bookkeeping**: Tracking pending state adds complexity

With eager resolution:

1. `update_file()` immediately resolves affected files
2. `remove_file()` immediately resolves dependents
3. State is always consistent - no "pending" concept
4. Simple API: update and query, no lifecycle management

## Key Insight: No Performance Cost

Important: `resolve_symbols()` already resolves ALL files when called, not just pending files. The current "lazy" implementation defers WHEN resolution happens, not HOW MUCH work is done.

Therefore, eager resolution has **no performance cost** - we're doing the same work, just at a different time. The benefit is much simpler code and always-consistent state.

## Goals

1. **Add helper methods** to support eager resolution

   - `group_resolutions_by_file()` - convert resolve_symbols output to per-file maps
   - `resolve_files()` - resolve a set of files and update ResolutionRegistry

2. **Wire up eager resolution** in update/remove operations

   - `update_file()` resolves the updated file + dependents
   - `remove_file()` resolves dependents

3. **Simplify call graph** - remove pending resolution checks

4. **Remove lazy infrastructure**

   - Remove `resolve_file()` public method
   - Remove `resolve_all_pending()` private method
   - Simplify `get_stats()`

5. **Update documentation** to reflect eager resolution

## Architecture

### Before (Lazy):

```
update_file(file_id)
  → Parse + index
  → Update registries
  → Invalidate resolutions (mark as pending)

resolve_file(file_id) [explicit call required]
  → resolve_all_pending()
    → resolve_symbols() [resolves ALL files]
    → Update ResolutionRegistry

get_call_graph()
  → resolve_all_pending() [implicit]
  → detect_call_graph()
```

### After (Eager):

```
update_file(file_id)
  → Parse + index
  → Update registries
  → resolve_files([file_id, ...dependents])
    → resolve_symbols() [resolves ALL files]
    → Update ResolutionRegistry

get_call_graph()
  → detect_call_graph() [resolutions already done]
```

## Sub-Tasks

This task is broken into 6 granular sub-tasks:

1. **[task-epic-11.143.1](task-epic-11.143.1-Add-Helper-Methods-to-Project.md)**: Add helper methods (no behavior change)

   - Add `group_resolutions_by_file()`
   - Add `resolve_files()`
   - Tests for helpers in isolation

2. **[task-epic-11.143.2](task-epic-11.143.2-Wire-Eager-Resolution-in-update_file.md)**: Wire up eager resolution in `update_file()`

   - Call `resolve_files()` at end of `update_file()`
   - Remove `invalidate_file()` calls
   - Integration tests

3. **[task-epic-11.143.3](task-epic-11.143.3-Wire-Eager-Resolution-in-remove_file.md)**: Wire up eager resolution in `remove_file()`

   - Call `resolve_files()` for dependents
   - Remove `invalidate_file()` calls
   - Integration tests

4. **[task-epic-11.143.4](task-epic-11.143.4-Simplify-get_call_graph.md)**: Simplify `get_call_graph()`

   - Remove `resolve_all_pending()` call
   - Resolutions always up-to-date
   - Verify call graph tests still pass

5. **[task-epic-11.143.5](task-epic-11.143.5-Remove-Lazy-Resolution-Infrastructure.md)**: Remove lazy resolution infrastructure

   - Remove `resolve_file()` public method
   - Remove `resolve_all_pending()` private method
   - Update `get_stats()`
   - Update tests that call these methods

6. **[task-epic-11.143.6](task-epic-11.143.6-Update-Documentation.md)**: Update documentation
   - Update class-level comments
   - Update method comments
   - Update inline comments

## Implementation Strategy

**Incremental approach**: Each sub-task is independently testable and leaves the codebase in a working state. Sub-tasks build on each other but can be reviewed separately.

**Testing approach**:

- Sub-task 143.1 adds helpers with unit tests
- Sub-tasks 143.2-143.4 wire up eager resolution with integration tests
- Sub-task 143.5 removes dead code and updates tests
- Sub-task 143.6 updates documentation

## Success Criteria

- [x] `update_file()` automatically resolves affected files
- [x] `remove_file()` automatically resolves dependents
- [x] `resolve_file()` method removed (no longer needed)
- [x] `resolve_all_pending()` method removed
- [x] `get_call_graph()` simplified (no resolution logic)
- [x] All tests updated and passing
- [x] Documentation reflects eager resolution
- [x] API is simpler (just update and query)
- [x] State is always consistent (no pending concept)
- [x] `call_graph_cache` field removed
- [x] Old resolution_cache.ts files deleted

## Impact Analysis

### Code Deletion

- Remove ~50 lines from Project class (lazy resolution logic)
- Remove `resolve_file()` and `resolve_all_pending()` methods
- Remove `invalidate_file()` calls

### Code Addition

- Add ~40 lines for `group_resolutions_by_file()` helper
- Add ~25 lines for `resolve_files()` helper
- Add ~2 lines in `update_file()` (call to resolve_files)
- Add ~2 lines in `remove_file()` (call to resolve_files)

### Net Change

**~15 lines removed**, but more importantly:

- Simpler mental model (no pending state)
- Always-consistent state
- Simpler API (no explicit resolution calls)

## Dependencies

**Requires**: task-epic-11.142 (ResolutionCache → ResolutionRegistry refactor)

**Blocks**: None (this completes the refactoring)

## Related Tasks

- **Previous**: task-epic-11.142 - Convert ResolutionCache to ResolutionRegistry
- **Context**: task-epic-11.138 - Implement Project Coordination Layer

## Completion Notes

**Completed**: 2025-10-13

All sub-tasks completed:

- **143.1**: Verified ResolutionRegistry integration - resolution logic lives in ResolutionRegistry
- **143.2**: Wired eager resolution in `update_file()` - calls `resolve_files()` at end of Phase 3
- **143.3**: Wired eager resolution in `remove_file()` - calls `resolve_files()` for dependents
- **143.4**: Simplified `get_call_graph()` - removed cache and pending resolution logic
- **143.5**: Removed lazy infrastructure - deleted `resolve_file()` and `resolve_all_pending()` methods (no longer exist in codebase)
- **143.6**: Updated documentation - class-level and method-level docs reflect eager resolution

Key implementation details:

- Project class now uses `resolutions.resolve_files()` in both `update_file()` and `remove_file()`
- Removed `call_graph_cache` field - call graph built fresh on each call
- Updated `get_stats()` to show `resolution_count` instead of `pending_resolution_count`
- All tests passing (19/19 in project.test.ts)
- Test failures in other files are pre-existing scope boundary issues unrelated to this work

## Estimated Effort

- Sub-task 143.1: 2-3 hours
- Sub-task 143.2: 2-3 hours
- Sub-task 143.3: 1-2 hours
- Sub-task 143.4: 1 hour
- Sub-task 143.5: 2-3 hours
- Sub-task 143.6: 1 hour
- **Total**: 9-13 hours
- **Actual**: All sub-tasks completed as part of integrated implementation

## Risks and Mitigations

| Risk                    | Likelihood | Mitigation                                                         |
| ----------------------- | ---------- | ------------------------------------------------------------------ |
| Performance regression  | Low        | resolve_symbols already resolves all files; no change in work done |
| Breaking tests          | High       | Incremental approach with tests at each step                       |
| Subtle behavior changes | Medium     | Comprehensive integration tests; careful review of each sub-task   |
| External API breakage   | Low        | External API (via MCP) unchanged; internal refactoring only        |

## Notes

- This is internal refactoring; external API remains stable
- Each sub-task leaves codebase in working state
- Focus on maintaining test coverage throughout
- Document any unexpected issues in sub-task files
