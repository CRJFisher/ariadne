# task-96 - Fix JavaScript reference detection over-counting

## Description

JavaScript tests were failing because they expected empty reference arrays, but the implementation was detecting references to built-in globals like `console`, `document`, etc. This was initially thought to be "over-counting" but investigation revealed it's correct behavior.

## Acceptance Criteria

- [x] Investigate why JavaScript tests expect empty reference arrays
- [x] Determine if references to built-in globals should be tracked
- [x] Document the actual issue and create follow-up tasks if needed

## Implementation Plan

1. Run failing JavaScript tests and analyze the output
2. Check how references are collected in the scope graph
3. Compare with Python and Rust test approaches
4. Determine the root cause of the issue

## Implementation Notes

After investigation, I found that:

1. **The implementation is correct** - It properly detects all references including to built-in globals like `console`, `document`, etc.
2. **The real issue** is that references are not being attached to their containing scopes. There are no `ref_to_scope` edges in the graph.
3. **Test utility behavior** - Because references aren't attached to scopes, the test utility can't properly filter them by scope. All orphaned references (those not linked to definitions/imports) appear at the root level.
4. **Test expectations were wrong** - The JavaScript tests were written expecting empty reference arrays, which was incorrect.

The root cause is a missing feature in the scope graph construction: references should be attached to their containing scope via `ref_to_scope` edges, but this is not happening.

Created follow-up tasks:
- task-97: Fix missing ref_to_scope edges
- task-98: Update JavaScript/TypeScript tests after the edge fix is implemented

This task is complete as the investigation has identified the real issue.