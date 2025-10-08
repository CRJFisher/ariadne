# Task: Implement Rust Method Resolution Metadata

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-07

## Problem

The [semantic_index.rust.test.ts:1573](packages/core/src/index_single_file/semantic_index.rust.test.ts#L1573) test is currently **failing** (not skipped) because Rust lacks the final wiring needed for method call resolution metadata.

### Current Gap

When analyzing Rust code with method calls, we cannot determine:

1. **Receiver types from assignments**: When a variable is assigned with a type annotation, we don't track the type
2. **Receiver types from constructors**: When a variable is assigned from a constructor, we don't track what was constructed
3. **Method call receiver locations**: Method calls don't record where the receiver expression is located

### Test Scenario (Currently Failing)

```rust
struct Service {
    data: Vec<String>,
}

impl Service {
    fn get_data(&self) -> &Vec<String> {
        &self.data
    }
}

fn main() {
    // Scenario 1: Receiver type from annotation
    let service1: Service = create_service();
    service1.get_data();  // Need to resolve that service1 is type Service

    // Scenario 2: Receiver type from constructor
    let service2 = Service { data: vec![] };
    service2.get_data();  // Need to resolve that service2 is type Service
}
```

**Problem**: Without tracking the receiver type, we cannot resolve `get_data()` calls to the correct implementation in `impl Service`.

## Root Cause Analysis (Updated 2025-10-08)

### Current Implementation Status

**Good News**: Most infrastructure is already implemented! ✅

#### ✅ Already Implemented:

1. **Type System** ([packages/types/src/symbol_references.ts](packages/types/src/symbol_references.ts)):

   - `assignment_type?: TypeInfo` (line 133) - Field exists on SymbolReference
   - `receiver_location?: Location` (line 236) - Field exists in ReferenceContext
   - `construct_target?: Location` (line 302) - Field exists in ReferenceContext
   - All fields are fully documented with usage examples

2. **Metadata Extractors** ([packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts](packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts)):

   - `extract_call_receiver()` ✅ (lines 174-223) - Gets receiver location from method calls
   - `extract_property_chain()` ✅ (lines 254-328) - Builds method/field access chains
   - `extract_construct_target()` ✅ (lines 420-466) - Finds constructor target variables
   - `extract_assignment_parts()` ✅ (lines 343-385) - Extracts assignment source/target
   - `extract_type_from_annotation()` ✅ (lines 116-139) - Extracts type from let bindings

3. **Pipeline Integration** ([packages/core/src/index_single_file/semantic_index.ts:245](packages/core/src/index_single_file/semantic_index.ts#L245)):
   - RUST_METADATA_EXTRACTORS is wired into the semantic indexing pipeline
   - Reference builder has access to all extractors via get_metadata_extractors()

#### ❌ What's Actually Missing:

The test fails at line 1610 with `expected undefined to be defined` because:

1. **No Assignment Reference Capture**:

   - Tree-sitter queries capture `let` bindings as `@definition.variable` (rust.scm:353-361)
   - But no queries create assignment _references_ to track type flow
   - Test looks for `ref.type === "assignment"` but none exist

2. **Type Annotations Not Extracted**:

   - When `let service1: Service = create_service()` is parsed:
     - Variable `service1` is captured as a definition ✅
     - Type annotation `Service` is NOT being extracted and attached to a reference ❌
     - The `assignment_type` field is never populated despite extractor existing

3. **Missing Reference Builder Handler**:
   - No handler in `rust_builder.ts` to create assignment references
   - Extractors exist but aren't being called for let declarations

### The Actual Gap

The Rust semantic indexing currently captures:

- ✅ Method definitions in `impl` blocks
- ✅ Function calls
- ✅ Method calls (as generic function calls)
- ✅ **Metadata extractors exist** for all needed operations
- ❌ **Tree-sitter queries missing** to capture assignment references
- ❌ **Reference builder handlers missing** to wire extractors to query captures
- ❌ **Variable assignment types not populated** (extractors not called)
- ⚠️ **Receiver location metadata** - extractors exist, need verification of wiring

This metadata is essential for:

- **Type-based method resolution**: Matching method calls to the correct `impl` block
- **Call graph construction**: Understanding which methods can be called from a given context
- **Entry point detection**: Finding methods that are never called (requires accurate resolution)

## Solution (Updated Based on Investigation)

Since most infrastructure exists, the work simplifies to **wiring up existing extractors** through tree-sitter queries and reference builder handlers.

### 1. Add Tree-Sitter Query for Assignment References ⚠️ PRIMARY GAP

**Goal**: Capture `let` declarations as assignment references to track type flow

**Status**: This is the main missing piece

**Implementation**:

- Add queries to `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`
- Capture pattern for typed assignments: `let x: Type = value`
- Capture pattern for constructor assignments: `let x = Constructor { }`

**Specific Changes Needed**:

```scm
; Add to rust.scm after existing let_declaration queries:

; Assignment with type annotation (for tracking type flow)
(let_declaration
  pattern: (identifier) @reference.assignment.target
  type: (_) @reference.assignment.type
  value: (_)?) @reference.assignment

; Assignment with struct literal (for tracking constructor type)
(let_declaration
  pattern: (identifier) @reference.assignment.target
  value: (struct_expression
    name: (type_identifier) @reference.assignment.constructor)) @reference.assignment
```

**Test Impact**: This will make the test find assignment references at line 1608

### 2. Add Reference Builder Handler for Assignments

**Goal**: Wire up the existing extractors when assignment captures are processed

**Status**: Missing handler in `rust_builder.ts`

**Implementation**:

- Add handler in `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- Map capture name `reference.assignment` to a processing function
- Call existing extractors:
  - `extract_type_from_annotation()` to populate `assignment_type`
  - `extract_assignment_parts()` to get source/target locations

**Specific Changes Needed**:

```typescript
// Add to RUST_BUILDER_CONFIG in rust_builder.ts:

[
  "reference.assignment",
  {
    process: (capture: CaptureNode, builder: DefinitionBuilder, context: ProcessingContext) => {
      const assignment_parts = context.metadata_extractors?.extract_assignment_parts(
        capture.node,
        context.file_path
      );

      const assignment_type = context.metadata_extractors?.extract_type_from_annotation(
        capture.node,
        context.file_path
      );

      builder.add_reference({
        type: "assignment",
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        assignment_type,
        // ... other fields
      });
    }
  }
]
```

### 3. Verify Receiver Location Metadata

**Goal**: Confirm method calls already populate receiver_location (likely already working)

**Status**: ✅ Extractors exist, just need to verify wiring

**Implementation**:

- Check if method call references use `extract_call_receiver()`
- Likely already working via reference_builder.ts generic context extraction
- Run test to verify: `npm test -- semantic_index.rust.test.ts -t "receiver location"`

**Files to check**:

- `packages/core/src/index_single_file/references/reference_builder.ts` (lines 250-316)
- Verify ReferenceKind.METHOD_CALL triggers receiver extraction

### 4. NO NEW TYPE DEFINITIONS NEEDED ✅

**Status**: Already Complete

All required type definitions already exist:

- `SymbolReference.assignment_type?: TypeInfo` ✅
- `ReferenceContext.receiver_location?: Location` ✅
- `ReferenceContext.construct_target?: Location` ✅

See: [packages/types/src/symbol_references.ts](packages/types/src/symbol_references.ts)

## Testing Strategy

### Phase 1: Assignment Type Tracking

```bash
cd packages/core
npm test -- semantic_index.rust.test.ts -t "assignment type"
```

Test cases:

- ✅ Type annotations: `let x: MyType = expr`
- ✅ Struct literals: `let x = MyStruct { fields }`
- ✅ Function returns: Track when return type is known

### Phase 2: Receiver Location Capture

```bash
npm test -- semantic_index.rust.test.ts -t "receiver location"
```

Test cases:

- ✅ Method calls on variables: `variable.method()`
- ✅ Method calls on expressions: `create_obj().method()`
- ✅ Chained method calls: `obj.method1().method2()`

### Phase 3: Full Method Resolution

```bash
npm test -- semantic_index.rust.test.ts -t "method resolution metadata"
```

Un-skip the test at line 1573 and verify:

- ✅ Resolves method calls with type-annotated receivers
- ✅ Resolves method calls with constructor-assigned receivers
- ✅ Handles multiple impl blocks for different types

## Acceptance Criteria

1. **Assignment type tracking works**:

   - Variable assignments capture type from annotations
   - Variable assignments capture type from struct literals
   - Types are stored in reference metadata

2. **Receiver location tracking works**:

   - Method calls capture receiver expression location
   - Location points to the correct AST node
   - Works for variables, expressions, and chains

3. **Test passes**:

   - Un-skip test at `semantic_index.rust.test.ts:1573`
   - All assertions pass
   - No regressions in existing Rust tests

4. **Documentation updated**:
   - Type definitions include new fields
   - Examples show how to use the metadata
   - Architecture docs explain method resolution flow

## Related

- Rust semantic indexing: task-epic-11.114
- Rust scope boundaries: task-epic-11.116
- Method resolution (general): Future work for other languages
- Call graph construction: Depends on accurate method resolution

## Implementation Notes (Updated Based on Investigation)

### Existing Implementation Details

**Metadata Extractors Location**: [packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts](packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts)

All required extractors are **already implemented and tested**:

- `extract_call_receiver()` - Lines 174-223, handles method calls, associated functions, turbofish syntax
- `extract_property_chain()` - Lines 254-328, recursive traversal of field expressions
- `extract_construct_target()` - Lines 420-466, finds let declaration patterns
- `extract_assignment_parts()` - Lines 343-385, handles let bindings and assignments
- `extract_type_from_annotation()` - Lines 116-139, extracts Rust types including generics

**Test Coverage**: [packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.test.ts](packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.test.ts)

Each extractor has comprehensive unit tests validating:

- Type annotations (i32, String, Vec<T>, Option<T>)
- Method call receiver extraction
- Property chain traversal
- Constructor target identification

### Current Query File State

**Location**: [packages/core/src/index_single_file/query_code_tree/queries/rust.scm](packages/core/src/index_single_file/query_code_tree/queries/rust.scm)

**Existing patterns** (lines 353-361):

```scm
; Variable bindings (currently only for definitions)
(let_declaration
  pattern: (identifier) @definition.variable
)

; Mutable variables (currently only for definitions)
(let_declaration
  (mutable_specifier)
  pattern: (identifier) @definition.variable.mut
)
```

**What's missing**: No `@reference.assignment` capture to create assignment references

### Revised Implementation Order (4-5 days)

1. **Day 1**: Add tree-sitter queries for assignment references

   - Modify rust.scm to capture `@reference.assignment`
   - Run failing test to verify captures are found

2. **Day 2**: Add reference builder handler

   - Add handler to RUST_BUILDER_CONFIG for `reference.assignment`
   - Wire up existing extractors
   - Run test to verify assignment_type is populated

3. **Day 3**: Verify receiver_location is working

   - Check reference_builder.ts integration
   - Run test to verify method calls have receiver_location
   - Fix any gaps in wiring

4. **Day 4**: Make test pass

   - Run full test at line 1573
   - Debug any remaining issues
   - Verify all assertions pass

5. **Day 5**: Verification & cleanup
   - Run all Rust tests to ensure no regressions
   - Clean up any debug code
   - Update documentation if needed

### Performance Considerations

- Assignment type tracking adds ~5-10% overhead (acceptable)
- Receiver location tracking is nearly free (just storing node location)
- Method resolution is done on-demand, not during indexing

### Future Enhancements

This work enables future improvements:

- Type inference for Rust (using assignment flow)
- Trait method resolution (using type information)
- Generic type instantiation tracking
- Lifetime analysis (for advanced use cases)

## Success Metrics

- ✅ Test at line 1573 passes
- ✅ No performance regression >15%
- ✅ Method resolution accuracy >95% for common cases
- ✅ All existing Rust tests still pass

## Estimated Effort (Updated 2025-10-08)

**Original Estimate**: Medium (2-3 weeks)
**Revised Estimate**: Small-Medium (4-5 days) ⬇️ **SIGNIFICANTLY REDUCED**

**Complexity**: Low-Medium (down from Medium-High)

- Most infrastructure already exists
- Clear implementation path identified
- Well-tested extractors available
- Single test validates all work

**Priority**: Medium (enables better call graph analysis for Rust)

### Why the Reduction?

1. **Type definitions**: ✅ Already complete (0 days instead of 3-5 days)
2. **Metadata extractors**: ✅ Already implemented and tested (0 days instead of 5-7 days)
3. **Pipeline integration**: ✅ Already wired up (0 days instead of 2-3 days)
4. **Remaining work**: Only tree-sitter queries + reference builder handler (4-5 days)

### Risk Assessment

**Low Risk**:

- Changes are additive (new queries, new handlers)
- Existing infrastructure proven to work
- Clear test-driven approach
- No breaking changes to existing code

### Recommendation

**Proceed as single task**. Well-scoped, low-risk, with clear acceptance criteria.
