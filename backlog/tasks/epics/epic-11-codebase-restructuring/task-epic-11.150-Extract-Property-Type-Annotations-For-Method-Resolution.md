# Task: Extract Property Type Annotations For Method Resolution

**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Created**: 2025-10-23

## Context

Property chain resolution (e.g., `this.definitions.update_file()`) requires type information for class/struct fields, but property type annotations are currently not being extracted by the semantic index.

### Current State

**What Works:**
- ✅ Method definitions and types extracted
- ✅ Variable declarations with types captured
- ✅ Simple method calls resolve correctly: `user.getName()`
- ✅ Namespace imports work: `utils.helper()`

**What Doesn't Work:**
- ❌ Property chains with `this`: `this.definitions.update_file()`
- ❌ Multi-level property access: `obj.field.method()`
- ❌ No type information for class/struct fields

### Example Problem

```typescript
export class Project {
  public definitions: DefinitionRegistry = new DefinitionRegistry();  // ← Type not extracted!
  
  update_file() {
    this.definitions.update_file(file_id, defs);  // ← Cannot resolve!
    //   ^^^^^^^^^^^ Type is NULL
  }
}
```

**Debug Output:**
```
definitions field:
  Symbol ID: property:...definitions
  Type ID: null  ❌ No type information!
```

**Current Behavior:**
- Property chains detected correctly: `["this", "definitions", "update_file"]` ✅
- `this` resolves to Project class ✅
- `definitions` field found as a property ✅
- **Type of `definitions` is NULL** ❌
- Falls back to wrong resolution: resolves to `Project.update_file()` instead of `DefinitionRegistry.update_file()`

### Impact

**Call Graph Analysis:**
- Current entry points: **135** (many false positives)
- Expected after fix: **~10-20** (actual API entry points)
- 125 false positives due to unresolved method calls

## Dependencies

### Blocks
- Property chain resolution (infrastructure exists, waiting for type data)
- Accurate call graph detection
- Method resolution for chained calls

### Depends On
- ✅ Property chain resolution infrastructure (completed in commit 5b58a29)
- ⚠️ **task-epic-11.136** - Method Call Type Tracking Resolution (complementary - see analysis below)

### Related
- task-epic-11.133 - Method Resolution Metadata Extraction (Python/Rust receiver_location)
- task-epic-11.136 - Method Call Type Tracking Resolution (uses property types we extract)
- task-152 - Split SymbolReference types (nice to have, not blocking)

## Sub-Tasks

### task-epic-11.150.1 - TypeScript Property Type Extraction
**Files:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

**Implementation:**
1. Capture property type annotations from class properties
2. Extract type from `property_signature` and `public_field_definition` nodes
3. Store in `PropertyDefinition.type` field
4. Pass to TypeRegistry for type binding
5. **Add comprehensive tests** to typescript_builder.test.ts covering:
   - Public/private/protected fields with type annotations
   - Fields with initializers: `field: Type = new Type()`
   - Optional fields: `field?: Type`
   - Readonly fields: `readonly field: Type`
   - Static fields: `static field: Type`
   - Generic types: `field: Map<string, number>`

**Test Coverage Required:**
```typescript
describe("Property type extraction", () => {
  it("should extract type from public field with annotation", () => {
    // public field: Type = value
  });
  
  it("should extract type from private field", () => {
    // private field: Type
  });
  
  it("should extract type from optional field", () => {
    // field?: Type
  });
  
  it("should extract type from readonly field", () => {
    // readonly field: Type
  });
  
  it("should extract type from static field", () => {
    // static field: Type
  });
  
  it("should extract generic type annotations", () => {
    // field: Map<K, V>
  });
  
  it("should extract array type annotations", () => {
    // items: Array<Item>
    // values: number[]
  });
});
```

### task-epic-11.150.2 - JavaScript Property Type Extraction
**Files:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

**Implementation:**
1. Extract JSDoc type annotations: `/** @type {Type} */`
2. Extract from constructor assignments with comments
3. Handle class fields (ES2022+)
4. **Add comprehensive tests** to javascript_builder.test.ts

**Test Coverage Required:**
```javascript
describe("Property type extraction", () => {
  it("should extract type from JSDoc annotation", () => {
    // /** @type {Registry} */
    // this.registry = new Registry();
  });
  
  it("should extract type from class field with JSDoc", () => {
    // /** @type {number[]} */
    // items = [];
  });
  
  it("should extract type from constructor assignment", () => {
    // this.field = /** @type {Type} */ (value);
  });
});
```

### task-epic-11.150.3 - Python Property Type Extraction
**Files:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Implementation:**
1. Extract type hints from class attributes: `field: Type`
2. Extract from `__init__` assignments with type hints
3. Handle dataclass fields
4. **Add comprehensive tests** to python_builder.test.ts

**Test Coverage Required:**
```python
describe("Property type extraction", () => {
  it("should extract type from class attribute annotation", () => {
    # class Foo:
    #     field: Type
  });
  
  it("should extract type from __init__ parameter", () => {
    # def __init__(self, field: Type):
    #     self.field = field
  });
  
  it("should extract type from dataclass field", () => {
    # @dataclass
    # class Foo:
    #     field: Type = field()
  });
  
  it("should extract Optional and Union types", () => {
    # field: Optional[Type]
    # field: Union[Type1, Type2]
  });
  
  it("should extract generic types", () => {
    # items: List[Item]
    # mapping: Dict[str, int]
  });
});
```

### task-epic-11.150.4 - Rust Property Type Extraction
**Files:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

**Implementation:**
1. Extract field types from struct definitions
2. Extract from tuple structs
3. Handle generic struct fields
4. **Add comprehensive tests** to rust_builder.test.ts

**Test Coverage Required:**
```rust
describe("Property type extraction", () => {
  it("should extract type from struct field", () => {
    // struct Foo {
    //     field: Type,
    // }
  });
  
  it("should extract type from pub field", () => {
    // pub field: Type
  });
  
  it("should extract type from generic struct", () => {
    // struct Foo<T> {
    //     field: Vec<T>,
    // }
  });
  
  it("should extract type from tuple struct", () => {
    // struct Point(i32, i32);
  });
  
  it("should extract lifetime-annotated types", () => {
    // field: &'a Type
  });
});
```

### task-epic-11.150.5 - Integration and Validation
**Files:**
- `packages/core/src/resolve_references/registries/type_registry.ts`
- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`
- `packages/core/analyze_self.ts`

**Tasks:**
1. Verify property types flow to TypeRegistry
2. Verify property chain resolution uses the types
3. Re-run self-analysis to verify entry point reduction
4. Add integration tests across all languages

**Validation:**
```bash
# Run self-analysis
npx tsx packages/core/analyze_self.ts

# Expected: total_entry_points reduced from 135 to ~10-20
```

## Implementation Notes

### Root Cause Analysis

**Problem:** Property type annotations not extracted

**Evidence:**
```
Project class members (from debug script):
- initialize: method ✅
- update_file: method ✅
- definitions: MISSING ❌  (should be property)
- types: MISSING ❌
- scopes: MISSING ❌
```

Only methods are indexed, not properties!

**Source Code:**
```typescript
export class Project {
  public definitions: DefinitionRegistry = new DefinitionRegistry();
  //     ^^^^^^^^^^^ Property with type annotation
  public types: TypeRegistry = new TypeRegistry();
  //                           ^^^^^^^^^^^^^^^^^^^^ Type annotation exists in source
```

**Current Semantic Index:**
- ✅ Extracts methods from classes
- ✅ Extracts method types (return types, parameter types)
- ❌ **Does NOT extract property definitions**
- ❌ **Does NOT extract property type annotations**

### Why This Matters

Property chain resolution walks through types:
1. Start: `this` → resolves to `Project` class ✅
2. Step 1: Look up `definitions` member → **FOUND but NO TYPE** ❌
3. Step 2: Get type of `definitions` → **NULL** ❌
4. **FAILS** - Cannot continue chain

With property types:
1. Start: `this` → resolves to `Project` class ✅
2. Step 1: Look up `definitions` member → FOUND ✅
3. Step 2: Get type of `definitions` → **`DefinitionRegistry`** ✅
4. Step 3: Look up `update_file` on `DefinitionRegistry` → FOUND ✅
5. **SUCCESS** - Resolves to `DefinitionRegistry.update_file()`

### Language-Specific Considerations

**TypeScript:**
- Type annotations are explicit: `field: Type`
- Tree-sitter provides type nodes directly
- Relatively straightforward extraction

**JavaScript:**
- No native type syntax (pre-TypeScript)
- Rely on JSDoc: `/** @type {Type} */`
- Constructor pattern: `this.field = value` with comment
- ES2022+ class fields with JSDoc

**Python:**
- Type hints: `field: Type`
- May include `Optional`, `Union`, generic types
- Dataclass fields have special syntax
- `__init__` parameter types propagate to fields

**Rust:**
- Explicit struct field types: `field: Type`
- Generic types: `field: Vec<T>`
- Lifetime annotations: `field: &'a Type`
- Pub visibility affects field access

## Acceptance Criteria

- [ ] All 4 languages extract property type annotations
- [ ] TypeRegistry receives and stores property type bindings
- [ ] Property chain resolution successfully walks multi-step chains
- [ ] Self-analysis shows entry points reduced from 135 to ~10-20
- [ ] Comprehensive tests added to each language builder test file
- [ ] No regressions in existing tests
- [ ] All integration tests pass

## Testing Strategy

### Unit Tests (Per Language)
Test property type extraction in builder test files:
- Public/private/protected visibility
- Optional/required fields
- Generic types
- Array/collection types
- Nested types
- Type with lifetimes (Rust)

### Integration Tests
- Verify type bindings created in TypeRegistry
- Verify property chain resolution uses extracted types
- Cross-file property access (with imports)

### End-to-End Validation
Run self-analysis and verify:
- Entry point count reduction
- Specific false positives eliminated
- No new false negatives introduced

## Estimated Effort

- task-epic-11.150.1 (TypeScript): **1 day** (tests + implementation)
- task-epic-11.150.2 (JavaScript): **0.5 day** (JSDoc handling)
- task-epic-11.150.3 (Python): **0.75 day** (type hints + dataclass)
- task-epic-11.150.4 (Rust): **0.75 day** (generics + lifetimes)
- task-epic-11.150.5 (Integration): **0.5 day** (validation)

**Total: 3.5 days**

## Related Analysis: Is task-epic-11.136 Necessary?

### Question
Is **task-epic-11.136** (Method Call Type Tracking Resolution) necessary for bringing property chain resolution to a releasable standard?

### Answer: YES - ABSOLUTELY NECESSARY

**Relationship:**
- **This task (150)**: Extracts property type DATA
- **Task 136**: Uses that data for method RESOLUTION

They are complementary and both required:

### What Each Task Provides

**task-epic-11.150 (This Task):**
```typescript
// EXTRACTS type information
class Project {
  definitions: DefinitionRegistry  // ← WE EXTRACT THIS TYPE
}
```

**task-epic-11.136 (Method Resolution):**
```typescript
// USES type information for resolution
project.definitions.update_file();
//      ^^^^^^^^^^^ Look up type
//                  ^^^^^^^^^^^ Resolve method on that type
```

### Why BOTH Are Needed

**Without task-epic-11.150:**
- No property type information available
- task-136's type lookup returns NULL
- Method resolution fails

**Without task-epic-11.136:**
- Have property type information
- But no infrastructure to USE it for resolution
- Method calls still unresolved

**With BOTH tasks:**
1. task-150 extracts: `definitions: DefinitionRegistry` ✅
2. task-136 looks up type of `definitions` → finds `DefinitionRegistry` ✅
3. task-136 resolves `update_file` on `DefinitionRegistry` ✅
4. **Property chain resolution WORKS** ✅

### Task Priority Ordering

**For releasable property chain resolution:**

1. **task-epic-11.150** (THIS TASK) - **CRITICAL**
   - Foundation: Extract the data
   - Blocks everything else

2. **task-epic-11.136** (Method Resolution) - **CRITICAL**
   - Uses the data for resolution
   - Makes property chain resolution work

3. **task-epic-11.133** (Receiver Metadata) - **IMPORTANT**
   - Needed for Python/Rust completeness
   - TypeScript/JavaScript already have receiver_location
   - Can ship without this for TS/JS-only release

4. **task-152** (Split Reference Types) - **NICE TO HAVE**
   - Code quality improvement
   - Not blocking functionality
   - Can be done post-release

### Conclusion

**Minimum for releasable property chain resolution:**
- ✅ task-epic-11.150 (this task)
- ✅ task-epic-11.136 (method resolution)

**For full multi-language support:**
- ✅ task-epic-11.150
- ✅ task-epic-11.136
- ✅ task-epic-11.133

**For production quality:**
- Add task-152 for type safety
