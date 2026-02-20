# Task 11.106.7: Implement Optional Chain Detection

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 45 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.6 (or 11.106.5 if skipped)

## Objective

Implement detection of optional chaining syntax (`?.`) in JavaScript/TypeScript metadata extractors. This is currently always `false` but CAN be extracted from the AST.

## Background

JavaScript/TypeScript support optional chaining:
```javascript
obj?.method()      // Optional method call
obj?.prop          // Optional property access
obj?.prop?.nested  // Chained optional access
```

The AST represents these with specific node types that we can detect.

## Language Support

| Language | Syntax | AST Node Type | Implementation |
|----------|--------|---------------|----------------|
| JavaScript | `obj?.method()` | `optional_chain` | ✅ Implement |
| TypeScript | `obj?.method()` | `optional_chain` | ✅ Implement |
| Python | N/A | N/A | ✅ Return false (no optional chaining) |
| Rust | N/A | N/A | ✅ Return false (no optional chaining) |

## Changes Required

### 1. Enhance MetadataExtractors Interface

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/metadata_types.ts`

Update function signatures to return optional chain flag:

**Before:**
```typescript
export interface MetadataExtractors {
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  extract_property_chain(
    node: SyntaxNode
  ): SymbolName[] | undefined;
}
```

**After:**
```typescript
export interface MetadataExtractors {
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): { location: Location; is_optional: boolean } | undefined;

  extract_property_chain(
    node: SyntaxNode
  ): { chain: SymbolName[]; is_optional: boolean } | undefined;
}
```

### 2. Implement in JavaScript Metadata

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts`

Add optional chain detection:

```typescript
function is_optional_chain(node: SyntaxNode): boolean {
  // Check if this node or any parent is an optional_chain
  let current: SyntaxNode | null = node;

  while (current) {
    if (current.type === "optional_chain") {
      return true;
    }
    current = current.parent;
  }

  return false;
}

function extract_call_receiver(
  node: SyntaxNode,
  file_path: FilePath
): { location: Location; is_optional: boolean } | undefined {
  // ... existing logic to get receiver ...

  if (receiver_node) {
    return {
      location: node_to_location(receiver_node, file_path),
      is_optional: is_optional_chain(node),
    };
  }

  return undefined;
}

function extract_property_chain(
  node: SyntaxNode
): { chain: SymbolName[]; is_optional: boolean } | undefined {
  // ... existing logic to get chain ...

  if (chain.length > 0) {
    return {
      chain,
      is_optional: is_optional_chain(node),
    };
  }

  return undefined;
}
```

### 3. Update reference_builder.ts

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

Update to use new extractor return types:

**Location:** Around line 213-216 (extract_context function)

```typescript
function extract_context(
  capture: CaptureNode,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): ReferenceContext | undefined {
  if (!extractors) {
    return undefined;
  }

  let receiver_location: Location | undefined;
  let assignment_source: Location | undefined;
  let assignment_target: Location | undefined;
  let construct_target: Location | undefined;
  let property_chain: readonly SymbolName[] | undefined;
  let is_optional_chain = false;  // NEW

  // For method calls: extract receiver/object information
  const kind = determine_reference_kind(capture);
  if (kind === ReferenceKind.METHOD_CALL || kind === ReferenceKind.SUPER_CALL) {
    const receiver_result = extractors.extract_call_receiver(capture.node, file_path);
    if (receiver_result) {
      receiver_location = receiver_result.location;
      is_optional_chain = receiver_result.is_optional;  // NEW
    }
  }

  // For member access: extract property chain
  if (kind === ReferenceKind.PROPERTY_ACCESS || kind === ReferenceKind.METHOD_CALL) {
    const chain_result = extractors.extract_property_chain(capture.node);
    if (chain_result) {
      property_chain = chain_result.chain;
      is_optional_chain = is_optional_chain || chain_result.is_optional;  // NEW
    }
  }

  // ... rest of function ...
}
```

**Location:** Around line 270-275 (process_method_reference function)

Update member_access creation:

```typescript
const member_access = {
  object_type: type_info ? type_info : undefined,
  access_type: "method" as const,
  is_optional_chain: is_optional_chain,  // Use actual value instead of false
};
```

**Location:** Around line 445-448 (process function for property access)

```typescript
const member_access_info = {
  object_type: type_info ? type_info : undefined,
  access_type: "property" as const,
  is_optional_chain: is_optional_chain,  // Use actual value instead of false
};
```

### 4. Update Python/Rust Metadata (Return False)

Both languages don't have optional chaining, so update their extractors to return the new format:

**Files:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_metadata.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts`

```typescript
function extract_call_receiver(
  node: SyntaxNode,
  file_path: FilePath
): { location: Location; is_optional: boolean } | undefined {
  // ... existing logic ...

  if (receiver_node) {
    return {
      location: node_to_location(receiver_node, file_path),
      is_optional: false,  // Python/Rust don't have optional chaining
    };
  }

  return undefined;
}

function extract_property_chain(
  node: SyntaxNode
): { chain: SymbolName[]; is_optional: boolean } | undefined {
  // ... existing logic ...

  if (chain.length > 0) {
    return {
      chain,
      is_optional: false,  // Python/Rust don't have optional chaining
    };
  }

  return undefined;
}
```

## Testing

### 5. Add Test Cases

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.test.ts`

Add test cases:

```typescript
describe("extract_call_receiver - optional chaining", () => {
  it("detects optional method call", () => {
    const code = "obj?.method()";
    const tree = parser.parse(code);
    // ... parse and extract ...
    expect(result?.is_optional).toBe(true);
  });

  it("detects regular method call as non-optional", () => {
    const code = "obj.method()";
    const tree = parser.parse(code);
    // ... parse and extract ...
    expect(result?.is_optional).toBe(false);
  });

  it("detects chained optional calls", () => {
    const code = "obj?.prop?.method()";
    const tree = parser.parse(code);
    // ... parse and extract ...
    expect(result?.is_optional).toBe(true);
  });
});

describe("extract_property_chain - optional chaining", () => {
  it("detects optional property access", () => {
    const code = "obj?.prop";
    const tree = parser.parse(code);
    // ... parse and extract ...
    expect(result?.is_optional).toBe(true);
  });

  it("detects regular property as non-optional", () => {
    const code = "obj.prop";
    const tree = parser.parse(code);
    // ... parse and extract ...
    expect(result?.is_optional).toBe(false);
  });
});
```

## AST Structure Reference

Use tree-sitter CLI to examine optional chain structure:

```bash
npx tree-sitter parse --scope source.js "obj?.method()"
```

Expected structure:
```
call_expression
  function: optional_chain
    ?: "?."
    member_expression
      object: identifier "obj"
      property: property_identifier "method"
```

## Verification Steps

1. **TypeScript compilation:**
   ```bash
   npx tsc --noEmit
   ```
   Expected: 0 errors

2. **Run metadata tests:**
   ```bash
   npx vitest javascript_metadata.test.ts
   npx vitest python_metadata.test.ts
   npx vitest rust_metadata.test.ts
   ```
   Expected: All pass with new optional chain tests

3. **Run full test suite:**
   ```bash
   npm test
   ```
   Expected: No regressions

## Success Criteria

- ✅ Optional chain detection implemented for JS/TS
- ✅ Python/Rust return `false` (correct for those languages)
- ✅ Tests added for optional chaining cases
- ✅ `is_optional_chain` field now accurate (not always false)
- ✅ TypeScript compiles with 0 errors
- ✅ All tests pass

## Notes

### Why This Wasn't Implemented Initially

The metadata extraction work (task 11.104) focused on proving the architecture worked. Optional chain detection was noted as "could be enhanced" but deferred to avoid scope creep.

Now that the architecture is proven, adding this feature is straightforward.

### Edge Cases

1. **Nullish coalescing:** `obj ?? defaultObj` - NOT optional chaining
2. **Mixed chains:** `obj?.prop.nested` - First is optional, rest is not
3. **Call vs access:** `obj?.method` vs `obj?.method()` - Both are optional

The implementation should handle all these cases correctly by checking for the `optional_chain` AST node.
