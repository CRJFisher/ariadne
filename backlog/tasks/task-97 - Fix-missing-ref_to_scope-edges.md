# task-97 - Fix missing ref_to_scope edges causing references to not be attached to scopes

## Description

References in the scope graph are not being attached to their containing scopes. The `ref_to_scope` edge type exists but no such edges are being created during graph construction. This causes all references to appear as "floating" and makes it impossible for tools to determine which scope a reference belongs to.

## Acceptance Criteria

- [ ] References are properly attached to their containing scope via ref_to_scope edges
- [ ] Test utility can properly filter references by scope
- [ ] References appear in the correct scope in debug output

## Implementation Plan

1. Investigate where scope graph edges are created
2. Find where references are added to the graph
3. Add logic to create ref_to_scope edges when references are added
4. Test that references are properly attached to scopes
5. Verify that test utility now properly filters references by scope

## Implementation Notes

(To be added during implementation)