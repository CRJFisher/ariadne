# Reference Metadata Extraction Implementation Plan

## Current State

`reference_builder.ts` creates basic `SymbolReference` objects with:

- ✅ `location` - capture location
- ✅ `type` - reference type (call, member_access, type, etc.)
- ✅ `scope_id` - containing scope
- ✅ `name` - symbol name
- ❌ `context` - **STUBBED** (always returns undefined)
- ❌ `type_info` - **STUBBED** (always returns undefined)
- ❌ `call_type` - works (derived from capture name)
- ❌ `member_access` - **STUBBED** (object_type always undefined)

## Architecture Decision: Language-Specific Metadata Extractors

**Key Insight:** Metadata extraction requires parsing tree-sitter `SyntaxNode` structures, which differ by language.

### Example: Method Call Metadata

```typescript
// JavaScript/TypeScript AST
obj.method()
→ call_expression {
    function: member_expression {
      object: identifier "obj"
      property: identifier "method"
    }
  }

// Python AST
obj.method()
→ call {
    function: attribute {
      object: identifier "obj"
      attribute: identifier "method"
    }
  }

// Rust AST
obj.method()
→ call_expression {
    function: field_expression {
      value: identifier "obj"
      field: identifier "method"
    }
  }
```

**Different node types, same metadata goal** → Need language-specific extractors

---

## Three-Phase Implementation Plan

### **Phase 1: Basic References (Current - WORKS)**

**Status:** ✅ Implemented in reference_builder.ts

**What Works:**

- Reference location tracking
- Reference type classification (call, member_access, type, etc.)
- Scope association
- Call type detection (function vs method vs constructor)

**What's Missing:**

- All metadata fields (type_info, context, member_access details)

**Good Enough For:**

- Basic call graph construction
- Symbol usage tracking
- Scope-aware reference counting

---

### **Phase 2: Language-Specific Metadata Extractors**

**Goal:** Create extraction helpers for each language

**Architecture:**

```
query_code_tree/
└── language_configs/
    ├── javascript_metadata.ts    # JS/TS metadata extractors
    ├── python_metadata.ts        # Python metadata extractors
    └── rust_metadata.ts          # Rust metadata extractors
```

**Each module exports:**

```typescript
export interface MetadataExtractors {
  // Extract type from type annotation nodes
  extract_type_from_annotation(node: SyntaxNode): TypeInfo | undefined;

  // Extract receiver/object from method call
  extract_call_receiver(node: SyntaxNode): Location | undefined;

  // Extract property access chain (a.b.c.d → ["a", "b", "c", "d"])
  extract_property_chain(node: SyntaxNode): SymbolName[] | undefined;

  // Extract assignment source/target
  extract_assignment_parts(node: SyntaxNode): {
    source: Location | undefined;
    target: Location | undefined;
  };

  // Extract constructor call target variable
  extract_construct_target(node: SyntaxNode): Location | undefined;

  // Extract generic type arguments (Array<T> → "T")
  extract_type_arguments(node: SyntaxNode): string[] | undefined;
}
```

**Implementation Steps:**

1. **Create `javascript_metadata.ts`** (~200 lines)

   - Implement all extractors for JS/TS AST structure
   - Handle both JavaScript and TypeScript node types
   - Test with real code samples

2. **Create `typescript_metadata.ts`** (might merge with JS)

   - TypeScript-specific type annotations
   - Generic type parameters
   - Interface/type reference extraction

3. **Create `python_metadata.ts`** (~150 lines)

   - Python AST structure (attribute vs member_expression)
   - Type hint extraction (Python 3 annotations)
   - Special handling for `self` parameter

4. **Create `rust_metadata.ts`** (~200 lines)
   - Rust AST structure (field_expression, method_call_expression)
   - Turbofish generics (`::<T>`)
   - Trait bound extraction

**Estimated Effort:** 4-6 hours (1-1.5 hours per language)

---

### **Phase 3: Wire Extractors into ReferenceBuilder**

**Goal:** Update reference_builder.ts to use language-specific extractors

**Changes to reference_builder.ts:**

```typescript
import type { MetadataExtractors } from "./language_configs/metadata_types";

export class ReferenceBuilder {
  constructor(
    private readonly context: ProcessingContext,
    private readonly extractors: MetadataExtractors // NEW
  ) {}

  process(capture: CaptureNode): ReferenceBuilder {
    // ... existing code ...

    // Replace stubbed extraction with real extractors
    const type_info = this.extractors.extract_type_from_annotation(
      capture.node
    );
    const context = this.build_context(capture);

    // ... rest of processing
  }

  private build_context(capture: CaptureNode): ReferenceContext | undefined {
    const kind = determine_reference_kind(capture);

    if (kind === ReferenceKind.METHOD_CALL) {
      return {
        receiver_location: this.extractors.extract_call_receiver(capture.node),
      };
    }

    if (kind === ReferenceKind.PROPERTY_ACCESS) {
      return {
        property_chain: this.extractors.extract_property_chain(capture.node),
      };
    }

    if (kind === ReferenceKind.ASSIGNMENT) {
      const parts = this.extractors.extract_assignment_parts(capture.node);
      return {
        assignment_source: parts.source,
        assignment_target: parts.target,
      };
    }

    return undefined;
  }
}
```

**Update semantic_index.ts:**

```typescript
function process_references_with_metadata(
  context: ProcessingContext,
  language: Language
): SymbolReference[] {
  const extractors = get_metadata_extractors(language);
  return new ReferenceBuilder(context, extractors).process_all().build();
}

function get_metadata_extractors(language: Language): MetadataExtractors {
  switch (language) {
    case "javascript":
    case "typescript":
      return JAVASCRIPT_METADATA_EXTRACTORS;
    case "python":
      return PYTHON_METADATA_EXTRACTORS;
    case "rust":
      return RUST_METADATA_EXTRACTORS;
  }
}
```

**Estimated Effort:** 2 hours

---

## Incremental Rollout Strategy

### Week 1: Foundation

- ✅ Basic references working (Phase 1 - DONE)
- ✅ semantic_index.ts rewrite (DONE)
- ⏳ Test basic reference extraction

### Week 2: JavaScript/TypeScript

- Implement `javascript_metadata.ts`
- Wire into reference_builder
- Test with real JS/TS codebases
- Validate call graphs are more accurate

### Week 3: Python

- Implement `python_metadata.ts`
- Test with Python projects
- Compare against old reference system

### Week 4: Rust

- Implement `rust_metadata.ts`
- Complete language coverage
- Delete old reference processing system

---

## Testing Strategy

### Unit Tests

Each metadata extractor module needs tests:

```typescript
describe("javascript_metadata", () => {
  it("should extract method call receiver", () => {
    const code = "obj.method()";
    const node = parse_and_find_call(code);
    const receiver = extract_call_receiver(node);
    expect(receiver).toBeDefined();
    expect(receiver.start_line).toBe(1);
  });

  it("should extract property chain", () => {
    const code = "a.b.c.d";
    const node = parse_and_find_member_expression(code);
    const chain = extract_property_chain(node);
    expect(chain).toEqual(["a", "b", "c", "d"]);
  });
});
```

### Integration Tests

Compare reference quality before/after:

```typescript
it("should have richer method call references", () => {
  const index = build_semantic_index(code, tree, "javascript");
  const method_calls = index.references.filter((r) => r.call_type === "method");

  // After Phase 2+3, these should have metadata
  expect(method_calls[0].member_access?.object_type).toBeDefined();
  expect(method_calls[0].context?.receiver_location).toBeDefined();
});
```

---

## Success Criteria

### Phase 1 (DONE)

- ✅ Basic references extracted
- ✅ Correct reference types
- ✅ Scope associations correct

### Phase 2 + 3 (TODO)

- ✅ 80%+ method calls have receiver information
- ✅ 90%+ type references have type_info
- ✅ Property chains extracted for chained access
- ✅ Assignment source/target tracked
- ✅ No regressions in call graph accuracy

---

## Current Recommendation

**Start with Phase 2 for JavaScript only** as a proof-of-concept:

1. Create `javascript_metadata.ts` with all extractors
2. Wire into reference_builder (add extractors parameter)
3. Test with real JavaScript codebase
4. Measure impact on call graph quality

**If successful**, roll out to other languages in sequence.

**If metadata isn't critical yet**, keep Phase 1 and focus on:

- Getting basic call graphs working end-to-end
- Cross-file resolution
- Method resolution improvements

The architecture supports incremental enhancement, so metadata can be added when needed without breaking existing functionality.
