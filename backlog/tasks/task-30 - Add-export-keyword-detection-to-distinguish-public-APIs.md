---
id: task-30
title: Add export keyword detection to distinguish public APIs
status: In Progress
assignee:
  - '@claude'
created_date: '2025-07-18'
updated_date: '2025-08-02'
labels:
  - enhancement
  - parser
  - scope-analysis
dependencies: []
---

## Description

The scope mechanism currently treats all root-level definitions as exported. This task enhances the parser to detect export keywords/modifiers, enabling accurate identification of a module's public API versus internal functions.

## Acceptance Criteria

- [x] Detect export keywords in TypeScript/JavaScript (export, export default)
- [x] Handle module.exports and exports assignments
- [x] Support Python conventions (__all__, _underscore prefix)
- [x] Detect Rust pub keyword for public items
- [x] Add is_exported field to Def interface
- [x] Update get_exported_functions to filter by export status
- [x] Maintain backward compatibility with existing code

## Implementation Plan

1. Research tree-sitter queries for export detection
2. Design is_exported field for Def interface
3. Modify build_scope_graph to detect export keywords
4. Handle TypeScript/JavaScript export patterns
5. Implement Python convention detection
6. Add Rust pub keyword detection
7. Update get_exported_functions to use is_exported
8. Ensure backward compatibility
9. Write comprehensive tests for each language

## Implementation Notes

### Completed Implementation

1. **Added `is_exported` field to Def interface**:
   - Optional boolean field to maintain backward compatibility
   - Defaults to undefined for existing code

2. **TypeScript/JavaScript Export Detection**:
   - Direct exports: `export function`, `export const`, `export class`
   - Export lists: `export { name1, name2 }`
   - Default exports: `export default`
   - CommonJS: `module.exports = {}` and `exports.name = value`
   - Implemented in `findExportedNames()` function

3. **Python Export Conventions**:
   - `__all__` list detection for explicit exports
   - Underscore prefix convention (`_private` vs `public`)
   - Special methods (`__init__`) treated as public
   - Root-level scope checking
   - Implemented in `findPythonAllExports()` and export checks

4. **Rust pub Keyword Detection**:
   - Checks for `pub` visibility modifier before definitions
   - Works with functions, structs, enums, and nested items
   - Sibling-based detection in AST

5. **API Updates**:
   - `get_exported_functions()` now uses `is_exported` flag
   - `findExportedDef()` respects `is_exported === false`
   - Maintains backward compatibility (undefined treated as exported for root-level)

6. **Comprehensive Testing**:
   - Created `export_detection.test.ts` with 11 test cases
   - Covers all languages and export patterns
   - All tests passing

### Key Design Decisions

1. **AST-based Detection**: Uses tree-sitter AST traversal rather than regex or string matching
2. **Language-specific Logic**: Each language has its own export detection rules
3. **Backward Compatible**: Existing code continues to work with undefined `is_exported`
4. **Performance**: Export detection happens during initial parsing, no additional passes needed

## Technical Details

### Difficulty: Hard

**Estimated Time:** 4-6 hours

### Implementation Approaches

#### Option 1: Enhance Scope Queries (Recommended but Complex)

```scheme
; In typescript/scopes.scm
(export_statement
  declaration: (function_declaration
    name: (identifier) @hoist.definition.function.exported))

(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @reference)))
```

#### Option 2: Post-Process AST

```typescript
interface Def extends BaseNode {
  kind: "definition";
  name: string;
  symbol_kind: string;
  file_path: string;
  metadata?: FunctionMetadata;
  is_exported?: boolean; // New field
}

function check_if_exported(def: Def, tree: Tree): boolean {
  const node = tree.rootNode.descendantForPosition(
    def.range.start,
    def.range.end
  );

  let current = node;
  while (current) {
    if (
      current.type === "export_statement" ||
      current.type === "export_specifier" ||
      current.previousSibling?.type === "export"
    ) {
      return true;
    }

    // Check for module.exports assignment
    if (current.type === "assignment_expression") {
      const left = current.childForFieldName("left");
      if (left?.text?.startsWith("module.exports")) {
        return true;
      }
    }

    current = current.parent;
  }
  return false;
}
```

### Language-Specific Patterns

#### TypeScript/JavaScript

- `export function foo() {}`
- `export default function() {}`
- `export { foo, bar }`
- `module.exports = { foo }`
- `exports.foo = function() {}`

#### Python

- No explicit exports - use conventions:
  - `__all__ = ['public_func']`
  - Functions starting with `_` are private
  - Everything else in root scope is public

#### Rust

- `pub fn foo() {}`
- `pub(crate) fn bar() {}`
- Module visibility rules

### Key Challenges

- Each language has completely different export mechanisms
- Need to handle re-exports and barrel exports
- Performance impact of AST traversal
- Maintaining backward compatibility
- Default exports vs named exports
