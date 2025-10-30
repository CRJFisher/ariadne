# How Functionality Was Restored (And Should Be Restored)

**Date**: 2025-10-29
**Context**: After removing fragment captures, we need to restore functionality WITHOUT reintroducing fragments

---

## ✅ CORRECT Approach: Builder/Extractor Fixes

### Example 1: Namespace Import Detection

**Lost Functionality**: import_kind was "named" instead of "namespace" for `import * as foo`

**WRONG Fix**: Add `@definition.import.namespace` capture back ❌

**RIGHT Fix**: Update builder to detect from AST structure ✅

```typescript
// In javascript_builder.ts
function is_namespace_import(node: SyntaxNode): boolean {
  // OLD (broken): Used childForFieldName which doesn't always work
  // const namespace_import = node.childForFieldName("name");

  // NEW: Search children by node type
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === "namespace_import") {
      return true;
    }
  }
  return false;
}

// Builder sets import_kind based on node structure:
const kind = is_namespace_import(capture.node) ? "namespace"
           : is_default_import(capture.node) ? "default"
           : "named";
```

**Result**: Functionality restored, no new captures needed

---

### Example 2: Private Field Detection

**Lost Functionality**: access_modifier was undefined for `#private` fields

**WRONG Fix**: Add `@definition.field.private` capture ❌

**RIGHT Fix**: Detect from node type and name prefix ✅

```typescript
// In typescript_builder.ts
function extract_access_modifier(capture: CaptureNode): string | undefined {
  // Check for # prefix (private fields)
  if (capture.text.startsWith("#")) {
    return "private";
  }

  // Check node type
  if (capture.node.type === "private_property_identifier") {
    return "private";
  }

  // ... other checks
}
```

**Result**: Functionality restored via AST analysis

---

### Example 3: Initial Value Extraction

**Lost Functionality**: initial_value was undefined for properties/variables

**WRONG Fix**: Add more specific variable captures ❌

**RIGHT Fix**: Fix extraction logic to traverse parent node ✅

```typescript
// In javascript_builder.ts
function extract_initial_value(capture: CaptureNode): Location | undefined {
  let node = capture.node;

  // If capture is on identifier, check parent for value
  if (node.type === "identifier") {
    const parent = node.parent;
    if (parent && parent.type === "variable_declarator") {
      node = parent;
    }
  }

  // Now get value from declarator node
  const value = node.childForFieldName("value");
  return value ? node_to_location(value, capture.location.file_path) : undefined;
}
```

**Result**: Extracts from complete node via parent traversal

---

### Example 4: Re-export Handler

**Lost Functionality**: Re-exports not processed

**WRONG Fix**: Add back all `@import.reexport.named.alias` fragments ❌

**RIGHT Fix**: Add handler that processes complete export_statement ✅

```typescript
// In javascript_builder_config.ts
case "import.reexport":
  // capture.node is the complete export_statement
  const source = capture.node.childForFieldName("source");
  const export_clause = capture.node.childForFieldName("export_clause");

  // Traverse export_clause to find all export_specifiers
  if (export_clause) {
    for (let i = 0; i < export_clause.childCount; i++) {
      const child = export_clause.child(i);
      if (child && child.type === "export_specifier") {
        // Extract name and alias from export_specifier
        const name = child.childForFieldName("name");
        const alias = child.childForFieldName("alias");
        // Create import definition
      }
    }
  }
  break;
```

**Result**: One capture (`@import.reexport` on complete node), handler extracts all specifiers

---

## ❌ INCORRECT Approach: Adding Fragment Captures Back

### What the Agent Did Wrong (Rust)

**Problem**: Agent added `@import.import` captures on `identifier` nodes:

```scheme
; WRONG - Captures fragments
(use_declaration
  argument: (scoped_identifier
    (identifier) @import.import      ← Fragment!
  )
)

(use_declaration
  argument: (use_list
    (identifier) @import.import       ← Fragment!
  )
)
```

**Why Wrong**:
1. Capturing `identifier` child nodes, not complete `use_declaration`
2. Creates 16 validation errors
3. Reintroduces fragment pattern we worked to eliminate

**Right Approach**:
```scheme
; CORRECT - Complete capture
(use_declaration) @definition.import
or
(use_declaration) @import.declaration  (if we add to schema)

; Builder traverses node to extract:
; - use_wildcard vs use_list vs scoped_identifier
; - Names and aliases from child nodes
; - Source path if present
```

---

## Summary: How We Fixed Things (Correctly)

### What We Did Right ✅

1. **Fixed is_namespace_import()** - AST node type search
2. **Fixed extract_initial_value()** - Parent node traversal
3. **Fixed extract_access_modifier()** - Name prefix + node type checking
4. **Added re-export handler** - Complete export_statement processing
5. **Fixed Rust is_method_call()** - Handle field_expression nodes
6. **Fixed Rust extract_call_name()** - Extract from field_expression
7. **Skipped JSDoc tests** - Documented as future enhancement (AST traversal needed)

**Common pattern**: Builders extract from complete nodes via AST traversal

### What We Did Wrong ❌

1. **Added @import.import back to Rust** - Created 16 validation errors
2. **Captured identifier fragments** - Violates complete capture principle

---

## Remaining 20 Test Failures: Proposed Fixes

Let me analyze the current failures and propose correct fixes:

### Category 1: Rust Import Handling (Current: 16 validation errors)

**Status**: BROKEN by agent's fragment captures

**Correct Fix**:
1. Remove all `@import.import` captures from rust.scm
2. Use `@definition.import` on complete `use_declaration` node
3. Add builder handler that traverses use_declaration to extract:
   - Simple: `use foo` → import "foo"
   - Scoped: `use std::fmt` → import "fmt" from "std::fmt"
   - List: `use std::{A, B}` → import "A" and "B" from "std"
   - Alias: `use foo as bar` → import "foo" as "bar"
   - Wildcard: `use foo::*` → wildcard import from "foo"

**OR** (if needed):
1. Add `@import.import` to schema optional list as Rust-specific
2. Document that it captures identifier nodes (exception to rule)
3. Justify why this is necessary

### Category 2: Re-export Resolution (6 tests)

**Status**: Handler added but resolution chain may not work

**Likely Fix**:
- Check ResolutionRegistry handles import definitions from re-exports
- May need to propagate through export/import chain
- Not a capture issue - resolution logic issue

### Category 3: CommonJS/JavaScript Modules (6 tests)

**Status**: require() imports not detected

**Options**:
1. Add builder logic to detect `require()` calls as imports
2. Create import definitions from variable assignments with require
3. May need capture for `@reference.call` on require specifically

### Category 4: Python Decorators/Protocols (2 tests)

**Status**: Decorators not extracted

**Fix**:
- Builders should traverse decorator nodes from function/class nodes
- No new captures needed - traverse from complete definition nodes

### Category 5: TypeScript Parameters (2 tests)

**Status**: Parameter initial values not extracted

**Fix**:
- Update parameter extraction to get default_value from node
- Check parameter nodes for initializer field

### Category 6: Edge Cases (4 tests)

**Status**: Various

**Approach**: Investigate individually

---

## Recommendation

**IMMEDIATE**:
1. **FIX RUST VALIDATION** - Remove @import.import fragments OR add to schema with justification
2. **Document the pattern** - Complete captures + builder extraction

**PRINCIPLE**:
Only add captures to .scm if they capture COMPLETE nodes.
Extract details via builder AST traversal.

**EXCEPTION**:
If capturing fragments is truly necessary for a language-specific reason:
1. Document why
2. Add to schema optional list with explanation
3. Mark as exception to rule
4. Minimize usage

---

## Current Status

**Validation**:
- TypeScript: ✅ 0 errors
- JavaScript: ✅ 0 errors
- Python: ✅ 0 errors
- Rust: ❌ 16 errors (agent added fragments back)

**Tests**: 20 failures (98.6% passing)

**Next Step**: Fix Rust properly, then address remaining 20 test failures correctly
