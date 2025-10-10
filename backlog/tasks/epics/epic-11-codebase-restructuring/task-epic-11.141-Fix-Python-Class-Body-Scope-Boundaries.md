# Task: Fix Python Class Body Scope Boundaries

**Status**: Not Started
**Epic**: epic-11-codebase-restructuring
**Created**: 2025-10-10
**Discovered During**: Investigation of scope tree malformed data detection (get_scope_id error handling improvement)

## Problem Statement

Python class body scopes and their child method scopes are being created as **siblings at the same depth** instead of having a proper **parent-child relationship**. This violates the fundamental scope tree invariant that nested scopes should have increasing depth.

### Root Cause

Tree-sitter's Python grammar reports a class's `(block)` node as starting at the **first child statement** within it, not at the colon that begins the class body. This causes the class body scope to have the same starting position as method scopes inside it, leading to overlapping scope boundaries at the same depth.

Example:

```python
class Calculator:       # line 1, col 0
    def add(self, x):   # line 2, col 4 (method starts here)
        return x + 1     # line 3
```

Current behavior:

- Class body scope: `class:test.py:2:5:6:20` (starts at line 2, same as first method!)
- Method scope: `method:test.py:2:12:3:20` (also starts at line 2)
- Both end up at **depth 1** (siblings, both children of module scope)

Expected behavior:

- Class body scope should start at or before the first method
- Method scope should be **depth 2** (child of class, which is child of module)

### Related Issues Found

During this investigation, we also discovered and **fixed** a similar issue in JavaScript/TypeScript:

- **JavaScript Issue (FIXED)**: The `(program)` node captures were creating nested module scopes overlapping with the manually-created root module scope
- **Fix Applied**: Skip module/namespace scope captures in `scope_processor.ts:67-68` since we manually create the root scope

This JavaScript fix demonstrates that scope boundary issues can be caught by proper depth validation.

## Current Impact

The following tests are failing due to this issue:

1. `semantic_index.python.test.ts > Type metadata extraction > should handle generic type arguments`
2. `semantic_index.python.test.ts > Attribute Access Chain Metadata > should handle self and cls in property chains`
3. `semantic_index.python.test.ts > Class and method handling > should extract class definitions and methods`
4. `semantic_index.python.test.ts > Definition Builder > should extract Enum classes with enum members`
5. `semantic_index.python.test.ts > Definition Builder > should extract Protocol classes with property signatures`

A test was added to document the issue:

- `scope_processor.test.ts:1134` - "should detect malformed Python class/method scopes at same depth"

## How TypeScript/JavaScript Handle Body-Based Scopes

TypeScript and JavaScript already handle body-based class scopes correctly through special processing in `scope_processor.ts`:

```typescript
// Lines 100-127: Special handling for class/interface/enum bodies
if (is_class_like_scope_type(scope_type)) {
  // For TypeScript/JavaScript: scope starts at body, not at class keyword
  const body_node = capture.node.childForFieldName("body");
  if (body_node) {
    location = {
      ...location,
      start_line: body_node.startPosition.row + 1,
      start_column: body_node.startPosition.column + 1,
    };
  }
}
```

However, this logic is NOT currently applied to Python class bodies. The Python query captures the `(block)` directly, but tree-sitter reports its position as starting at the first child.

## Proposed Solutions

### Option 1: Add Python-Specific Class Body Adjustment (Quick Fix)

Add special handling in `scope_processor.ts` for Python class scopes, similar to callable scope handling:

```typescript
// After line 100, add:
if (scope_type === "class" && capture.node.type === "block") {
  // For Python class bodies: adjust to start at the block's actual start
  // not at the first child statement
  const parent = capture.node.parent;
  if (parent?.type === "class_definition") {
    // Find the colon that starts the block
    const colon_index = parent.text.indexOf(":");
    if (colon_index >= 0) {
      location = {
        ...location,
        start_line: parent.startPosition.row + 1,
        start_column: parent.startPosition.column + colon_index + 1,
      };
    }
  }
}
```

**Pros**:

- Minimal change
- Follows existing pattern for scope adjustments

**Cons**:

- Language-specific hack
- Brittle (relies on finding colon in text)
- Doesn't address root cause

### Option 2: Change Python Query to Capture Class Declaration (Better)

Modify `queries/python.scm` to capture the class declaration node and extract the body programmatically:

```scheme
; Instead of:
(class_definition
  body: (block) @scope.class
)

; Use:
(class_definition) @scope.class
```

Then in `scope_processor.ts`, add logic to extract the body location from class_definition nodes:

```typescript
if (scope_type === "class" && capture.node.type === "class_definition") {
  const body_node = capture.node.childForFieldName("body");
  if (body_node) {
    location = {
      file_path: location.file_path,
      start_line: body_node.startPosition.row + 1,
      start_column: body_node.startPosition.column + 1,
      end_line: body_node.endPosition.row + 1,
      end_column: body_node.endPosition.column,
    };
  }
}
```

**Pros**:

- More explicit control over scope boundaries
- Can be tested independently
- Follows TypeScript/JavaScript pattern more closely

**Cons**:

- Requires changes in two places (query + processor)
- Still somewhat language-specific

### Option 3: Pull Scope Boundary Adjustment Higher (RECOMMENDED - Ultra-think Approach)

**Key Insight**: The fundamental issue is that tree-sitter grammars differ in how they report "body" node positions:

- Some report the opening brace/colon position
- Some report the first child's position
- Some report the closing brace position

Instead of handling this per-language in `scope_processor.ts`, we should:

1. **Standardize scope boundary semantics**: Define what scope boundaries SHOULD mean

   - Class scope = class body (excluding class name)
   - Function scope = function body (excluding function name)
   - Module scope = entire file

2. **Extract scope boundary adjustment to language configs**: Move the boundary adjustment logic into `LanguageBuilderConfig` or a new `LanguageScopeConfig`

3. **Create a scope boundary normalizer**: A function that takes raw tree-sitter captures and normalizes them to our semantic model

```typescript
// New file: scope_boundary_normalizer.ts
interface ScopeBoundaryConfig {
  language: Language;
  adjustScopeBoundary: (
    scope_type: ScopeType,
    node: Parser.SyntaxNode,
    raw_location: Location
  ) => Location;
}

// python_scope_config.ts
export const PYTHON_SCOPE_CONFIG: ScopeBoundaryConfig = {
  language: "python",
  adjustScopeBoundary(scope_type, node, raw_location) {
    if (scope_type === "class") {
      // Handle Python's block-at-first-child behavior
      const parent = node.parent;
      if (parent?.type === "class_definition") {
        const body = parent.childForFieldName("body");
        // Ensure scope starts at the colon, not first statement
        return adjustToBlockStart(body, raw_location);
      }
    }
    return raw_location;
  },
};
```

This would be called from `scope_processor.ts` **before** creating scope IDs:

```typescript
// In process_scopes, after line 62:
let location = capture.location;
const scope_type = map_capture_to_scope_type(capture);

// NEW: Normalize scope boundaries per language
const scope_config = getScopeConfig(file.lang);
location = scope_config.adjustScopeBoundary(scope_type, capture.node, location);
```

**Pros**:

- Separates concerns: query captures vs. boundary semantics
- Language-specific logic is in language-specific files
- Easy to test independently per language
- Makes scope boundary semantics explicit
- Future languages just need to define their boundary config
- Can handle all scope types (classes, functions, methods) uniformly

**Cons**:

- More upfront architectural work
- Need to migrate existing TypeScript/JavaScript handling

## Implementation Plan - Option 3 (Ultra-Think Approach)

We chose **Option 3** because it addresses the fundamental problem: tree-sitter grammars report "body" positions inconsistently. By separating the semantic question (where should scopes be?) from the mechanical question (what did tree-sitter give us?), we create a maintainable, extensible architecture.

### Sub-Tasks (Dependency Chain)

#### 11.141.1: Create Scope Boundary Extractor Infrastructure
**Estimated**: 2-3 hours | **Dependencies**: None

Create the foundational interface, factory, and helpers:
- Define `ScopeBoundaryExtractor` interface with `extract_boundaries()` method
- Create factory function `get_scope_boundary_extractor(language)`
- Implement helpers: `node_to_location()`, `position_to_location()`
- Optional: Create `BaseScopeBoundaryExtractor` base class
- Test infrastructure with mocks

**Deliverable**: Interface and helpers that can be tested independently

#### 11.141.2: Implement Python Scope Boundary Extractor
**Estimated**: 4-6 hours | **Dependencies**: 11.141.1

Solve the Python class/method boundary issue:
- Implement `PythonScopeBoundaryExtractor` class
- Critical: `find_colon_after_name()` helper to locate `:` in class definitions
- Handle classes, functions, methods, blocks
- Comprehensive unit tests (12+ test cases)
- Test in isolation using tree-sitter directly (no integration yet)

**Deliverable**: Fully tested Python extractor that correctly finds class body start position

#### 11.141.3: Integrate Python Extractor Into Scope Processor
**Estimated**: 3-4 hours | **Dependencies**: 11.141.1, 11.141.2

Connect the extractor to the scope processing pipeline:
- Call `extractor.extract_boundaries()` in `scope_processor.ts`
- Use `scope_location` for scope tree building (not raw `capture.location`)
- Keep existing logic for other languages (conditional: `if (lang === "python")`)
- Update test at `scope_processor.test.ts:1134` to verify correct hierarchy

**Deliverable**: Python uses extractor, other languages unchanged

#### 11.141.4: Verify Python Tests Pass
**Estimated**: 1-2 hours | **Dependencies**: 11.141.3

Verification and debugging checkpoint:
- Run all Python semantic index tests
- Verify 5 previously failing tests now pass
- Check scope depths are correct (class=1, method=2)
- Debug if needed (fix in 11.141.2 or 11.141.3)
- Document success

**Deliverable**: Confirmation that Python scope issue is resolved

#### 11.141.5: Migrate TypeScript/JavaScript Extractors
**Estimated**: 4-5 hours | **Dependencies**: 11.141.4

Extract existing TS/JS logic into extractor classes:
- Create shared `JavaScriptTypeScriptScopeBoundaryExtractor` base class
- Implement `TypeScriptScopeBoundaryExtractor`
- Implement `JavaScriptScopeBoundaryExtractor`
- Preserve named function expression handling
- Update factory to return TS/JS extractors
- Verify no regressions in TS/JS tests

**Deliverable**: TypeScript and JavaScript use extractors

#### 11.141.6: Complete Architecture Cleanup and Documentation
**Estimated**: 3-4 hours | **Dependencies**: 11.141.5

Finalize the architecture:
- Implement Rust extractor (if needed)
- Remove all ad-hoc boundary logic from `scope_processor.ts`
- Unified extractor call for all languages
- Create integration test suite across all languages
- Update CLAUDE.md with scope boundary semantics
- Document architecture with diagrams

**Deliverable**: Complete, documented, language-agnostic scope boundary extraction system

### Total Estimated Effort: 17-24 hours

### Dependency Graph
```
11.141.1 (Infrastructure)
    ↓
11.141.2 (Python Extractor)
    ↓
11.141.3 (Integration)
    ↓
11.141.4 (Verification)
    ↓
11.141.5 (TS/JS Migration)
    ↓
11.141.6 (Cleanup & Docs)
```

### Incremental Testing Strategy

Each task can be tested independently:
- **11.141.1**: Test infrastructure helpers with mocks
- **11.141.2**: Test Python extractor in isolation using tree-sitter
- **11.141.3**: Test integration with scope_processor
- **11.141.4**: Verify full Python test suite passes
- **11.141.5**: Verify TS/JS test suites pass
- **11.141.6**: Verify all languages pass, architecture is clean

## Testing Strategy

1. **Unit tests**: Test scope boundary adjustment in isolation for each language
2. **Integration tests**: Verify class/method depth relationships
3. **Regression tests**: Ensure existing TypeScript/JavaScript tests still pass
4. **Error detection tests**: Verify malformed scope detection still works

## References

- Current implementation: `packages/core/src/index_single_file/scopes/scope_processor.ts`
- Python queries: `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
- TypeScript class handling: `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`
- Related test: `packages/core/src/index_single_file/scopes/scope_processor.test.ts:1134`
- Error detection improvement: `scope_processor.ts:164-189` (throws error on duplicate scopes at same depth)

## Success Criteria

- [ ] All 5 failing Python semantic index tests pass
- [ ] Class body scopes are at depth 1 (children of module)
- [ ] Method scopes are at depth 2 (children of class body)
- [ ] No malformed scope tree errors for Python code with classes and methods
- [ ] Scope boundary semantics are explicitly documented
- [ ] TypeScript/JavaScript tests still pass (no regression)

## Related Tasks

- Task that improved error detection: Investigation of `get_scope_id` malformed data handling (2025-10-10)
- Task that fixed JavaScript module scopes: Same session, added skip for module scope captures

## Notes

This task was discovered when improving `get_scope_id` to fail fast on malformed scope trees. The error detection successfully caught this long-standing Python scope construction bug.

The JavaScript nested module issue was fixed during the same investigation by skipping module/namespace scope captures, since we manually create the root module scope. This demonstrates that proper validation catches boundary issues early.
