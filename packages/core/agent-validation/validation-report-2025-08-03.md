# Ariadne Agent Validation Report - August 3, 2025

## Summary
- Total nodes validated: 12
- Accurate top-level identification: 2/8 (25%)
- Accurate call relationships: 4/6 (67%)
- File summary accuracy: Low

## Top-Level Node Validation

### ❌ Critical Failures in Top-Level Detection

The following nodes were incorrectly marked as top-level despite having internal calls:

- ❌ `src/function_metadata#extract_function_metadata`: Found internal call at `src/scope_resolution.ts:346`
- ❌ `src/call_graph_utils#apply_max_depth_filter`: Found internal call at `src/project_call_graph.ts:1324`
- ❌ `src/scope_resolution#build_scope_graph`: Found internal call at `src/index.ts:159`
- ❌ `src/python_patterns#extract_class_relationships`: Found internal calls at `src/index.ts` and `src/project_inheritance.ts:58`
- ❌ `src/symbol_naming#get_symbol_id`: Exported from `src/index.ts:23` and called at `src/scope_resolution.ts:355`
- ❌ `src/call_graph_utils#is_position_within_range`: Found multiple internal calls in `src/project_call_graph.ts`

### ✅ Correctly Identified Top-Level Nodes

- ✅ `src/call_graph_utils#get_function_node_range`: No internal calls found
- ✅ `src/edit#create_edit`: No internal calls found

## Call Relationship Validation

### `extract_typescript_function_metadata` (src/languages/typescript_metadata.ts)
- ✅ **Outgoing calls**: Correctly identified 3 calls at lines 69, 73, 77
- ❌ **Incoming calls**: Reports 2 calls from `extract_function_metadata`, but only 1 call found at line 20

### `ScopeGraph.insert_ref` (src/graph.ts)
- ✅ **Outgoing calls**: Correctly identified 4 internal calls
- ❌ **Incoming calls**: Reports 0 but actually called from `src/scope_resolution.ts:425`

### `TraversalContext.get_imports_with_definitions` (src/types.ts)
- ✅ **Function location**: Correctly identified at line 194
- ⚠️ **Call tracking**: Shows reasonable internal structure

## File Summary Validation

### `src/symbol_naming.ts`
- ❌ **Functions**: Reported 18, found ~9 exported functions
- ✅ **Imports**: Reported 1, confirmed 1 import statement
- **Issue**: Appears to be double-counting or including non-function definitions

### `src/graph.ts`
- ❌ **Imports**: Reported 27, found only 2 import statements
- **Issue**: Counting occurrences of the word "import" rather than actual import statements

### `src/types.ts`
- ⚠️ **Functions**: Reported 21 (interfaces and type definitions may be counted)
- ❌ **Imports**: Reported 10, found 2 actual import statements

## Cross-Reference Import Relationships

### `extract_function_metadata` called from `scope_resolution.ts`
- ✅ Import verified: `scope_resolution.ts` imports from `./function_metadata`

### `build_scope_graph` called from `index.ts`
- ✅ Import verified: `index.ts` exports `build_scope_graph` from `./scope_resolution`

## Issues Found

1. **Top-level detection failure**: The system fails to track calls across files, marking many actively-used functions as "top-level"
2. **Import counting methodology**: Counts word occurrences rather than actual import statements
3. **Function over-counting**: Some files report 2x the actual number of functions
4. **Incoming call tracking**: Inconsistent detection of functions calling into a target function
5. **Export tracking**: Functions that are exported and used elsewhere are still marked as top-level

## Conclusion

The Ariadne self-analysis demonstrates fundamental issues with:
- Cross-file call tracking (75% failure rate for top-level detection)
- Import statement parsing (counting words instead of actual imports)
- Function definition counting (significant over-counting)

**Success Criteria Assessment**:
- ❌ Top-level nodes: 25% accuracy (requires ≥90%)
- ⚠️ Call relationships: 67% accuracy (requires ≥85%)
- ❌ File summaries: >100% error rate (requires ≤20%)
- ❌ Major structural parsing errors found

**Verdict**: The validation test **FAILS** to meet the success criteria. The tool cannot accurately analyze its own codebase, particularly struggling with cross-file relationships and basic counting metrics.