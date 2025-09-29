# Task: Update JavaScript for Direct Definition Builders

## Status: Created

## Parent Task

task-epic-11.102.5 - Update Language Configs

## Objective

Update JavaScript language support to use the new direct definition builder system, removing all NormalizedCapture dependencies.

## Sub-tasks

1. **Update Language Config** (102.5.1.1)
   - Convert to builder pattern
   - Remove all NormalizedCapture references
   - Direct Definition creation

2. **Update Query File** (102.5.1.2)
   - Clean up javascript.scm
   - Remove unnecessary captures
   - Focus on essential captures only

3. **Update Tests** (102.5.1.3)
   - Fix language config tests
   - Ensure comprehensive field coverage
   - Test all definition types

## Success Criteria

- [ ] JavaScript config uses builder pattern
- [ ] Query file contains only necessary captures
- [ ] All JavaScript tests pass
- [ ] 100% coverage of processed fields

## Dependencies

- task-epic-11.102.1, 102.2, 102.3 (Builder systems exist)
- task-epic-11.102.4 (Old types removed)

## Estimated Effort

~3 hours total (1 hour per subtask)