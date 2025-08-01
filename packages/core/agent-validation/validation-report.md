# Ariadne Agent Validation Report

## Summary
- Total nodes validated: 5
- Accurate top-level identification: 1/3 (33%)
- Accurate call relationships: 0/5 (0%)
- File summary accuracy: Low

## Top-Level Node Validation

### Nodes Checked:
- ❌ `benchmark-incremental#generateLargeFile`: Found internal call at line 63 in benchmark-incremental.ts
- ❌ `benchmark-incremental#benchmark`: Found multiple internal calls at lines 67, 73, 93, 109
- ✅ `edit#create_edit`: Correctly identified as top-level (only exported, not called internally)

## Call Relationship Validation

### Issues Found:
- All sampled nodes show empty `outgoing_calls` and `incoming_calls` arrays
- Source snippets are empty strings
- Line numbers are all 0

### Specific Examples:
- ❌ `benchmark` function should show calls to `generateLargeFile` - not detected
- ❌ `generateLargeFile` should show incoming call from `benchmark` - not detected

## File Summary Validation

### Issues Found:
- File summary shows aggregated data (71 total functions) instead of per-file breakdown
- File paths are missing from the summary
- Export counts show 0 for all files despite having exported functions like `create_edit`

### Manual Count Verification:
- `graph.ts`: Manual count shows ~45 function-like constructs

## Technical Issues Identified

1. **Missing metadata**: 
   - All line numbers are 0
   - Source snippets are empty
   - File names missing from file_summary

2. **Call graph extraction problems**:
   - No call relationships detected despite clear function calls in the code
   - Top-level identification is incorrect for functions called within the same file

3. **File processing limitations**:
   - Skipped `index.ts` (43.7KB) due to tree-sitter 32KB limit
   - This likely contains many important functions and relationships

## Conclusion

The current agent validation output shows significant parsing and extraction issues:

1. **Call graph extraction is not working** - No function calls are being detected
2. **Top-level node identification is flawed** - Functions called within the same file are incorrectly marked as top-level
3. **Metadata extraction is incomplete** - Missing line numbers, source snippets, and proper file summaries

The validation framework itself is functioning correctly, but the underlying Ariadne parsing appears to have issues when analyzing its own codebase. This could be due to:
- The code using different file paths than expected
- Missing range information in the extracted nodes
- Issues with the call graph extraction logic when no main index.ts is included

**Recommendation**: Investigate why the call graph extraction returns empty relationships and missing metadata before using this for production validation.