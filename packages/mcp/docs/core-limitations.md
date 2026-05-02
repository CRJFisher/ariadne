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

## 3. Inheritance and Non-Function Symbol Dependencies (Not Exposed)

**Issue**: Core's call-graph and classification APIs cover function-level reachability, but not class-relationship topology.

**Available Capabilities**:

- Function call analysis via `Project.get_call_graph()` — `entry_points` returns true positives only.
- Triage view via `Project.get_classified_entry_points()` — `{ true_entry_points, known_false_positives }` paired with an `EntryPointClassification` discriminated union (`framework_invoked` / `dunder_protocol` / `test_only` / `indirect_only`).
- `calls` and `called_by` relationships in `CallGraphNode`.

**Gaps**:

- Class inheritance chains (what does this class extend?)
- Interface implementations
- General symbol dependencies (imports, variable usage)

**Classification taxonomy (the blind-spot map)**:

The `EntryPointClassification` kinds carry the residual blind spots Ariadne's static resolver cannot see, surfaced by the bundled permanent registry:

- `framework_invoked` — called by a framework (Flask `@app.route`, Angular DI, JSX component instantiation, etc.). Carries `framework` and `group_id`.
- `dunder_protocol` — invoked via Python's protocol mechanism (`__str__`, `__eq__`, `__getitem__`, etc.). Carries `protocol`.
- `test_only` — only ever called from test files / harnesses.
- `indirect_only` — reached only via collection reads or dynamic dispatch.

**Impact**:

- Default callers see a clean `entry_points` list; framework noise is filtered automatically.
- Triage callers can inspect _why_ a given entry was suppressed via the classification verdict.
- Inheritance, interface, and non-function dependency analysis are still gaps.

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

## 5. Documentation Extraction (Available)

Core exposes documentation extraction for all supported languages. This is not a gap; it is listed here so MCP-tool authors know the surface exists.

**Available APIs**:

- `Project.get_source_with_context(def, file_path)` — returns `{ source, docstring, decorators }`.
- `extract_jsdoc_context()` for JavaScript / TypeScript JSDoc parsing.
- `extract_python_context()` for Python docstrings and decorators.
- `Def.docstring` field on definition records.

**Capabilities**:

- JSDoc comment extraction with proper formatting.
- Decorator / annotation extraction (e.g., `@deprecated`).
- Python docstring extraction.
- Language-specific context extraction.

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
