# task-98 - Update JavaScript/TypeScript tests after ref_to_scope edge fix

## Description

Once task-97 is complete and references are properly attached to scopes, the JavaScript and TypeScript tests that use the `test_scopes` utility will need to be updated. Currently, all orphaned references appear at the root level, but after the fix they should appear in their proper scopes.

## Acceptance Criteria

- [ ] JavaScript tests pass with correct reference expectations
- [ ] TypeScript tests pass with correct reference expectations  
- [ ] References to built-in globals appear in the appropriate scope
- [ ] References that resolve to definitions/imports do not appear in the references array

## Implementation Plan

1. Wait for task-97 to be completed
2. Run JavaScript and TypeScript tests to see new behavior
3. Update test expectations to match the correct scope hierarchy
4. Ensure references to built-ins like `console` appear in the correct scope
5. Verify all tests pass

## Implementation Notes

(To be added during implementation)