# Task 11.74.17: Wire Error Collection Throughout Pipeline

**Status:** Ready
**Priority:** Medium
**Size:** Medium

## Summary

Wire the complete but unused `error_collection/analysis_errors` module throughout the processing pipeline to properly collect and report parsing, type, and analysis errors.

## Context

The error collection infrastructure is complete but not used. Errors are currently lost or handled inconsistently. This module should be wired as a cross-cutting concern throughout all analysis phases.

## Acceptance Criteria

- [ ] Create error collector in file_analyzer.ts for per-file errors
- [ ] Pass error collector through all analysis layers
- [ ] Collect parsing errors from tree-sitter
- [ ] Collect type errors from type analysis
- [ ] Collect import/export resolution errors
- [ ] Aggregate errors in final FileAnalysis output
- [ ] Add error summary to CodeGraph metadata

## Technical Details

### Current State
- Module exists at `/error_collection/analysis_errors`
- Has `create_error_collector()` and error types defined
- Currently imported in file_analyzer but not used effectively
- FileAnalysis has errors field but it's always empty

### Integration Points

1. **Per-File Analysis** (file_analyzer.ts):
```typescript
const error_collector = create_error_collector();

// Pass to each layer
const layer1 = analyze_scopes(tree, source_code, language, file_path, error_collector);
const layer2 = detect_local_structures(root_node, source_code, language, file_path, error_collector);
// ... etc
```

2. **Global Assembly** (code_graph.ts):
```typescript
// Aggregate errors from all files
const all_errors = aggregate_errors(analyses);
```

3. **Error Types to Collect**:
- Parse errors (syntax errors)
- Import resolution failures
- Type mismatches
- Undefined symbol references
- Class hierarchy issues
- Invalid method calls

### Files to Modify
- `packages/core/src/file_analyzer.ts` - Thread error collector through layers
- `packages/core/src/code_graph.ts` - Aggregate errors
- All analysis modules - Add error collection calls
- `packages/core/src/error_collection/analysis_errors.ts` - Ensure complete API

## Dependencies
- Can be done independently
- Should be done before major refactoring to catch issues

## Implementation Notes
- Start with most common errors (undefined symbols, import failures)
- Make errors actionable with clear messages and locations
- Consider error severity levels (error, warning, info)
- Don't let error collection slow down analysis

## Test Requirements
- Test error collection for syntax errors
- Test error collection for type errors
- Test error collection for import failures
- Test error aggregation across files
- Test error reporting format
- Ensure errors have accurate locations

## Related Tasks
- Parent: Task 11.74 (Module consolidation)
- Benefits all other analysis tasks by surfacing issues