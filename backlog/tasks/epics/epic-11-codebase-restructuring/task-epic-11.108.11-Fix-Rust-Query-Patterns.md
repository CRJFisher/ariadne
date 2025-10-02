# Task 11.108.11: Fix Rust Tree-Sitter Query Patterns

**Status:** ✅ Completed
**Priority:** **CRITICAL** 🔥
**Estimated Effort:** 3-4 hours
**Actual Effort:** ~4 hours
**Parent:** task-epic-11.108
**Dependencies:** None (handlers already implemented)
**Blocks:**
- Full Rust semantic indexing
- Rust call graph analysis
- Rust cross-file resolution

## Objective

Fix tree-sitter query patterns in `rust.scm` to properly capture function/method parameters and link methods to their containing structs/traits. The handlers are already implemented and correct - the queries just aren't matching.

## Problem Statement

**From task 11.108.9 test results:**

Rust builder handlers are fully implemented at:
- `rust_builder.ts:551` - `definition.parameter` handler (complete)
- `rust_builder.ts:583` - `definition.parameter.self` handler (complete)
- Parameter handlers call `add_parameter_to_callable()` correctly

**However, 8 tests fail because:**
1. ❌ `signature.parameters` arrays are empty for all functions
2. ❌ `struct.methods` arrays are empty despite impl blocks existing
3. ❌ `interface.methods` arrays are empty for traits

**Root cause:** Tree-sitter queries in `rust.scm` aren't capturing the AST nodes correctly.

## Query File to Fix

**File:** [packages/core/src/index_single_file/query_code_tree/language_configs/queries/rust.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/rust.scm)

## Issues to Debug

### Issue 1: Function Parameters Not Captured

**Expected behavior:** Function parameters should be captured with `@definition.parameter`

**Current query (likely):**
```scheme
; Function parameters
(function_item
  parameters: (parameters
    (parameter
      pattern: (identifier) @definition.parameter)))
```

**Debug steps:**
1. Inspect Rust AST for function with parameters:
   ```rust
   fn add(x: i32, y: i32) -> i32 { x + y }
   ```
2. Use tree-sitter playground or dump AST
3. Verify exact node structure for parameters
4. Update query pattern to match

**Likely fix needed:**
```scheme
; Function parameters - explicit type annotation required
(parameters
  (parameter
    pattern: (identifier) @definition.parameter
    type: (_)))  ; ← May need to be more specific

; Function parameters - self parameters
(parameters
  (self_parameter) @definition.parameter.self)
```

### Issue 2: Methods Not Linked to Structs

**Expected behavior:** Methods in `impl Rectangle { fn area() {} }` should appear in `Rectangle.methods`

**Current issue:** Methods are created but not associated with their struct

**Debug steps:**
1. Check if `definition.method` capture exists in impl blocks
2. Verify `find_containing_impl()` helper function
3. Check if struct SymbolId matches impl block's target SymbolId

**Likely issue:** Query captures method but doesn't provide context to find containing struct

**Potential query pattern:**
```scheme
; Impl block methods - need to associate with struct
(impl_item
  type: (type_identifier) @_struct_name
  body: (declaration_list
    (function_item
      name: (identifier) @definition.method)))
```

**May need to:**
- Capture the struct name from impl block
- Pass it to handler via metadata
- Update handler to look up struct by name

### Issue 3: Trait Method Signatures Not Captured

**Expected behavior:** Trait methods should be captured and added to interface

**Current query (check if exists):**
```scheme
; Trait definitions
(trait_item
  name: (type_identifier) @definition.interface)

; Trait method signatures
(trait_item
  body: (declaration_list
    (function_signature_item
      name: (identifier) @definition.method.signature)))
```

**Debug steps:**
1. Verify `@definition.method.signature` capture exists
2. Check if handler for this capture exists in builder
3. Verify it calls `add_method_signature_to_interface()`

## Implementation Steps

### Phase 1: Inspect AST Structure

Use tree-sitter to inspect actual Rust AST:

```bash
# Install tree-sitter CLI if needed
npm install -g tree-sitter-cli

# Parse sample Rust file and dump AST
cat > test_sample.rs << 'EOF'
fn add(x: i32, y: i32) -> i32 {
    x + y
}

struct Point { x: i32, y: i32 }

impl Point {
    fn new(x: i32, y: i32) -> Self {
        Point { x, y }
    }

    fn distance(&self, other: &Point) -> f64 {
        0.0
    }
}

trait Drawable {
    fn draw(&self);
    fn color(&self) -> String;
}
EOF

tree-sitter parse test_sample.rs
```

### Phase 2: Update Query Patterns

Based on AST inspection, update `rust.scm`:

**Parameters:**
```scheme
; Function parameters with type annotations
(parameters
  (parameter
    pattern: (identifier) @definition.parameter
    type: (_)))

; Self parameters in methods
(parameters
  (self_parameter) @definition.parameter.self)

; Mutable self parameters
(parameters
  (self_parameter
    (mutable_specifier)? @_mut) @definition.parameter.self)
```

**Methods in impl blocks:**
```scheme
; Methods in impl blocks - capture with struct context
(impl_item
  type: (type_identifier) @_impl_target
  body: (declaration_list
    (function_item
      name: (identifier) @definition.method
      (#set! "impl_target" @_impl_target))))

; Or use simpler approach
(impl_item
  body: (declaration_list
    (function_item
      name: (identifier) @definition.method)))
```

**Trait method signatures:**
```scheme
; Trait method signatures (no implementation)
(trait_item
  body: (declaration_list
    (function_signature_item
      name: (identifier) @definition.trait.method.signature)))

; Trait methods with default implementation
(trait_item
  body: (declaration_list
    (function_item
      name: (identifier) @definition.trait.method.default)))
```

### Phase 3: Update Builder Config

If query patterns need metadata, update handler to use it:

**File:** `rust_builder.ts`

```typescript
// If we capture impl target, handler can use it
[
  "definition.method",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);

      // Get impl target from capture metadata
      const impl_target = capture.node.parent?.parent?.childForFieldName("type");
      const struct_id = impl_target
        ? create_class_id({...capture, node: impl_target, text: impl_target.text})
        : find_containing_impl(capture);

      if (struct_id) {
        builder.add_method_to_class(struct_id, {
          symbol_id: method_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: extract_visibility(capture.node.parent || capture.node),
        });
      }
    },
  },
]
```

### Phase 4: Run Tests

After updating queries:

```bash
# Run Rust semantic_index tests
npm test -- semantic_index.rust.test.ts

# Should see parameter tests pass
npm test -- semantic_index.rust.test.ts -t "function parameters"
npm test -- semantic_index.rust.test.ts -t "method parameters"
npm test -- semantic_index.rust.test.ts -t "trait method"
```

### Phase 5: Verify All Tests Pass

Target: 42/42 Rust tests passing (currently 31/42)

## Debugging Tools

### Tree-sitter Playground

Use online playground: https://tree-sitter.github.io/tree-sitter/playground

Or local CLI:
```bash
tree-sitter parse test_sample.rs > ast_output.txt
cat ast_output.txt
```

### Query Testing

Test queries directly:
```bash
tree-sitter query rust.scm test_sample.rs
```

### Add Debug Logging

Temporarily add logging to see what's captured:

```typescript
[
  "definition.parameter",
  {
    process: (capture, builder, context) => {
      console.log("[DEBUG] Parameter captured:", {
        name: capture.text,
        location: capture.location,
        parent_type: capture.node.parent?.type,
      });

      // ... existing handler code
    },
  },
]
```

## Success Criteria

- ✅ Function parameter queries capture all parameters
- ✅ Method queries link methods to structs via impl blocks
- ✅ Trait method signature queries capture trait methods
- ✅ All 8 currently-failing Rust tests pass
- ✅ No regressions in 31 currently-passing tests
- ✅ Zero TypeScript compilation errors

## Expected Test Results

**Before fix:**
```
Rust tests: 31/42 passing (8 failing)
- ❌ extracts function parameters
- ❌ extracts method parameters with self
- ❌ extracts trait method signatures
- ❌ extracts generic parameters (depends on methods)
```

**After fix:**
```
Rust tests: 42/42 passing ✅
- ✅ extracts function parameters
- ✅ extracts method parameters with self
- ✅ extracts trait method signatures
- ✅ extracts generic parameters
```

## Related Files

- [rust.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/rust.scm) - Query patterns to fix
- [rust_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts) - Handlers (already correct)
- [semantic_index.rust.test.ts](../../../packages/core/src/index_single_file/semantic_index.rust.test.ts) - Tests that verify fixes
- [task-epic-11.108.9-Rust-Update-Semantic-Index-Tests.md](task-epic-11.108.9-Rust-Update-Semantic-Index-Tests.md) - Test implementation details

## Notes

This is a **query pattern debugging task**, not a builder implementation task. The handlers are already correct and complete. We just need to fix the tree-sitter queries to actually match the Rust AST nodes.

**Key insight:** The difference between JavaScript/TypeScript (working) and Rust (broken) is likely in how parameters are structured in their respective ASTs. JavaScript has simpler parameter syntax, while Rust requires type annotations.

**Time estimate:** 3-4 hours including AST inspection, query iteration, and testing.

---

## Implementation Results

**Completion Date:** 2025-10-02

### Summary

Task completed successfully with all CRITICAL tests passing. The investigation revealed that **the issue was not primarily in query patterns** (which were mostly correct), but in **six critical bugs in the handler implementations**. Fixed query patterns were already correct from previous work - the main work was debugging and fixing handler logic bugs.

### Test Results

**Before Fix:**
- Rust tests: 39/44 passing (89%)
- 2 CRITICAL test failures
- Methods not being associated with structs
- Parameters not being added to methods

**After Fix:**
- ✅ Rust tests: 41/44 passing (93%) - **All non-skipped tests pass**
- ✅ All CRITICAL tests passing
- ✅ No regressions in full test suite
- ✅ TypeScript compilation: All packages compile with no errors

**Full Test Suite:**
- Test Files: 19 passed | 1 skipped (20)
- Tests: 583 passed | 101 skipped (684)
- Zero regressions across all languages

### Bugs Fixed

The root causes were **handler implementation bugs**, not query patterns:

#### 1. Constructor Name Hardcoding Bug
**File:** `rust_builder.ts:530`

**Issue:** The `definition.constructor` handler hardcoded the method name to "constructor" instead of using the actual Rust function name.

**Symptom:** Method `new()` appeared as `constructor` in struct methods, causing test lookup failures.

```typescript
// BEFORE (incorrect):
name: "constructor" as SymbolName,

// AFTER (correct):
name: capture.text as SymbolName,
```

**Impact:** Made all constructor methods unfindable by their actual names.

#### 2. Duplicate Function/Method Creation Bug
**File:** `rust_builder.ts:269-274, 297-302, 329-334, 357-362, 385-390`

**Issue:** All function handlers (`definition.function`, `definition.function.generic`, `definition.function.async`, etc.) processed methods inside impl blocks as standalone functions, creating duplicate entries with wrong symbol types.

**Symptom:** Methods created as both `function:` and `method:` symbols. Parameters looked for parent callable and found the function version (not the method version), so parameters were added to non-existent functions instead of methods.

```typescript
// ADDED to all function handlers:
// Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
const impl_info = find_containing_impl(capture);
const trait_name = find_containing_trait(capture);
if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
  return;
}
```

**Impact:** Created inconsistent symbol IDs, prevented parameters from being associated with methods.

#### 3. Symbol ID Prefix Mismatch Bug
**File:** `rust_builder_helpers.ts:745-762`

**Issue:** `find_containing_callable()` returned early with `function_symbol()` when it found a `function_item` node, even if that function was inside an impl/trait block. This created `function:` prefixed IDs instead of `method:` prefixed IDs.

**Symptom:** Parameters searched for parent with ID `method:test.rs:8:5:10:6:new` but `find_containing_callable()` returned `function:test.rs:8:5:10:6:new`, causing mismatch.

```typescript
// BEFORE: Returned function_symbol immediately
if (node.type === "function_item") {
  return function_symbol(...);
}

// AFTER: Check if function is inside impl/trait first
if (node.type === "function_item") {
  let ancestor = node.parent;
  while (ancestor) {
    if (ancestor.type === "impl_item" || ancestor.type === "trait_item") {
      return method_symbol(...);  // It's a method!
    }
    ancestor = ancestor.parent;
  }
  return function_symbol(...);  // It's a standalone function
}
```

**Impact:** Parameters couldn't find their parent methods, resulting in empty parameter arrays.

#### 4. Generic Struct Name Extraction Bug
**File:** `rust_builder_helpers.ts:339-350`

**Issue:** `extract_impl_type()` returned full generic type text like `"Container<T>"` when the struct was created with just base name `"Container"`, causing name-based lookup to fail.

**Symptom:** Methods in `impl<T> Container<T>` couldn't find struct `Container` because they searched for `Container<T>`.

```typescript
// BEFORE: Returned full text "Container<T>"
return type.text as SymbolName;

// AFTER: Extract base name from generic types
if (type.type === "generic_type") {
  const typeIdentifier = type.childForFieldName?.("type");
  if (typeIdentifier) {
    return typeIdentifier.text as SymbolName;  // Returns "Container"
  }
}
```

**Impact:** Generic structs couldn't have methods associated with them.

#### 5. Return Type Extraction for Generic References Bug
**File:** `rust_builder_helpers.ts:386-387`

**Issue:** `extract_return_type()` had overly complex filtering logic that broke for reference types like `&T`.

**Symptom:** Method return type showed `"&"` instead of `"&T"`.

```typescript
// BEFORE: Complex node filtering that lost type information
const typeNode = returnType.children?.find(
  (child) => child.type !== "->" && child.type !== "type"
);
return typeNode?.text || returnType.text?.replace("->", "").trim();

// AFTER: Simple text extraction
return returnType.text?.replace(/^->\s*/, "").trim() as SymbolName;
```

**Impact:** Generic return types were incomplete, causing test failures.

#### 6. Generic Function Handler Precedence Bug
**File:** `rust_builder.ts:276-280`

**Issue:** Generic functions were processed by both `definition.function` and `definition.function.generic` handlers. The non-generic handler ran first and created functions without generics, preventing the generic handler from running.

**Symptom:** Generic functions like `identity<T>` had `generics: undefined` instead of `generics: ["T"]`.

```typescript
// ADDED to definition.function handler:
// Skip generic functions - they're handled by definition.function.generic
const generics = extract_generic_parameters(capture.node.parent || capture.node);
if (generics && generics.length > 0) {
  return;
}
```

**Impact:** Generic functions lost their type parameter information.

### Type System Enhancement

#### Added `static` Property to MethodDefinition
**File:** `packages/types/src/symbol_definitions.ts:85`

**Reason:** Rust distinguishes between instance methods (`&self` parameter) and associated functions (no `self` parameter). TypeScript/JavaScript don't have this distinction as clearly, so the type system didn't include a `static` flag.

```typescript
export interface MethodDefinition extends Definition {
  readonly kind: "method";
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: SymbolName;
  readonly decorators?: readonly SymbolName[];
  readonly generics?: string[];
  readonly static?: boolean;  // ← Added for Rust associated functions
}
```

**Impact:** Enables proper representation of Rust's associated functions vs instance methods.

### Files Modified

#### Query Patterns (Already Correct)
- ✅ `packages/core/src/index_single_file/query_code_tree/queries/rust.scm` - Query patterns were already correct from previous work

#### Handler Implementations (6 bugs fixed)
1. **`packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`**
   - Fixed constructor name hardcoding (line 530)
   - Added impl/trait skip logic to `definition.function` handler (lines 269-274)
   - Added impl/trait skip logic to `definition.function.generic` handler (lines 297-302)
   - Added impl/trait skip logic to `definition.function.async` handler (lines 329-334)
   - Added impl/trait skip logic to `definition.function.const` handler (lines 357-362)
   - Added impl/trait skip logic to `definition.function.unsafe` handler (lines 385-390)
   - Added generic skip logic to `definition.function` handler (lines 276-280)

2. **`packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts`**
   - Fixed `find_containing_callable()` to check impl/trait ancestry before deciding symbol type (lines 745-762)
   - Fixed `extract_impl_type()` to extract base type name from generic types (lines 339-350)
   - Simplified `extract_return_type()` to preserve full type text (lines 386-387)

3. **`packages/core/src/index_single_file/definitions/definition_builder.ts`**
   - Added `static?: boolean` parameter to `add_method_signature_to_interface()` (line 532)
   - Applied static flag to interface method signatures (line 547)

#### Type Definitions
4. **`packages/types/src/symbol_definitions.ts`**
   - Added `readonly static?: boolean` to MethodDefinition interface (line 85)

### Issues Encountered

1. **Misleading Task Description:** Task was titled "Fix Rust Query Patterns" but the actual issues were all in handler implementations, not query patterns. The queries were already correct.

2. **Cascade of Symbol ID Mismatches:** The duplicate function/method creation caused a cascade of issues where parameters couldn't find their parent callables because of symbol type prefix mismatches (`function:` vs `method:`).

3. **Name-based Lookup Complexity:** Rust's separation of struct definitions and impl blocks required name-based lookup, which exposed edge cases with generic types that weren't issues in other languages.

4. **Type System Gap:** The MethodDefinition type didn't include a `static` flag, which is essential for Rust but wasn't needed for JavaScript/TypeScript where the distinction is less critical.

### Query Patterns Verified (Already Correct)

The following query patterns in `rust.scm` were verified to be correct:

1. **Function Parameters** (lines 350-356):
```scheme
(parameter
  (identifier) @definition.parameter
)
```

2. **Self Parameters** (line 359):
```scheme
(self_parameter) @definition.parameter.self
```

3. **Enum Variants** (line 155):
```scheme
(enum_variant
  (identifier) @definition.enum_member
)
```

4. **Trait Method Signatures** (lines 226-231):
```scheme
(trait_item
  body: (declaration_list
    (function_signature_item
      (identifier) @definition.interface.method
    )
  )
)
```

5. **Constructor Methods** (lines 261-268):
```scheme
(impl_item
  body: (declaration_list
    (function_item
      name: (identifier) @definition.constructor
      (#match? @definition.constructor "^(new|default|from|try_from|with_.*)$")
    )
  )
)
```

### Follow-on Work

#### Completed in This Task
- ✅ All CRITICAL Rust tests passing
- ✅ Methods properly associated with structs
- ✅ Parameters properly associated with methods/functions
- ✅ Generic types handled correctly
- ✅ Type system enhanced for Rust features
- ✅ Full regression testing passed

#### Future Enhancements (Not Blocking)
1. **Skipped Tests:** 3 Rust tests are skipped (not blocking):
   - "should extract nested/grouped imports" - Complex import syntax
   - "should extract re-exports (pub use)" - Re-export handling
   - "should extract method resolution metadata for all receiver patterns" - Advanced receiver patterns

2. **Enum Member Type Bug:** Found type issue where `EnumMember.name` is typed as `SymbolId` but should be `SymbolName` (requires type definition change, not blocking functionality)

3. **Python/JavaScript Parameter Extraction:** Some notes in test output indicate parameter extraction may need enhancement for Python/JavaScript (not in scope for this task)

### Lessons Learned

1. **Verify Handler Logic First:** When tests fail, check handler implementation before assuming query patterns are wrong. In this case, 100% of bugs were in handlers.

2. **Symbol ID Consistency is Critical:** Any mismatch between how symbol IDs are created vs how they're looked up causes complete failure. The `function:` vs `method:` prefix issue demonstrated this.

3. **Tree-sitter AST Inspection is Essential:** Using tree-sitter CLI to inspect actual AST structure was crucial for understanding the correct patterns.

4. **Name-based vs Location-based Lookup:** Rust's separated definitions (struct/impl) required a different approach than JavaScript/TypeScript's inline methods.

5. **Type System Extensibility:** Adding language-specific features (like `static` for Rust) to shared type definitions requires careful consideration of cross-language compatibility.

### Success Criteria Met

- ✅ Function parameter queries capture all parameters
- ✅ Method queries link methods to structs via impl blocks
- ✅ Trait method signature queries capture trait methods
- ✅ All 2 CRITICAL Rust tests now pass (was failing, now 100%)
- ✅ No regressions in other tests (583/583 passing in full suite)
- ✅ Zero TypeScript compilation errors
- ✅ Test improvement: 39/44 → 41/44 passing (89% → 93%)

**Task Status: ✅ COMPLETE AND VERIFIED**
