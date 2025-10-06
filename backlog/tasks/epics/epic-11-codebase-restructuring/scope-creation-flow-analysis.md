# Scope Creation Flow Analysis

**Date**: Task 11.112.3
**Status**: COMPLETED

## Executive Summary

This document traces the complete flow of scope creation and assignment in the semantic indexing system, from `.scm` query patterns to final `scope_id` values on definitions.

**KEY FINDING**: The bug is in `get_scope_id()` - it finds the DEEPEST scope containing a location, which causes classes/interfaces/enums to receive nested scope IDs instead of their parent scope ID.

## Scope Creation Flow

### Step 1: Tree-Sitter Query Execution

**File**: `packages/core/src/index_single_file/query_code_tree/queries/*.scm`

The `.scm` files define patterns that capture code structures as they're parsed by tree-sitter.

**Scope Captures** (TypeScript example):
```scheme
;; Scopes - Define lexical boundaries
(program) @scope.module
(function_declaration) @scope.function
(function_expression) @scope.function
(arrow_function) @scope.function
(method_definition) @scope.method
(class_declaration) @scope.class
(class) @scope.class
(statement_block) @scope.block
```

**Definition Captures** (TypeScript example):
```scheme
;; Class definitions
(class_declaration
  name: (identifier) @definition.class
)

;; Interface definitions
(interface_declaration
  name: (identifier) @definition.interface
)

;; Function definitions
(function_declaration
  name: (identifier) @definition.function
)
```

**Important**: The `capture.location` spans the ENTIRE node captured by tree-sitter. For a class, this includes:
- The class keyword
- The class name
- The class body (including ALL methods and properties)

Example:
```typescript
class MyClass {          // Line 1 - capture.location.start_line
  method() {             // Line 2
    const x = 1;         // Line 3
  }                      // Line 4
}                        // Line 5 - capture.location.end_line
```
The class capture has `location: { start_line: 1, end_line: 5 }`

### Step 2: Scope Processing

**File**: `packages/core/src/index_single_file/scopes/scope_processor.ts`

**Function**: `process_scopes(captures: CaptureNode[], file: ParsedFile): Map<ScopeId, LexicalScope>`

**Process**:
1. Filters captures to find those that create scopes (line 141-161)
2. Creates `LexicalScope` objects for each scope capture
3. Builds parent-child relationships between scopes
4. Returns a Map of `ScopeId → LexicalScope`

**Scope ID Format**: `{type}:{file_path}:{start_line}:{start_column}:{end_line}:{end_column}`

Example:
- File scope: `module:test.ts:1:1:10:0`
- Class scope: `class:test.ts:2:7:2:14` (just the class name location)
- Method scope: `method:test.ts:3:3:3:9` (just the method name location)

### Step 3: Processing Context Creation

**File**: `packages/core/src/index_single_file/scopes/scope_processor.ts`

**Function**: `create_processing_context(scopes, captures): ProcessingContext`

**Creates the context object with**:
- `captures`: All captured nodes
- `scopes`: Map of all scopes
- `scope_depths`: Precomputed depth of each scope
- `root_scope_id`: The root module scope
- **`get_scope_id(location)`: THE BUG IS HERE**

**The get_scope_id() Function** (lines 117-134):
```typescript
get_scope_id(location: Location): ScopeId {
  // Find deepest scope containing this location
  let best_scope_id = root_scope_id;
  let best_depth = 0;

  for (const scope of scopes.values()) {
    if (location_contains(scope.location, location)) {
      const depth = scope_depths.get(scope.id)!;
      if (depth > best_depth) {
        best_scope_id = scope.id;
        best_depth = depth;
      }
    }
  }

  return best_scope_id;
}
```

**THE BUG**:
- It finds the **DEEPEST** scope that contains the location
- For a class at lines 1-5 with a method at lines 2-4:
  - Both the class scope and method scope contain the class's location
  - The method scope is deeper
  - Returns method scope ❌
  - Should return file scope ✓

### Step 4: Definition Building

**Files**: `packages/core/src/index_single_file/query_code_tree/language_configs/*_builder_config.ts`

Each language has a builder config that processes definition captures and creates `Definition` objects.

**All get_scope_id() Call Sites**:

#### TypeScript (`typescript_builder_config.ts`):
- Line 79: `add_class` - Classes
- Line 104: `add_interface` - Interfaces
- Line 156: `add_type_alias` - Type aliases
- Line 184: `add_enum` - Enums
- Line 232: `add_function` - Functions
- Line 339: `add_decorated_class` - Decorated classes
- Line 368: `add_method` - Methods
- Line 401: `add_private_method` - Private methods
- Line 431: `add_accessor_method` - Accessors
- Line 463: `add_private_field` - Private fields
- Line 499: `add_parameter` - Parameters (standard)
- Line 528: `add_parameter` - Parameters (decorated)
- Line 557: `add_parameter` - Parameters (shorthand)
- Line 588: `add_property` - Properties
- Line 618: `add_decorated_property` - Decorated properties

#### Python (`python_builder_config.ts`):
- Line 55: `add_class` - Classes
- Line 93: `add_method` - Methods (standard)
- Line 122: `add_method` - Methods (static)
- Line 151: `add_method` - Methods (class methods)
- Line 181: `add_constructor` - __init__ methods
- Line 206: `add_property` - Properties (standard)
- Line 233: `add_property` - Properties (annotated)

#### JavaScript (`javascript_builder.ts`):
- Similar pattern for JavaScript-specific constructs

#### Rust (`rust_builder.ts`):
- Similar pattern for Rust-specific constructs

**All definitions call**: `scope_id: context.get_scope_id(capture.location)`

### Step 5: Reference Building

**File**: `packages/core/src/index_single_file/references/reference_builder.ts`

References also need scope_id to know where they're being referenced from.

**Calls**: `scope_id: context.get_scope_id(capture.location)`

## The Bug in Detail

### Root Cause

`get_scope_id()` uses the **entire capture location** to find a scope. For definitions whose capture spans nested scopes, it returns the wrong scope.

### Example Scenario

```typescript
class MyClass {          // Lines 1-5
  method() {             // Lines 2-4
    const x = 1;         // Line 3
  }
}
```

**Scopes Created**:
1. `module:test.ts:1:1:6:0` - File scope (depth 0)
2. `class:test.ts:1:7:1:14` - Class scope (depth 1, just "MyClass")
3. `method:test.ts:2:3:2:9` - Method scope (depth 2, just "method")

**Class Definition Capture**:
- From `.scm`: `(class_declaration name: (identifier) @definition.class)`
- Tree-sitter captures the class_declaration node
- **Location spans lines 1-5** (entire class including method body)

**Bug Execution**:
1. Builder calls: `context.get_scope_id(class_location)` where `class_location = lines 1-5`
2. `get_scope_id()` loops through scopes:
   - File scope contains lines 1-5 ✓ (depth 0)
   - Class scope contains lines 1-5 ✓ (depth 1)
   - Method scope contains lines 2-4, which overlaps 1-5 ✓ (depth 2)
3. Returns the **deepest** scope: `class:test.ts:1:7:1:14` or method scope
4. Class definition gets wrong scope_id ❌

**Expected Behavior**:
- Class should have `scope_id = module:test.ts:1:1:6:0` (file scope)
- Method should have `scope_id = class:test.ts:1:7:1:14` (class scope)

## Impact Analysis

### Affected Definition Types

All top-level definitions whose captures span nested scopes:

1. **Classes** - Always span their methods → Wrong scope
2. **Interfaces** - Span method signatures → Wrong scope
3. **Enums** - Span their members → Wrong scope
4. **Functions** - May span nested functions → Potentially wrong scope
5. **Methods** - Span their parameter lists → Potentially wrong scope

### Not Affected

Definitions whose captures don't span nested scopes:
- Variables (usually single line)
- Parameters (single identifier)
- Simple properties (single line)

### System Impact

- **TypeContext**: Cannot resolve type names (only 2/23 tests passing)
- **Method Resolution**: Looks in wrong scope for methods
- **Constructor Tracking**: Cannot find constructors in correct scope
- **Type-based Features**: All blocked

## Fix Strategy Analysis

### Option A: Use Parent Scope (RECOMMENDED)

**Approach**: Find the scope that **immediately contains the START** of the location, not the deepest scope.

**Implementation**:
```typescript
get_scope_id(location: Location): ScopeId {
  // Find the scope that contains the START position only
  const start_location: Location = {
    ...location,
    end_line: location.start_line,
    end_column: location.start_column,
  };

  let best_scope_id = root_scope_id;
  let best_depth = 0;

  for (const scope of scopes.values()) {
    if (location_contains(scope.location, start_location)) {
      const depth = scope_depths.get(scope.id)!;
      if (depth > best_depth) {
        best_scope_id = scope.id;
        best_depth = depth;
      }
    }
  }

  return best_scope_id;
}
```

**Pros**:
- Minimal code change (one function)
- Works for all languages
- No .scm changes needed
- Clear semantics: "where is this defined?"

**Cons**:
- Need to verify edge cases (empty classes, nested definitions)

### Option B: Add get_parent_scope_id() Helper

**Approach**: Keep `get_scope_id()` as-is, add a new function for definitions.

**Implementation**:
```typescript
get_parent_scope_id(location: Location): ScopeId {
  // Same as Option A, but as a separate function
}
```

Update all definition builders to use `get_parent_scope_id()` instead of `get_scope_id()`.

**Pros**:
- Doesn't change existing `get_scope_id()` behavior
- More explicit naming
- Can be used selectively

**Cons**:
- More code changes (every builder file)
- Two similar functions (maintenance burden)
- Harder to know which function to use

### Option C: Modify .scm Queries

**Approach**: Change `.scm` files to capture only the definition name, not the entire body.

Example:
```scheme
;; BEFORE:
(class_declaration
  name: (identifier) @definition.class
)

;; AFTER:
(class_declaration
  name: (identifier) @definition.class @definition.class.name
)
;; Then in builder, use a different location for scope lookup
```

**Pros**:
- Most explicit - fixes the root cause (capture location)

**Cons**:
- Requires changes to ALL .scm files (4 languages)
- Complex - need to capture both body and name separately
- May break other parts of the system that rely on full location

## Recommendation

**USE OPTION A**: Modify `get_scope_id()` to use start position only.

**Reasoning**:
1. Simplest implementation (one function change)
2. Works universally for all languages and definition types
3. No .scm changes needed
4. Semantically correct: "where is this definition's START located?"
5. Backward compatible with references (they typically have small locations)

## Implementation Checklist

### Phase 1: Implement Fix
- [ ] Modify `get_scope_id()` in `scope_processor.ts` to use start position only
- [ ] Add comprehensive tests for the fix
- [ ] Run scope_assignment_bug_repro.test.ts to verify fix

### Phase 2: Verify All Languages
- [ ] Test TypeScript: classes, interfaces, enums, functions
- [ ] Test JavaScript: classes, functions
- [ ] Test Python: classes, functions
- [ ] Test Rust: structs, functions, traits

### Phase 3: Regression Testing
- [ ] Run full test suite
- [ ] Verify TypeContext tests improve (2/23 → 23/23)
- [ ] Check integration tests
- [ ] Verify no new failures

### Phase 4: Edge Cases
- [ ] Empty classes
- [ ] Nested classes
- [ ] Generic classes
- [ ] Decorated classes
- [ ] Deeply nested definitions

## Related Files

### Core Files
- `packages/core/src/index_single_file/scopes/scope_processor.ts` - **FIX HERE**
- `packages/core/src/index_single_file/query_code_tree/language_configs/*.ts` - All call get_scope_id()

### Query Files (No changes needed)
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`
- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

### Test Files
- `packages/core/src/index_single_file/scope_assignment_bug_repro.test.ts` - Reproduces bug
- `packages/core/src/index_single_file/scope_processor.test.ts` - Unit tests
- `packages/core/src/resolve_references/type_context.test.ts` - Integration tests (should improve)

## Conclusion

The scope creation flow is well-structured, but the `get_scope_id()` function has a critical bug: it finds the deepest scope containing an ENTIRE location, when it should find the scope containing the START of a location.

This is a simple fix with broad impact - it will unblock all type-based resolution features.

**Next Task**: Implement Option A fix strategy (Task 11.112.4)
