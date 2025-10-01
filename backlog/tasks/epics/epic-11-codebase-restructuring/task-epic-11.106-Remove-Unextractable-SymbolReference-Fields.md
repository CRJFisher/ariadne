# Task Epic 11.106: Refine SymbolReference Attributes for Method Call Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 4 hours
**Dependencies:** task-epic-11.104 (Metadata Extraction - Complete)
**Created:** 2025-10-01

## Objective

Refine `SymbolReference` to contain only attributes that (1) can be reliably captured via tree-sitter queries and (2) provide maximum functionality for method call resolution (receiver type detection). Remove fields that cannot be extracted and add missing extractable fields that support the method resolution use case.

## Background

**Method call resolution goal:** To resolve `obj.method()`, we need to determine the type of `obj` (the receiver). This type can come from:
- Explicit type annotations: `const obj: MyClass = ...`
- Constructor patterns: `const obj = new MyClass()`
- Property chains: `container.getObj().method()`
- Optional chaining: `obj?.method()`

**Tree-sitter capabilities:** Tree-sitter can extract syntactic patterns from AST nodes:
- Type annotations (explicit in source)
- Constructor call patterns
- Member access chains (structure, not resolved types)
- Optional chaining syntax
- Receiver node locations

**Tree-sitter limitations:** Cannot infer or analyze:
- Types without annotations
- Control flow narrowing/widening
- Inter-procedural type flow
- Return types (unless annotated)

## Attribute Design Principles

1. **Extractable:** Every attribute must map to a concrete tree-sitter query capture
2. **Functional:** Every attribute must serve method call resolution
3. **Minimal:** Remove anything that doesn't satisfy (1) AND (2)
4. **Language-aware:** Account for language-specific patterns (optional chaining in JS/TS only)

## Attributes Analysis

### Core Attributes (Essential, Keep)

| Attribute | Purpose | Tree-sitter Capture |
|-----------|---------|-------------------|
| `location` | Identify where symbol appears | Node position |
| `name` | Symbol identifier | Identifier node text |
| `scope_id` | Scope resolution context | Scope tracking |
| `call_type` | function/method/constructor | Node type pattern |

### Type Attributes (For Method Resolution)

| Attribute | Extractable? | Useful for Resolution? | Decision |
|-----------|-------------|----------------------|----------|
| `type_info` | ✅ Yes (annotations) | ✅ Yes (receiver type) | **Keep** |
| `member_access.object_type` | ✅ Yes (annotations) | ✅ Yes (receiver type) | **Keep** |
| `member_access.is_optional_chain` | ✅ Yes (syntax) | ✅ Yes (affects resolution) | **Implement** |
| `type_flow.source_type` | ❌ No (requires inference) | ❌ No | **Remove** |
| `type_flow.is_narrowing` | ❌ No (requires control flow) | ❌ No | **Remove** |
| `type_flow.is_widening` | ❌ No (requires type system) | ❌ No | **Remove** |
| `type_flow.target_type` | ⚠️ Partial (annotations only) | ⚠️ Maybe (assignments) | **Simplify** |

### Context Attributes (For Receiver Identification)

| Attribute | Extractable? | Useful for Resolution? | Decision |
|-----------|-------------|----------------------|----------|
| `context.receiver_location` | ✅ Yes (parent nodes) | ✅ Yes (essential) | **Keep** |
| `context.property_chain` | ✅ Yes (member access) | ✅ Yes (chained calls) | **Keep** |
| `context.containing_function` | ⚠️ Needs scope traversal | ❌ No (not for resolution) | **Remove** |
| `context.assignment_source/target` | ✅ Yes (assignment nodes) | ⚠️ Unclear benefit | **Evaluate** |
| `context.construct_target` | ✅ Yes (new expression) | ⚠️ Unclear benefit | **Evaluate** |

## Proposed Changes

### Before (Current):

```typescript
export interface SymbolReference {
  readonly location: Location;
  readonly type: ReferenceType;
  readonly scope_id: ScopeId;
  readonly name: SymbolName;
  readonly context?: ReferenceContext;
  readonly type_info?: TypeInfo;
  readonly call_type?: "function" | "method" | "constructor" | "super";

  readonly type_flow?: {
    source_type?: TypeInfo;        // ❌ Always undefined
    target_type?: TypeInfo;
    is_narrowing: boolean;         // ❌ Always false
    is_widening: boolean;          // ❌ Always false
  };

  readonly return_type?: TypeInfo;

  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;    // ⚠️ Always false (but implementable)
  };
}
```

### After (Proposed):

```typescript
export interface SymbolReference {
  readonly location: Location;
  readonly type: ReferenceType;
  readonly scope_id: ScopeId;
  readonly name: SymbolName;
  readonly context?: ReferenceContext;
  readonly type_info?: TypeInfo;
  readonly call_type?: "function" | "method" | "constructor" | "super";

  // SIMPLIFIED: Only target type (when extractable)
  readonly assignment_type?: TypeInfo;

  readonly return_type?: TypeInfo;

  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;    // ✅ Will be implemented
  };
}
```

## Sub-Tasks

### 11.106.1 - Evaluate Context Attributes for Method Resolution (45 minutes)

Determine which `ReferenceContext` attributes are essential for method call resolution:
- **receiver_location:** Essential (identifies the object)
- **property_chain:** Essential (for chained access)
- **assignment_source/target:** Evaluate necessity
- **construct_target:** Evaluate necessity
- **containing_function:** Not needed for method resolution → Remove

**Deliverable:** Decision matrix mapping each context attribute to tree-sitter captures and method resolution use cases.

**Success Criteria:**
- ✅ Clear justification for keeping/removing each context attribute
- ✅ Tree-sitter query pattern identified for each kept attribute
- ✅ Method resolution scenario documented for each kept attribute

### 11.106.2 - Remove Non-Extractable Type Attributes (30 minutes)

Remove attributes that cannot be extracted from tree-sitter:
- `type_flow.source_type` - Requires type inference
- `type_flow.is_narrowing` - Requires control flow analysis
- `type_flow.is_widening` - Requires type system knowledge

**Approach:** Delete from interface, remove all references. No codebase audit needed (blinkered approach).

**Success Criteria:**
- ✅ Fields removed from `SymbolReference` interface
- ✅ No compilation errors
- ✅ Tests updated to remove assertions on deleted fields

### 11.106.3 - Refine Type Flow to Assignment Type (30 minutes)

**Decision:** Keep only extractable type information for assignments.

Simplify `type_flow` object to `assignment_type?: TypeInfo` since only `target_type` was extractable (from explicit annotations).

**Rationale:** For method resolution, we care about annotated types on assignments: `const obj: MyClass = ...` provides type information we can use.

**Success Criteria:**
- ✅ `type_flow` replaced with `assignment_type`
- ✅ Extraction limited to explicit type annotations
- ✅ TypeScript compiles

### 11.106.4 - Refine ReferenceContext (30 minutes)

Apply evaluation from 11.106.1 to refine `ReferenceContext`:

**Remove:**
- `containing_function` - Not needed for method resolution

**Evaluate and decide:**
- `assignment_source/target` - Do these support method resolution?
- `construct_target` - Does this support method resolution?

**Keep:**
- `receiver_location` - Essential for identifying receiver
- `property_chain` - Essential for chained access

**Approach:** Make decisions based on "does this help resolve `obj.method()` calls?" not on existing code usage.

**Success Criteria:**
- ✅ Context contains only method-resolution-relevant attributes
- ✅ Each attribute maps to a tree-sitter capture pattern
- ✅ Interface is minimal

### 11.106.5 - Implement Optional Chain Detection (1 hour)

**Goal:** Capture `is_optional_chain` for method/property access to support resolution.

Optional chaining (`obj?.method()`) affects type resolution - the result can be `undefined`. This is extractable from tree-sitter syntax.

**Implementation approach:**
1. Define tree-sitter query patterns for `optional_chain` nodes (JS/TS only)
2. Update metadata extractors to return `{ location, is_optional }` for receivers
3. Populate `member_access.is_optional_chain` in SymbolReference

**Language patterns:**
- JavaScript/TypeScript: `optional_chain` AST node type
- Python/Rust: No such syntax, always false

**Success Criteria:**
- ✅ Tree-sitter query captures optional chaining syntax
- ✅ Extractor returns accurate boolean for JS/TS
- ✅ Tests verify `obj?.method()` vs `obj.method()` distinction
- ✅ Supports method resolution (type can be undefined)

### 11.106.6 - Verify Extractable Receiver Type Hints (45 minutes)

**Goal:** Ensure we're capturing all tree-sitter-extractable type information for receivers.

Review and strengthen extraction of:
- Type annotations: `const obj: MyClass = ...`
- Constructor patterns: `const obj = new MyClass()`
- Return type annotations: `function factory(): MyClass`
- Generic type arguments: `Array<MyClass>`

**Approach:** Query-first, not code-first. Define what patterns tree-sitter can capture, write queries for each pattern, test across languages.

**Key questions:**
- What explicit type syntax exists in each language?
- Can tree-sitter capture these patterns reliably?
- Are we currently capturing all available patterns?

**Success Criteria:**
- ✅ All explicit type annotations captured
- ✅ Constructor patterns captured for all languages
- ✅ Annotated return types captured
- ✅ Cross-language parity verified
- ✅ No inference or semantic analysis required

### 11.106.7 - Update Tests for Refined Interface (45 minutes)

**Goal:** Update tests to match refined interface and verify method resolution use cases.

Focus tests on method resolution scenarios, not comprehensive interface coverage:

```typescript
// Receiver type from annotation
const obj: MyClass = factory();
obj.method(); // Can we extract MyClass from annotation?

// Receiver type from constructor
const obj = new MyClass();
obj.method(); // Can we extract MyClass from constructor?

// Receiver from property chain
container.getObj().method(); // Can we extract the chain?

// Optional chaining
obj?.method(); // Can we extract the optional flag?
```

**Changes:**
- Remove assertions on deleted fields (source_type, is_narrowing, etc.)
- Add tests for extractable receiver type patterns
- Update `type_flow.target_type` → `assignment_type`
- Add optional chaining tests

**Success Criteria:**
- ✅ Tests verify all extractable patterns work
- ✅ Tests verify method resolution use cases
- ✅ No assertions on non-extractable attributes
- ✅ Cross-language test parity

### 11.106.8 - Update Documentation (20 minutes)

**Goal:** Document the refined interface with focus on tree-sitter extractability and method resolution.

Update documentation to explain:
- What attributes exist and why (method resolution goal)
- What each attribute maps to in tree-sitter queries
- What patterns can be extracted vs. what requires inference

**Files to Update:**
- Interface JSDoc comments in `semantic_index.ts`
- Inline comments in metadata extractors
- Any existing guides/documentation

**Approach:** Timeless documentation (don't reference "old way" or changes), focused on current capability and purpose.

**Success Criteria:**
- ✅ Every attribute documented with tree-sitter query pattern
- ✅ Method resolution use cases explained
- ✅ Clear distinction: extractable vs. inference-based
- ✅ No references to deleted fields

## Implementation Sequence

```
11.106.1 (Evaluate context attributes)
    ↓
11.106.2 (Remove non-extractable type attributes)
    ↓
11.106.3 (Simplify type_flow to assignment_type)
    ↓
11.106.4 (Refine ReferenceContext)
    ↓
11.106.5 (Implement optional chain detection)
    ↓
11.106.6 (Verify extractable receiver type hints)
    ↓
11.106.7 (Update tests for method resolution)
    ↓
11.106.8 (Update documentation)
```

## Files Affected

| File | Tasks | Change Type |
|------|-------|------------|
| `packages/types/src/semantic_index.ts` | 2,3,4 | Interface refinement |
| `packages/core/src/.../reference_builder.ts` | 2,3,4,5,6 | Implementation updates |
| `packages/core/src/.../javascript_metadata.ts` | 5,6 | Enhance extractors |
| `packages/core/src/.../python_metadata.ts` | 6 | Verify extractors |
| `packages/core/src/.../rust_metadata.ts` | 6 | Verify extractors |
| Test files | 7 | Method resolution tests |
| Documentation | 8 | Extractability docs |

## Success Metrics

### Design Quality
- ✅ Every attribute has tree-sitter query mapping
- ✅ Every attribute serves method resolution
- ✅ Interface is minimal (no redundant fields)
- ✅ Clear separation: extractable vs. inference-based

### Functional Verification
- ✅ Receiver type hints extracted from all explicit sources
- ✅ Optional chaining captured correctly
- ✅ Property chains captured for resolution
- ✅ Cross-language parity maintained

### Code Quality
- ✅ TypeScript compiles with 0 errors
- ✅ All method resolution test scenarios pass
- ✅ No assertions on non-extractable attributes

## Testing Strategy

Focus on **method resolution scenarios**, not exhaustive interface coverage:

### Receiver Type Extraction
- Type annotations: `const obj: MyClass = ...`
- Constructor calls: `const obj = new MyClass()`
- Annotated returns: `function(): MyClass`

### Method Call Patterns
- Simple calls: `obj.method()`
- Chained calls: `obj.getProp().method()`
- Optional chaining: `obj?.method()`

### Cross-Language
- Verify patterns work in JS/TS/Python/Rust (where applicable)
- Language-specific syntax handled correctly

## Risk Assessment

**Risk Level:** Medium (Interface redesign)

**Mitigation:**
- Blinkered approach prevents being influenced by legacy patterns
- Tree-sitter query-first ensures extractability
- Method resolution focus provides clear design criteria
- Test-driven validation ensures functionality

## Related Tasks

- **task-epic-11.104** - Metadata extraction foundation
- **Future** - Method call resolution implementation (will use these attributes)

## Design Principles (Reference)

**Blinkered Approach:**
- Don't audit existing code usage
- Don't preserve fields "just in case"
- Design from method resolution requirements
- Design from tree-sitter capabilities

**Tree-Sitter First:**
- Every attribute must map to query captures
- No semantic analysis or inference
- Explicit syntax only (annotations, keywords)
- Cross-language patterns where syntax supports it

**Method Resolution Focus:**
- Would this help resolve `obj.method()`?
- Does this identify the receiver type?
- Does this support chained/optional access?
- If not → Remove it

## Estimated Time Breakdown

| Sub-task | Estimated | Notes |
|----------|-----------|-------|
| 11.106.1 | 45 min | Evaluate context attributes |
| 11.106.2 | 30 min | Remove non-extractable fields |
| 11.106.3 | 30 min | Simplify type_flow |
| 11.106.4 | 30 min | Refine ReferenceContext |
| 11.106.5 | 60 min | Implement optional chain |
| 11.106.6 | 45 min | Verify receiver type extraction |
| 11.106.7 | 45 min | Update tests |
| 11.106.8 | 20 min | Update docs |
| **Total** | **~5.5 hours** | Includes implementation & testing |

## Definition of Done

- ✅ Every attribute justified by method resolution need
- ✅ Every attribute mapped to tree-sitter query
- ✅ No attributes requiring inference/semantic analysis
- ✅ Optional chaining captured (JS/TS)
- ✅ Receiver type hints captured (all languages)
- ✅ Tests verify method resolution scenarios
- ✅ Documentation explains extractability
- ✅ TypeScript compiles, tests pass
- ✅ Cross-language parity verified

---

**Last Updated:** 2025-10-01
**Next Step:** Start with 11.106.1 (Audit type_flow usage)
