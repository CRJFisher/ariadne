# Task Epic 11.154.2: Design Canonical Capture Schema

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: ✅ COMPLETED (2025-10-29)
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days
**Actual Time**: ~4 hours (pending team review)

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

## Core Design Principle: Complete Captures

### The Problem with Fragment Captures

**Current problematic pattern** (creates duplicates):
```scheme
(call_expression
  function: (member_expression
    property: (property_identifier) @reference.call     ; Fragment 1
  )
) @reference.call.full                                  ; Fragment 2
```

This creates TWO captures for ONE syntactic construct, leading to processing ambiguity.

### The Solution: Complete Captures

**Capture the entire syntactic unit ONCE**, then extract multiple semantic entities from it:

```scheme
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call                                       ; Single complete capture
```

The builder/extractor then extracts:
- Call reference (the method call itself)
- Receiver location (from member_expression object field)
- Method name (from property_identifier via extract_call_name())
- Property chain (via extract_property_chain())

**One capture in → multiple entities out**

### Examples Across Entity Types

#### Method Definitions

**Complete capture**:
```scheme
(method_definition
  name: (property_identifier) @definition.method
  parameters: (formal_parameters) @_params
  body: (statement_block) @scope.method.body
)
```

**Builder extracts**:
- Method definition (name, location, scope_id)
- Parameters (from traversing formal_parameters node)
- Return type annotation (if present in node)
- Body scope (from scope capture)

#### Function Calls

**Complete capture**:
```scheme
(call_expression) @reference.call
```

**Extractor extracts** (via metadata extractors):
- Call reference (name, location)
- Receiver location (if method call)
- Property chain (for chained calls)
- Call type (function vs method vs constructor)

#### Class Definitions

**Complete capture**:
```scheme
(class_declaration
  name: (identifier) @definition.class
  body: (class_body) @scope.class.body
)
```

**Builder extracts**:
- Class definition (name, location)
- Superclass (if present in heritage clause)
- Methods (accumulated from @definition.method captures within class scope)
- Properties (accumulated from @definition.property captures)
- Decorators (accumulated from @decorator.class captures)

### How Validation Enforces This

**Validation checks**:

1. **No fragment captures allowed** - Only complete syntactic units in schema
   - ❌ `@reference.call` on `property_identifier` → NOT in schema → invalid
   - ✅ `@reference.call` on `call_expression` → in schema → valid

2. **No duplicate qualifiers** - `.full`, `.chained`, `.deep` won't be in schema
   - Because we capture complete units, there's no need for these

3. **One-to-many relationship** - One capture can produce many entities
   - Schema defines what we capture (syntactic)
   - Builders define what we extract (semantic)
   - Clear separation of concerns

### Benefits

✅ **Eliminates duplicates** - One capture per construct
✅ **Clear intent** - Capture complete syntactic units
✅ **Flexible extraction** - Builders can extract whatever they need
✅ **Maintainable** - Adding new extracted data doesn't require new captures
✅ **Testable** - Easy to validate "one capture per construct"

---

## Deliverables

### 1. Schema Implementation

**File**: `packages/core/src/index_single_file/query_code_tree/capture_schema.ts`

```typescript
/**
 * Canonical capture schema for all tree-sitter query files
 *
 * DESIGN PRINCIPLES:
 *
 * 1. COMPLETE CAPTURES - Capture entire syntactic units, not fragments
 *    - Capture the full method_definition node, not method name + parameters separately
 *    - Capture the full call_expression node, not property_identifier + call separately
 *    - One capture → multiple semantic entities extracted by builders
 *
 * 2. POSITIVE VALIDATION - Only explicitly allowed captures are valid
 *    - Required captures (must exist in every language)
 *    - Optional captures (language-specific features)
 *    - Everything else is implicitly invalid
 *
 * 3. BUILDER EXTRACTION - Builders extract multiple entities from single captures
 *    - @definition.method capture → method def + parameters + return type
 *    - @reference.call capture → call ref + receiver + property chain
 *    - Eliminates duplicate/overlapping captures
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
   * Expected node types for this capture across languages
   * Used to enforce "complete capture" principle
   *
   * Example for @reference.call:
   * - TypeScript/JavaScript: call_expression
   * - Python: call
   * - Rust: call_expression
   *
   * Validation can warn if capture targets fragment nodes like:
   * - property_identifier (should be on parent call_expression)
   * - identifier in attribute context (should be on parent call)
   */
  expected_node_types?: {
    typescript?: string[];
    javascript?: string[];
    python?: string[];
    rust?: string[];
  };

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
        "Function/method call - SINGLE capture on complete call node",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(call_expression) @reference.call",
      expected_node_types: {
        typescript: ["call_expression"],
        javascript: ["call_expression"],
        python: ["call"],
        rust: ["call_expression"]
      },
      notes:
        "Captures complete call node. Extractors derive: method name, receiver, property chain, call type. DO NOT capture fragments (property_identifier, identifier).",
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

/**
 * Get recommendations for improving a capture (node type checking)
 *
 * Note: Full node type validation requires parsing the .scm file context,
 * which is complex. This provides heuristic checks based on common patterns.
 */
export function get_capture_recommendations(
  capture_name: string,
  capture_context: string
): string[] {
  const recommendations: string[] = [];

  // Check for fragment capture patterns (heuristic)
  if (capture_name === "@reference.call") {
    // Look for problematic patterns in context
    if (capture_context.includes("property_identifier") ||
        capture_context.includes("field_identifier") ||
        (capture_context.includes("identifier") && capture_context.includes("attribute"))) {
      recommendations.push(
        "WARNING: @reference.call should capture complete call node (call_expression/call), " +
        "not property/field/attribute identifier. Move capture to parent call node."
      );
    }
  }

  // Add more heuristic checks for other common fragment patterns
  if (capture_name.startsWith("@definition.")) {
    if (capture_context.includes("@" + capture_name.substring(1)) &&
        !capture_context.includes("name:")) {
      recommendations.push(
        "Consider capturing at declaration level, not just name identifier."
      );
    }
  }

  return recommendations;
}
```

### 2. User-Facing Documentation

**File**: `packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md`

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

## Capture Philosophy: Complete Units, Builder Extraction

### Capture Complete Syntactic Units

Queries should capture **complete nodes**, not fragments:

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

### Builders Extract Multiple Entities

**One capture produces multiple semantic entities:**

`@reference.call` on `call_expression` → Extractor derives:
- Call reference (name via extract_call_name())
- Receiver location (via extract_call_receiver())
- Property chain (via extract_property_chain())
- Call type: function vs method (via is_method_call())

`@definition.method` on method name → Builder accumulates:
- Method definition
- Parameters (from @definition.parameter captures in method scope)
- Return type (from traversing method node's return type field)
- Body scope (from @scope.method.body)
- Decorators (from @decorator.method captures)

### Division of Responsibility

**Queries (.scm files)**:
- Capture complete syntactic units
- One capture per construct
- Target top-level nodes (call_expression, method_definition, etc.)

**Builders/Extractors (TypeScript)**:
- Extract multiple semantic entities from single capture
- Traverse node structure to find child data
- Build complete definitions from accumulated captures

This separation means: **Adding new extracted data doesn't require new captures**

Example: If we want to extract JSDoc comments from methods, we update the builder, not the query.

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
; See CAPTURE-SCHEMA.md in this directory for details

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
```

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

---

## Implementation Summary

### Deliverables Created

#### 1. Capture Schema Implementation
**File**: `packages/core/src/index_single_file/query_code_tree/capture_schema.ts` (320 lines)

**Structure**:
- `CapturePattern` interface with `expected_node_types` for fragment detection
- `CaptureSchema` interface with required + optional (positive validation)
- `NamingRules` interface (pattern, max_depth)
- `CANONICAL_CAPTURE_SCHEMA` with 23 required + 20+ optional patterns
- `is_valid_capture()` - positive validation helper
- `get_capture_errors()` - error checking helper

**Design principles implemented**:
1. Complete captures (capture entire nodes)
2. Positive validation (required + optional only)
3. Builder extraction (one capture → multiple entities)

#### 2. User Documentation
**File**: `packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md` (300+ lines)

**Sections**:
- Purpose and principles
- Naming convention
- Required captures (23 patterns)
- Optional captures (language-specific)
- Validation approach
- Examples by language
- FAQ
- Adding new languages guide

#### 3. Template for New Languages
**File**: `packages/core/src/index_single_file/query_code_tree/queries/TEMPLATE.scm` (150+ lines)

**Contents**:
- All required captures with examples
- Placeholder patterns for language adaptation
- Comprehensive comments and guidance
- Notes for implementation

### Key Design Decisions

#### Required Captures (23 total)
Based on 24 common captures from analysis, filtered to remove duplicates:
- **Removed**: `@reference.call.chained` (duplicate, will be invalid)
- **Kept**: 23 truly required patterns that appear in all languages

Categories:
- Scopes: 4 (module, function, class, block)
- Definitions: 7 (function, class, method, constructor, variable, parameter, field)
- References: 8 (call, variable variants, this, super, type_reference)
- Assignments/Returns: 2
- Exports: 1
- Modifiers: 1

#### Optional Captures (20+ patterns)
Language-specific features explicitly allowed:
- TypeScript: interfaces, type aliases, enums, generics
- Python: decorators
- Rust: traits, impl blocks
- All: property access variants, constructor calls, etc.

#### What's NOT Allowed
With positive validation, these are automatically invalid:
- `@reference.call.full` - not in schema
- `@reference.call.chained` - not in schema
- `@reference.call.deep` - not in schema
- Any other pattern not explicitly listed

### Validation Strategy

**Errors** (fail CI):
- Capture not in required/optional
- Invalid naming pattern
- Exceeds max depth

**Warnings** (visible, don't fail):
- Fragment captures detected (heuristic)
- Captures on property_identifier instead of call_expression
- Duplicate captures on same line

### Schema Statistics

- **Required patterns**: 23
- **Optional patterns**: ~20 (with regex allowing variants)
- **Total allowed captures**: ~100-150 (when regex patterns expand)
- **Total current captures**: 393 unique → many will become invalid

This represents significant cleanup: ~240 invalid captures will be flagged!

### Next Steps

**Pending**:
- [ ] Team review meeting (scheduled)
- [ ] Schema approval from stakeholders
- [ ] Feedback incorporation if needed

**Ready for**:
- ✅ Task 11.154.3 - Validation implementation can proceed
- ✅ Tasks 11.154.4-7 - Query fixes have clear targets

### Time Breakdown

- Schema design and drafting: 2 hours
- Documentation writing: 1.5 hours
- Template creation: 0.5 hour

**Total: ~4 hours** (under 2-day estimate)

**Note**: Team review time not included (external dependency)

### Success Metrics

✅ Schema covers all SemanticCategory and SemanticEntity values
✅ Complete capture principle documented
✅ Positive validation approach implemented
✅ All three deliverables created
✅ No compilation errors
✅ Ready for validation implementation

---

## Files Created

- `packages/core/src/index_single_file/query_code_tree/capture_schema.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md`
- `packages/core/src/index_single_file/query_code_tree/queries/TEMPLATE.scm`
- `backlog/tasks/epics/epic-11-codebase-restructuring/FRAGMENT-CAPTURE-DETECTION.md`

**Total**: 4 files, ~900 lines of code and documentation
