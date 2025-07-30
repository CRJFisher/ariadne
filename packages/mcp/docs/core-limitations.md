# Ariadne Core Limitations Affecting MCP Tool Implementation

This document outlines current limitations in `@ariadnejs/core` that prevent full implementation of context-oriented MCP tools.

## 1. Function Body Scope Limitation (enclosing_range Bug)

**Issue**: The `enclosing_range` field in `Def` objects is undefined, preventing extraction of complete function bodies.

**Evidence**:

- Test reveals `enclosing_range: undefined` in function definitions
- Core tests expect `enclosing_range` to exist but it's not populated
- `metadata.line_count` is available but doesn't help with body extraction

**Impact**:

- Cannot extract complete function implementation text
- Limits usefulness for code generation agents  
- Core tests have incorrect assumptions about `enclosing_range`

**Current Workaround**: Use `metadata.line_count` for metrics, manual line extraction for body text

**Fix Required**: See task-55 - `enclosing_range` should be populated with full function body range

## 2. Missing File Path in References

**Issue**: `Ref` type doesn't include file path information (task-51 addresses this)

**Evidence**:

- In `packages/mcp/src/start_server.ts:169`: "TODO task-51: Ref type doesn't include file info yet"
- References are assumed to be in the same file as the definition

**Impact**:

- Cross-file reference tracking is incomplete
- Cannot provide accurate file locations for all references
- Limits accuracy of usage statistics

**Current Workaround**: Assume references are in the same file as definition

## 3. ~~Incomplete Relationship Analysis~~ **RESOLVED**

**UPDATE**: Core DOES provide call graph analysis via `Project.get_call_graph()`!

**Available Capabilities**:

- ✅ Function call analysis via `get_call_graph()`
- ✅ `calls` and `called_by` relationships in CallGraphNode
- ❌ Class inheritance chains (what does this class extend?)
- ❌ Interface implementations  
- ❌ General symbol dependencies (imports, variable usage)

**Impact**:

- Can implement `calls` and `calledBy` for functions
- Still missing inheritance and interface relationships
- Still missing non-function symbol dependencies

## 4. Limited Test Detection Context

**Issue**: Test detection works for named functions but not for references within test blocks

**Root Cause**:

- Ariadne's `is_test` metadata only applies to function definitions
- Anonymous functions and code blocks within test suites aren't captured
- No API to traverse upward in AST to find enclosing test blocks

**Evidence**:

- `isReferenceInTestFunction()` falls back to file-name heuristics
- Cannot reliably detect if a reference is inside a `describe()` or `it()` block

**Impact**:

- Test reference detection is crude (file-based rather than context-based)
- May incorrectly categorize references in non-test files that happen to be in test directories

## 5. ~~Missing Documentation Extraction~~ **RESOLVED**

**UPDATE**: Core DOES provide comprehensive documentation extraction!

**Available APIs**:

- ✅ `Project.get_source_with_context(def, file_path)` - Returns `{ source, docstring, decorators }`
- ✅ `extract_jsdoc_context()` for JavaScript/TypeScript JSDoc parsing
- ✅ `extract_python_context()` for Python docstrings and decorators
- ✅ `Def.docstring` field already available in type definitions

**Capabilities**:

- JSDoc comment extraction with proper formatting
- Decorator/annotation extraction (e.g., `@deprecated`)
- Python docstring extraction
- Language-specific context extraction

**Resolution**: Implemented in MCP tool using existing core APIs

## 6. No Complexity Metrics

**Issue**: Core doesn't expose cyclomatic complexity calculation

**Impact**:

- `MetricsInfo.complexity` is always undefined
- Cannot provide code quality metrics to agents

## 7. Limited Cross-File Resolution

**Issue**: Import resolution and cross-file navigation is incomplete

**Evidence**:

- Comments in `symbol_resolver.ts`: "TODO: Parse import statements to find source file"
- Basic cross-file resolution exists but may miss complex import patterns

**Impact**:

- May not find all cross-file references
- Import tracking could be more comprehensive

## Recommendations for Core Improvements

### High Priority

1. **Enhance function definition capture** to include full body range
2. **Add file path to Ref type** (task-51)
3. **Expose AST traversal utilities** for relationship analysis

### Medium Priority  

4. **Add documentation extraction utilities**
5. **Implement complexity calculation**
6. **Improve test context detection** with AST traversal

### Low Priority

7. **Enhance import resolution** for complex patterns

## Workarounds in Current Implementation

1. **Function body**: Return signature only, document limitation in tests
2. **File paths**: Assume same-file references, add TODO comments
3. **Relationships**: Return empty arrays with TODO for future implementation
4. **Test detection**: Use file-name heuristics with comments explaining limitation
5. **Documentation**: Return undefined with TODO comments
6. **Complexity**: Return undefined, focus on line count only

These limitations don't prevent the MCP tool from being useful, but they do limit its completeness compared to what would be possible with enhanced core APIs.
