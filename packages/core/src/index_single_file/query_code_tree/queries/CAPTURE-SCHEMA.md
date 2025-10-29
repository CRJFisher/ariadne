# Tree-Sitter Capture Schema

This document defines the canonical capture schema for all tree-sitter query files (`.scm` files) in the Ariadne codebase.

---

## Purpose

The capture schema ensures:

- **Consistency** across all supported languages
- **Clarity** in what each capture represents semantically
- **Maintainability** when adding new languages or modifying queries
- **Quality** through automated validation

---

## Core Principles

### 1. Complete Captures

**Capture entire syntactic units, not fragments:**

```scheme
✅ GOOD - Capture complete call_expression
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call

❌ BAD - Capture fragments (property_identifier AND call_expression)
(call_expression
  function: (member_expression
    property: (property_identifier) @reference.call    ; Fragment 1
  )
) @reference.call.full                                 ; Fragment 2
```

**Why**: One capture per construct eliminates duplicates and ambiguity.

### 2. Builder Extraction

**One capture produces multiple semantic entities:**

`@reference.call` on `call_expression` → Extractor derives:
- Call reference name (via `extract_call_name()`)
- Receiver location (via `extract_call_receiver()`)
- Property chain (via `extract_property_chain()`)
- Call type: function vs method (via `is_method_call()`)

**Benefit**: Adding new extracted data doesn't require changing queries.

### 3. Positive Validation

**Only explicitly listed captures are valid:**
- Required captures (must exist in every language)
- Optional captures (language-specific features)
- Everything else is implicitly invalid

**Example**:
- `@reference.call` → in required list → ✅ valid
- `@reference.call.full` → NOT in any list → ❌ invalid

---

## Naming Convention

All captures follow this pattern:

```
@{category}.{entity}[.{qualifier}]
```

**Examples:**
- `@definition.function` - Function definition
- `@reference.call` - Function/method call
- `@scope.class` - Class scope
- `@reference.call.generic` - Generic function call (optional qualifier)

### Parts Explained

1. **Category** (required): Maps to `SemanticCategory` enum
   - `scope`, `definition`, `reference`, `import`, `export`, `type`, `assignment`, `return`, `decorator`, `modifier`

2. **Entity** (required): Maps to `SemanticEntity` enum
   - `module`, `class`, `function`, `method`, `constructor`, `variable`, `parameter`, `call`, etc.

3. **Qualifier** (optional): Additional specificity
   - `generic`, `optional`, `computed`, `static`, `async`, etc.

### Rules

- Maximum 3 parts (category.entity.qualifier)
- Use lowercase with underscores: `type_alias` not `typeAlias`
- Must match: `/^@[a-z_]+\.[a-z_]+(\.[a-z_]+)?$/`

---

## Required Captures

Every language MUST implement these captures (from common analysis):

### Scopes
- `@scope.module` - File/module scope
- `@scope.function` - Function scope
- `@scope.class` - Class scope
- `@scope.block` - Block scope

### Definitions
- `@definition.function` - Function definitions
- `@definition.class` - Class definitions
- `@definition.method` - Method definitions
- `@definition.constructor` - Constructor definitions
- `@definition.variable` - Variable definitions
- `@definition.parameter` - Parameters
- `@definition.field` - Class fields/properties

### References
- `@reference.call` - Function/method calls (**complete node only**)
- `@reference.variable` - Variable references
- `@reference.variable.base` - Base object in chains
- `@reference.variable.source` - Source in assignments
- `@reference.variable.target` - Target in assignments
- `@reference.this` - 'this' keyword
- `@reference.super` - 'super' keyword
- `@reference.type_reference` - Type references

### Assignments/Returns
- `@assignment.variable` - Variable assignment
- `@return.variable` - Return statement

### Exports
- `@export.variable` - Exported declarations

### Modifiers
- `@modifier.visibility` - Visibility modifiers

---

## Optional Captures

Language-specific features explicitly allowed:

### TypeScript/JavaScript
- `@definition.interface` - Interface definitions
- `@definition.type_alias` - Type aliases
- `@definition.enum` - Enum definitions
- `@definition.enum_member` - Enum members
- `@definition.namespace` - Namespaces
- `@definition.type_parameter` - Generic type parameters
- `@definition.property` - Class properties
- `@reference.call.generic` - Generic calls
- `@reference.constructor` - Constructor calls
- `@reference.constructor.generic` - Generic constructor calls
- `@reference.property` - Property access
- `@reference.property.optional` - Optional chaining
- `@reference.member_access` - Member access patterns
- `@reference.call.jsx` - JSX elements

### Python
- `@decorator.function` - Function decorators
- `@decorator.class` - Class decorators
- `@decorator.method` - Method decorators
- `@decorator.property` - Property decorators

### Rust
- `@definition.trait` - Trait definitions
- `@definition.impl` - Impl blocks
- `@definition.type_alias` - Type aliases
- `@definition.enum` - Enums
- `@scope.trait`, `@scope.impl` - Rust-specific scopes

### All Languages
- `@scope.closure` - Closure/lambda scopes
- `@modifier.*` - Various modifiers (static, async, etc.)
- `@export.*` - Export variants
- `@import.reexport` - Re-export patterns

---

## Validation

Captures are validated automatically in CI using `validate_captures.ts`.

### Run Validation Locally

```bash
npm run validate:captures              # All languages
npm run validate:captures -- --lang=typescript  # Specific language
```

### Validation Checks

**Errors** (fail CI):
- Capture not in required OR optional lists
- Invalid naming convention
- Exceeds max depth (>3 parts)

**Warnings** (visible but don't fail):
- Capture on fragment node (property_identifier instead of call_expression)
- Duplicate captures on same line
- Heuristic checks for "complete capture" principle

---

## Examples by Language

### TypeScript Method Call

```scheme
; Correct - complete capture
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call

; Extractor derives method name from call_expression
; Extractor determines if method call vs function call
```

### Python Method Call

```scheme
; Python uses 'call' and 'attribute'
(call
  function: (attribute
    object: (_) @reference.variable
    attribute: (identifier)
  )
) @reference.call

; Same principle: complete 'call' node, not 'identifier' fragment
```

### Rust Method Call

```scheme
; Rust uses field_expression for methods
(call_expression
  function: (field_expression
    value: (_) @reference.variable
    field: (field_identifier)
  )
) @reference.call

; Complete call_expression, not field_identifier fragment
```

---

## Adding a New Language

When adding support for a new language:

1. **Start with template**: Use `TEMPLATE.scm` in this directory

2. **Implement required captures**: All captures from "Required" section above

3. **Add language-specific captures**: Add to optional list in `capture_schema.ts`

4. **Validate**: Run `npm run validate:captures` - must pass with 0 errors

5. **Test**: Ensure semantic index tests pass

6. **Document**: Add language-specific notes to this document

---

## Frequently Asked Questions

### Q: Why only one capture per method call?

**A**: Duplicate captures create ambiguity and bugs. The complete capture principle means we capture the entire `call_expression` once, then use extractors to get all needed information.

### Q: Can I add custom qualifiers?

**A**: Yes, but add the full capture pattern to the optional captures list in `capture_schema.ts` first. Qualifiers must be semantic (`.generic`, `.optional`) not structural (`.full`, `.chained`).

### Q: What if my language needs something not in the schema?

**A**: Add it as an optional capture with clear justification:
1. Add pattern to `capture_schema.ts` optional list
2. Document in this file under language-specific section
3. Explain why it's needed
4. Run validation to confirm it works

### Q: How do I handle language-specific syntax differences?

**A**: Node types are language-specific (that's expected). Capture names should map to universal semantic concepts.

Examples:
- TypeScript `call_expression` vs Python `call` → both use `@reference.call`
- TypeScript `member_expression` vs Python `attribute` → both use `@reference.variable` for receiver
- Rust `field_expression` vs TypeScript `member_expression` → same semantic meaning

### Q: Why don't we capture method names separately?

**A**: We use **complete captures** - capture the entire call expression, then extract the method name programmatically via `extract_call_name()`. This eliminates duplicate captures and makes queries cleaner.

---

## Division of Responsibility

### Queries (.scm files)
**What to capture**: Complete syntactic units
- `call_expression` (not `property_identifier`)
- `method_definition` (captures name, builder accumulates parameters)
- One capture per construct

### Builders/Extractors (TypeScript code)
**What to extract**: Multiple semantic entities from single capture
- Method name from call expression
- Parameters from method definition node
- Return types from traversing AST
- Type annotations, decorators, etc.

This separation means:
✅ Queries stay simple and consistent
✅ Builders handle complexity
✅ Adding new extraction doesn't require query changes

---

**Last Updated**: 2025-10-29
**Schema Version**: 1.0
**Validation**: `npm run validate:captures`
**Schema Definition**: `capture_schema.ts` in parent directory
