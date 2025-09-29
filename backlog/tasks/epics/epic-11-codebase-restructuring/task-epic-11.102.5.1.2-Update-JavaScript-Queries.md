# Task: Update JavaScript Query File

## Status: Created

## Parent Task

task-epic-11.102.5.1 - Update JavaScript

## Objective

Clean up and optimize `javascript.scm` to contain only the essential captures needed for the new builder system, removing all unnecessary or redundant captures.

## Current Issues

The current query file likely contains:
- Redundant captures for the same entities
- Overly specific captures that could be generalized
- Captures for intermediate representations no longer needed
- Missing captures for new requirements (scopes, imports, etc.)

## New Query Structure

### File Location

`packages/core/src/parse_and_query_code/queries/javascript.scm`

### Essential Captures

```scheme
;; ============================================
;; SCOPES - Process first for context
;; ============================================

;; Module scope (implicit - entire file)
(program) @scope.module

;; Function scopes
(function_declaration
  body: (statement_block) @scope.function)

(function_expression
  body: (statement_block) @scope.function)

(arrow_function
  body: (statement_block) @scope.function)

;; Class scope
(class_declaration
  body: (class_body) @scope.class)

(class_expression
  body: (class_body) @scope.class)

;; Block scopes
(statement_block) @scope.block
(if_statement
  consequence: (statement_block) @scope.block
  alternative: (statement_block)? @scope.block)
(for_statement
  body: (statement_block) @scope.block)
(while_statement
  body: (statement_block) @scope.block)

;; ============================================
;; DEFINITIONS
;; ============================================

;; Classes
(class_declaration
  name: (identifier) @def.class)

(class_expression
  name: (identifier) @def.class)

;; Class inheritance
(class_declaration
  superclass: (identifier) @def.extends)

;; Methods
(method_definition
  name: (property_identifier) @def.method)

(method_definition
  key: (identifier) @def.method)

;; Constructor
(method_definition
  key: (identifier) @def.constructor
  (#eq? @def.constructor "constructor"))

;; Functions
(function_declaration
  name: (identifier) @def.function)

(variable_declarator
  name: (identifier) @def.function
  value: (function_expression))

(variable_declarator
  name: (identifier) @def.function
  value: (arrow_function))

;; Parameters
(formal_parameters
  (identifier) @def.parameter)

(formal_parameters
  (assignment_pattern
    left: (identifier) @def.parameter))

(formal_parameters
  (rest_pattern
    (identifier) @def.parameter))

;; Variables
(variable_declarator
  name: (identifier) @def.variable)

;; Properties (class fields)
(field_definition
  property: (property_identifier) @def.property)

(field_definition
  property: (private_property_identifier) @def.property)

;; Imports
(import_clause
  (identifier) @def.import)  ;; default import

(import_clause
  (namespace_import
    (identifier) @def.import))  ;; import * as name

(import_clause
  (named_imports
    (import_specifier
      name: (identifier) @def.import)))  ;; named import

(import_clause
  (named_imports
    (import_specifier
      alias: (identifier) @def.import)))  ;; aliased import

;; Exports (as definitions)
(export_statement
  declaration: (function_declaration
    name: (identifier) @def.export))

(export_statement
  declaration: (class_declaration
    name: (identifier) @def.export))

(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @def.export)))

;; ============================================
;; REFERENCES
;; ============================================

;; Function/method calls
(call_expression
  function: (identifier) @ref.call)

(call_expression
  function: (member_expression
    property: (property_identifier) @ref.call))

;; Property access
(member_expression
  property: (property_identifier) @ref.property)

;; Variable references
(identifier) @ref.variable
  (#not-has-ancestor? @ref.variable
    function_declaration
    class_declaration
    variable_declarator
    formal_parameters
    import_clause
    export_clause)

;; Constructor calls
(new_expression
  constructor: (identifier) @ref.constructor)
```

## Captures to Remove

- Any captures with complex modifiers that should be handled in code
- Duplicate captures for the same semantic element
- Captures for formatting or style elements
- Captures for comments or documentation (handle separately)
- Overly specific captures that miss edge cases

## Query Optimization Guidelines

1. **Keep it simple** - Let the builder handle complexity
2. **Capture at declaration** - Not at usage sites
3. **Use predicates sparingly** - Only for disambiguation
4. **Avoid nested captures** - Process relationships in builders
5. **One capture per semantic element** - No duplicates

## Testing Requirements

Each capture must be tested with:
- Basic case (standard syntax)
- Edge cases (unusual but valid syntax)
- Nested cases (definitions inside definitions)
- Export variations
- Dynamic constructs (computed properties, etc.)

## Success Criteria

- [ ] All essential captures present
- [ ] No redundant captures
- [ ] Clear capture naming convention
- [ ] Scopes properly captured
- [ ] All definition types captured
- [ ] All reference types captured
- [ ] Query file is clean and well-commented
- [ ] Performance optimized (no expensive predicates)

## Estimated Effort

~1 hour