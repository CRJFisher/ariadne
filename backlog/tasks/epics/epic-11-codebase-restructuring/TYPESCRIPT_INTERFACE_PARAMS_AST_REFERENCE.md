# TypeScript Interface Method Parameters - AST Reference

**Task:** epic-11.108.13
**Generated:** 2025-10-02
**Purpose:** Document the verified tree-sitter AST structure for TypeScript interface method parameters

---

## Executive Summary

✅ **Verification Complete** - All query patterns and handlers correctly match the actual AST structure produced by tree-sitter-typescript.

**Key Findings:**
1. Interface method parameters use the exact same AST structure as regular function parameters
2. Existing query patterns (lines 428-439 in typescript.scm) already capture interface method parameters correctly
3. One bug fixed: rest parameter type extraction now correctly navigates the AST hierarchy
4. Duplicate query patterns exist but don't cause issues due to deduplication in handlers

---

## AST Structure Hierarchy

```
interface_declaration
└── interface_body
    └── method_signature
        ├── [name] property_identifier
        ├── [parameters] formal_parameters
        │   ├── (
        │   ├── required_parameter | optional_parameter
        │   │   ├── [pattern] identifier | rest_pattern
        │   │   └── [type] type_annotation
        │   └── )
        └── [return_type] type_annotation
```

---

## Parameter Types (Verified with tree-sitter)

### 1. Required Parameter

**Source:** `add(x: number, y: number): void`

**AST Structure:**
```
required_parameter "x: number"
├── [pattern] identifier "x"
└── [type] type_annotation ": number"
    ├── : ":"
    └── predefined_type "number"
```

**Query Pattern:** `(required_parameter pattern: (identifier) @definition.parameter)`

---

### 2. Optional Parameter

**Source:** `divide(a: number, b?: number): void`

**AST Structure:**
```
optional_parameter "b?: number"
├── [pattern] identifier "b"
├── ? "?"
└── [type] type_annotation ": number"
```

**Query Pattern:** `(optional_parameter pattern: (identifier) @definition.parameter.optional)`

**Detection:** Has a `?` token as a direct child of `optional_parameter`

---

### 3. Rest Parameter

**Source:** `log(...args: any[]): void`

**AST Structure:**
```
required_parameter "...args: any[]"
├── [pattern] rest_pattern "...args"
│   ├── ... "..."
│   └── identifier "args"  ← NO FIELD NAME!
└── [type] type_annotation ": any[]"
```

**Query Pattern:** `(rest_pattern (identifier) @definition.parameter.rest)`

**Critical Note:** The identifier inside `rest_pattern` has **NO field name**. Must access as direct child by type.

**Type Extraction Path:**
```
identifier (capture)
  ↓ .parent
rest_pattern
  ↓ .parent
required_parameter
  ↓ .childForFieldName("type")
type_annotation
```

---

## Implementation Verification

### Code Location: `typescript_builder.ts:649-672`

```typescript
export function extract_parameter_type(
  node: SyntaxNode
): SymbolName | undefined {
  // For rest parameters, the type annotation is on the grandparent
  if (node.parent?.type === "rest_pattern") {
    const requiredParam = node.parent.parent; // Navigate up 2 levels
    if (requiredParam) {
      const typeAnnotation = requiredParam.childForFieldName?.("type");
      if (typeAnnotation) {
        for (const child of typeAnnotation.children || []) {
          if (child.type !== ":") {
            return child.text as SymbolName; // e.g., "any[]"
          }
        }
      }
    }
    return undefined;
  }

  // For regular parameters
  return extract_property_type(node);
}
```

### Handler Configuration: `typescript_builder_config.ts:411-481`

All three parameter types use `find_containing_callable()` which correctly handles `method_signature` nodes:

```typescript
while (node) {
  if (
    node.type === "function_declaration" ||
    node.type === "function_expression" ||
    node.type === "arrow_function" ||
    node.type === "method_definition" ||
    node.type === "method_signature"  // ← Interface methods
  ) {
    // ... build method symbol ID
  }
  node = node.parent;
}
```

---

## Test Results

### Edge Cases Verified

✅ **Required parameters:** `add(x: number, y: number)` - Type: `number`
✅ **Optional parameters:** `divide(a: number, b?: number)` - Optional flag: `true`
✅ **Rest parameters:** `log(...args: any[])` - Type: `any[]` (fixed!)
✅ **Generic types:** `set(index: number, value: T)` - Type: `T`
✅ **Destructured parameters:** `parse(config: { x: number })` - Type: `{ x: number }`
✅ **Complex types:** `union(value: string | number)` - Full type preserved

### Test Suite Results

```
✓ semantic_index.typescript.test.ts (33 tests) - All pass
  ✓ "should extract interface with method signatures including parameters" (line 929)
```

### Duplicate Captures - RESOLVED ✅

**Issue:** Query file contained duplicate patterns for parameters (lines 147-159 and 428-439).

**Impact:** Created duplicate captures in query results (14 instead of 10). While handlers deduplicated using symbol IDs (so no duplicate parameters in final index), it was inefficient and confusing.

**Resolution:** Removed duplicate patterns at lines 147-159. These patterns were:
- Capturing `@definition.parameter` and `@definition.parameter.optional` (duplicates)
- Capturing `@type.type_annotation` (unused - no handlers exist for these captures)

**After Fix:**
- Query results: 10 parameter captures (no duplicates) ✅
- All tests pass ✅
- Semantic index works correctly ✅

---

## Field Names Verification

All field names verified against actual tree-sitter output:

### `method_signature` node
- `name`: `property_identifier`
- `parameters`: `formal_parameters`
- `return_type`: `type_annotation`

### `required_parameter` node
- `pattern`: `identifier` | `rest_pattern`
- `type`: `type_annotation`

### `optional_parameter` node
- `pattern`: `identifier`
- `type`: `type_annotation`

### `rest_pattern` node
- **No field names!**
- Children: `...` token, `identifier` (access by type, not field name)

---

## Conclusion

The implementation is **correct and complete**. The AST structure has been thoroughly verified using tree-sitter inspection. All query patterns, handlers, and type extraction logic match the actual AST structure produced by tree-sitter-typescript.

**Files Modified:**
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts` (rest parameter type fix)
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm` (removed duplicate patterns, enhanced documentation)

**Files Verified:**
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm` (query patterns)
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts` (handlers)

**Status:** ✅ Complete and production-ready

---

## Update History

### 2025-10-02 - Second Pass: Query Pattern Cleanup

**Changes:**
1. Removed duplicate parameter patterns from typescript.scm (lines 147-159)
2. Enhanced parameter section documentation with verified AST structure comments
3. Verified with tree-sitter query testing

**Results:**
- Parameter captures reduced from 14 to 10 (eliminated duplicates)
- All 33 TypeScript tests pass
- Semantic index verified working correctly

**Files Modified:**
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

See task document for detailed change log.
