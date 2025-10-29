# Task Epic 11.154.2: Design Canonical Capture Schema

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Design a language-agnostic canonical schema that defines required and optional capture patterns for all tree-sitter query files. Uses positive validation - any capture not explicitly listed is invalid.

---

## Context

Based on the analysis from Task 11.154.1, we now know:

- Current capture patterns across all languages
- Which patterns are duplicates/problematic
- How captures map to our semantic model

This task translates that analysis into a formal schema that will:

1. Guide query file refactoring (Tasks 11.154.4-7)
2. Enable automated validation (Task 11.154.3)
3. Serve as documentation for adding new languages

---

## Deliverables

### 1. Schema Implementation

**File**: `packages/core/src/index_single_file/query_code_tree/capture_schema.ts`

```typescript
/**
 * Canonical capture schema for all tree-sitter query files
 *
 * Uses POSITIVE validation:
 * - Required captures (must exist in every language)
 * - Optional captures (allowed language-specific features)
 * - Everything else is implicitly invalid
 *
 * This approach is closed and maintainable - we explicitly list what IS allowed,
 * rather than trying to enumerate everything that ISN'T allowed.
 */

import { SemanticCategory, SemanticEntity } from "../semantic_index";

// ============================================================================
// Core Types
// ============================================================================

export interface CaptureSchema {
  /**
   * Required captures - every language MUST have these
   *
   * Based on common captures from analysis (24 core patterns)
   */
  required: CapturePattern[];

  /**
   * Optional captures - language-specific features allowed
   *
   * Explicitly lists all valid optional captures.
   * Any capture not in required OR optional is INVALID.
   */
  optional: CapturePattern[];

  /**
   * Naming conventions and rules
   */
  rules: NamingRules;
}

export interface CapturePattern {
  /**
   * Regular expression matching valid capture names
   * Example: /^@definition\.function$/
   */
  pattern: RegExp;

  /**
   * Human-readable description of what this captures
   */
  description: string;

  /**
   * Which semantic category this maps to
   */
  category: SemanticCategory;

  /**
   * Which semantic entity this maps to
   */
  entity: SemanticEntity;

  /**
   * Example usage in .scm file
   */
  example: string;

  /**
   * Language-specific notes (if any)
   */
  notes?: string;
}


export interface NamingRules {
  /**
   * Overall pattern: @{category}.{entity}[.{qualifier}]
   */
  pattern: RegExp;

  /**
   * Maximum nesting depth (e.g., @a.b.c.d = 4 parts)
   */
  max_depth: number;
}

// ============================================================================
// Canonical Schema Definition
// ============================================================================

export const CANONICAL_CAPTURE_SCHEMA: CaptureSchema = {
  // ========================================
  // REQUIRED CAPTURES
  // ========================================
  required: [
    // --- Scope Captures ---
    {
      pattern: /^@scope\.module\.body$/,
      description: "Module/file-level scope body",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.MODULE,
      example: "(program) @scope.module.body",
    },
    {
      pattern: /^@scope\.function\.body$/,
      description: "Function body scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION,
      example: "(statement_block) @scope.function.body",
    },
    {
      pattern: /^@scope\.class\.body$/,
      description: "Class body scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
      example: "(class_body) @scope.class.body",
    },
    {
      pattern: /^@scope\.method\.body$/,
      description: "Method body scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.METHOD,
      example: "(statement_block) @scope.method.body",
    },

    // --- Definition Captures ---
    {
      pattern: /^@definition\.function$/,
      description: "Function definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      example: "(function_declaration name: (identifier) @definition.function)",
    },
    {
      pattern: /^@definition\.class$/,
      description: "Class definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
      example: "(class_declaration name: (identifier) @definition.class)",
    },
    {
      pattern: /^@definition\.method$/,
      description: "Method definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      example:
        "(method_definition name: (property_identifier) @definition.method)",
    },
    {
      pattern: /^@definition\.variable$/,
      description: "Variable definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      example: "(variable_declarator name: (identifier) @definition.variable)",
    },
    {
      pattern: /^@definition\.parameter$/,
      description: "Function/method parameter name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      example: "(formal_parameter name: (identifier) @definition.parameter)",
    },

    // --- Reference Captures ---
    {
      pattern: /^@reference\.call$/,
      description:
        "Function/method call - SINGLE capture on call_expression node only",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(call_expression) @reference.call",
      notes:
        "DO NOT capture both property_identifier AND call_expression. Use extractors to get method name.",
    },
    {
      pattern: /^@reference\.variable$/,
      description: "Variable reference",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(identifier) @reference.variable",
    },

    // --- Import/Export Captures ---
    {
      pattern: /^@definition\.import$/,
      description: "Import statement",
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      example: "(import_statement) @definition.import",
    },

    // Add more required patterns...
  ],

  // ========================================
  // OPTIONAL CAPTURES
  // ========================================
  // Explicitly lists all valid optional captures.
  // Any capture not in required OR optional will be flagged as invalid.
  optional: [
    // TypeScript-specific
    {
      pattern: /^@definition\.interface$/,
      description: "TypeScript interface definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
      example:
        "(interface_declaration name: (type_identifier) @definition.interface)",
    },
    {
      pattern: /^@definition\.type_alias$/,
      description: "TypeScript/Python type alias",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_ALIAS,
      example:
        "(type_alias_declaration name: (type_identifier) @definition.type_alias)",
    },
    {
      pattern: /^@definition\.enum$/,
      description: "TypeScript/Rust enum definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
      example: "(enum_declaration name: (identifier) @definition.enum)",
    },

    // Python-specific
    {
      pattern: /^@decorator\.(class|function|method)$/,
      description: "Python decorator",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.METHOD, // or CLASS, FUNCTION
      example: "(decorator) @decorator.function",
    },

    // Rust-specific
    {
      pattern: /^@definition\.trait$/,
      description: "Rust trait definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE, // Map to interface semantically
      example: "(trait_item name: (type_identifier) @definition.trait)",
    },

    // Language-agnostic optional qualifiers
    {
      pattern: /^@reference\.call\.generic$/,
      description: "Generic function/method call with type arguments",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(call_expression type_arguments: (_)) @reference.call.generic",
    },
    {
      pattern: /^@definition\.constructor$/,
      description: "Constructor definition (explicit in some languages)",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTRUCTOR,
      example:
        "(method_definition name: (property_identifier) @definition.constructor)",
    },

    // Add more optional patterns...
  ],

  // ========================================
  // NAMING RULES
  // ========================================
  rules: {
    pattern: /^@[a-z_]+\.[a-z_]+(\.[a-z_]+)?$/,
    max_depth: 3
  },
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a capture name is valid according to the schema
 *
 * Uses POSITIVE validation: capture must be in required OR optional lists
 */
export function is_valid_capture(capture_name: string): boolean {
  // Must match overall naming pattern
  if (!CANONICAL_CAPTURE_SCHEMA.rules.pattern.test(capture_name)) {
    return false;
  }

  // Must be in required OR optional lists
  const is_required = CANONICAL_CAPTURE_SCHEMA.required.some(p =>
    p.pattern.test(capture_name)
  );
  const is_optional = CANONICAL_CAPTURE_SCHEMA.optional.some(p =>
    p.pattern.test(capture_name)
  );

  return is_required || is_optional;
}

/**
 * Get validation errors for a capture name
 */
export function get_capture_errors(capture_name: string): string[] {
  const errors: string[] = [];

  // Check naming rules
  if (!CANONICAL_CAPTURE_SCHEMA.rules.pattern.test(capture_name)) {
    errors.push(
      `Invalid capture name format. Must follow: @category.entity[.qualifier]`
    );
  }

  // Check depth
  const parts = capture_name.substring(1).split("."); // Remove leading @
  if (parts.length > CANONICAL_CAPTURE_SCHEMA.rules.max_depth) {
    errors.push(
      `Too many nesting levels (${parts.length}). Maximum is ${CANONICAL_CAPTURE_SCHEMA.rules.max_depth}`
    );
  }

  // Check if capture is in allowed lists (required OR optional)
  const is_required = CANONICAL_CAPTURE_SCHEMA.required.some(p =>
    p.pattern.test(capture_name)
  );
  const is_optional = CANONICAL_CAPTURE_SCHEMA.optional.some(p =>
    p.pattern.test(capture_name)
  );

  if (!is_required && !is_optional) {
    errors.push(
      `Capture '${capture_name}' is not in required or optional lists. ` +
      `All valid captures must be explicitly defined in the schema.`
    );
  }

  return errors;
}
```

### 2. User-Facing Documentation

**File**: `packages/core/docs/CAPTURE-SCHEMA.md`

```markdown
# Tree-Sitter Capture Schema

This document defines the canonical capture schema for all tree-sitter query files (`.scm` files) in the Ariadne codebase.

## Purpose

The capture schema ensures:

- **Consistency** across all supported languages
- **Clarity** in what each capture represents semantically
- **Maintainability** when adding new languages or modifying queries
- **Quality** through automated validation

## Naming Convention

All captures follow this pattern:
```

@{category}.{entity}[.{qualifier}]

````

**Examples:**
- `@definition.function` - Function definition
- `@reference.call` - Function/method call
- `@scope.class.body` - Class body scope
- `@reference.call.generic` - Generic function call (with type arguments)

### Parts Explained

1. **Category** (required): Maps to `SemanticCategory` enum
   - `scope`, `definition`, `reference`, `import`, `export`, `type`, `assignment`, `return`, `decorator`, `modifier`

2. **Entity** (required): Maps to `SemanticEntity` enum
   - `module`, `class`, `function`, `method`, `constructor`, `variable`, `parameter`, `call`, etc.

3. **Qualifier** (optional): Additional specificity
   - `body`, `generic`, `optional`, `computed`, `static`, `async`, etc.

### Rules

- Maximum 3 parts (category.entity.qualifier)
- Use lowercase with underscores: `type_alias` not `typeAlias`
- No version suffixes: `old`, `new`, `v2`, `temp`
- No test captures in production queries

## Required Captures

Every language MUST implement these captures:

### Scopes
- `@scope.module.body` - File/module scope
- `@scope.function.body` - Function scope
- `@scope.class.body` - Class scope
- `@scope.method.body` - Method scope

### Definitions
- `@definition.function` - Function definitions
- `@definition.class` - Class definitions
- `@definition.method` - Method definitions
- `@definition.variable` - Variable definitions
- `@definition.parameter` - Parameters

### References
- `@reference.call` - Function/method calls (single capture per call)
- `@reference.variable` - Variable references

### Imports/Exports
- `@definition.import` - Import statements

## Optional Captures

Language-specific features:

### TypeScript/JavaScript
- `@definition.interface` - Interface definitions
- `@definition.type_alias` - Type aliases
- `@definition.enum` - Enum definitions
- `@reference.call.generic` - Generic calls with type arguments

### Python
- `@decorator.function` - Function decorators
- `@decorator.class` - Class decorators

### Rust
- `@definition.trait` - Trait definitions
- `@definition.impl` - Impl blocks

## Validation Approach

**Uses POSITIVE validation** - only explicitly listed captures are valid.

Any capture not in the required OR optional lists will be flagged as invalid during validation.

### Why This Approach?

Instead of maintaining an ever-growing list of "prohibited" patterns, we explicitly define what IS allowed:
- **Required captures**: Must exist in every language
- **Optional captures**: Allowed language-specific features

Everything else is implicitly invalid - no need to enumerate all possible bad patterns.

### Example: Why @reference.call.full is Invalid

```scheme
; This will fail validation:
) @reference.call.full

; Because @reference.call.full is NOT in required or optional lists
; Only @reference.call is defined in required captures
```

The validation error will be:
```
Capture '@reference.call.full' is not in required or optional lists.
All valid captures must be explicitly defined in the schema.
```


## Adding a New Language

When adding support for a new language:

1. **Start with template**: Use `queries/TEMPLATE.scm` (to be created)

2. **Implement required captures**: All captures from "Required" section

3. **Add language-specific captures**: Document any optional captures needed

4. **Validate**: Run `npm run validate:captures` - must pass with 0 errors

5. **Test**: Ensure semantic index tests pass

6. **Document**: Add language-specific notes to this document

## Validation

Captures are validated automatically in CI using `validate_captures.ts`.

**Run validation locally:**

```bash
npm run validate:captures
```

**Validation checks:**

- All required captures present
- All captures are in required OR optional lists (positive validation)
- Naming convention followed (@category.entity[.qualifier])
- Maximum depth enforced (<= 3 parts)

## Examples by Language

### TypeScript Method Call

```scheme
; Correct way to capture method calls
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call

; Extract method name using extractors.extract_call_name()
; Determine if method call using extractors.is_method_call()
```

### Python Method Call

```scheme
; Python uses 'attribute' instead of 'member_expression'
(call
  function: (attribute
    object: (_) @reference.variable
    attribute: (identifier)
  )
) @reference.call
```

### Rust Method Call

```scheme
; Rust uses 'field_expression'
(call_expression
  function: (field_expression
    value: (_) @reference.variable
    field: (field_identifier)
  )
) @reference.call
```

## Frequently Asked Questions

### Q: Why only one capture per method call?

**A**: Duplicate captures create ambiguity and bugs. Use metadata extractors to get additional information (method name, receiver type, etc.).

### Q: Can I use custom qualifiers?

**A**: Yes, but they must be added to the schema. Add the full capture pattern (e.g., `@reference.call.myqualifier`) to the optional captures list in `capture_schema.ts`.

### Q: What if my language needs something not in the schema?

**A**: Add it as an optional capture with clear justification. Update this document and the schema definition.

### Q: How do I handle language-specific syntax?

**A**: Node types are language-specific (that's fine). Capture names should map to universal semantic concepts.

---

**Last Updated**: 2025-10-29
**Schema Version**: 1.0
**Maintained By**: [Team Name]

````

---

## Implementation Steps

### Step 1: Review Analysis Document

Read `CAPTURE-SCHEMA-ANALYSIS.md` from Task 11.154.1:
- Understand current state
- Note problematic patterns
- Identify commonalities

### Step 2: Draft Schema

Create initial version of `capture_schema.ts`:

- Start with required captures (based on 24 common captures from analysis)
- Add optional captures (based on 138 language-specific captures from analysis)
- Define naming rules (pattern, max_depth)
- Use positive validation: only list what IS allowed
- No need for reserved keywords or prohibited lists - if it's not in required/optional, it's invalid

### Step 3: Team Review Meeting

Schedule 2-hour meeting with team:

- Present schema design and positive validation approach
- Discuss required vs optional boundaries
- Review which captures should be allowed
- Get buy-in on naming convention

**Key questions:**
- Are required captures truly universal?
- Are optional captures justified?
- Is naming convention clear?
- Will this work for future languages?

### Step 4: Incorporate Feedback

Update schema based on team input:
- Adjust required/optional boundaries
- Add missing language-specific needs
- Clarify ambiguous rules
- Add examples for clarity

### Step 5: Write Documentation

Create `CAPTURE-SCHEMA.md`:
- Explain purpose and benefits
- Document naming convention with examples
- Provide language-specific guidance
- Include FAQ section

### Step 6: Create Template

**File**: `packages/core/src/index_single_file/query_code_tree/queries/TEMPLATE.scm`

```scheme
; Tree-Sitter Query Template
; Use this as starting point for new languages
;
; Required captures marked with [REQUIRED]
; Optional captures marked with [OPTIONAL]
; See packages/core/docs/CAPTURE-SCHEMA.md for details

; ============================================================================
; SCOPES [REQUIRED]
; ============================================================================

; Module/file-level scope
(program) @scope.module.body

; Function scope
(function_declaration
  body: (statement_block) @scope.function.body
)

; Class scope
(class_declaration
  body: (class_body) @scope.class.body
)

; Method scope
(method_definition
  body: (statement_block) @scope.method.body
)

; ============================================================================
; DEFINITIONS [REQUIRED]
; ============================================================================

; Function definitions
(function_declaration
  name: (identifier) @definition.function
)

; ... more template patterns ...
````

### Step 7: Final Review

Ensure all deliverables are complete:

- [ ] Schema implementation (`capture_schema.ts`)
- [ ] User documentation (`CAPTURE-SCHEMA.md`)
- [ ] Template query file (`TEMPLATE.scm`)
- [ ] Team sign-off obtained

---

## Acceptance Criteria

- [ ] `capture_schema.ts` is complete with required and optional patterns (positive validation)
- [ ] All `SemanticCategory` and `SemanticEntity` values mapped
- [ ] Naming rules clearly defined with regex
- [ ] Max depth enforced (no more than 3 parts)
- [ ] User documentation (`CAPTURE-SCHEMA.md`) written and reviewed
- [ ] Template `.scm` file created
- [ ] Team review meeting completed with approval
- [ ] At least 2 team members have reviewed and approved schema
- [ ] Schema accounts for all four current languages (TS, JS, Py, Rust)
- [ ] All currently valid captures explicitly listed in required OR optional
- [ ] Duplicate captures (call.full, call.chained) NOT in allowed lists

---

## Dependencies

- **Depends on**: Task 11.154.1 (analysis must be complete)

---

## Blocks

- **Task 11.154.3** - Cannot implement validation without schema
- **Tasks 11.154.4-7** - Cannot refactor queries without schema

---

## Success Metrics

- Schema covers 100% of semantic model (all categories/entities)
- Team unanimously approves schema design
- Documentation is clear enough for new contributors
- Template is usable for adding new language

---

## Time Breakdown

- **Review analysis**: 2 hours
- **Draft schema**: 4 hours
- **Team review meeting**: 2 hours
- **Incorporate feedback**: 2 hours
- **Write documentation**: 4 hours
- **Create template**: 2 hours

**Total: 2 days (16 hours)**

---

## Notes

### Design Principles

1. **Semantic over syntactic** - Capture meaning, not just syntax
2. **Consistency over flexibility** - Same concepts, same names
3. **Minimal but complete** - No more captures than necessary
4. **Enforceable** - Rules that can be validated automatically

### Open Questions (Resolve in Team Review)

- Should we require `@export.*` captures?
- How to handle module systems (CommonJS vs ES6 vs Python)?
- Should qualifiers be strictly enumerated or open-ended?
- What about language-specific modifiers (Python's `async def`)?
