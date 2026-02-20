; Tree-Sitter Query Template for New Languages
; Use this as starting point when adding support for a new language
;
; IMPORTANT: See CAPTURE-SCHEMA.md in this directory for complete documentation
;
; PRINCIPLES:
; 1. COMPLETE CAPTURES - Capture entire nodes, not fragments
; 2. ONE CAPTURE PER CONSTRUCT - No duplicates
; 3. BUILDER EXTRACTION - Extractors derive multiple entities from single capture
;
; Captures marked with [REQUIRED] must exist in every language
; Captures marked [OPTIONAL] are for language-specific features
;
; Validate with: npm run validate:captures -- --lang=yourlanguage

; ============================================================================
; SCOPES [REQUIRED]
; ============================================================================
; Capture scope-creating constructs
; Note: Capture the scope itself, builders will extract scope boundaries

; Module/file-level scope
(program) @scope.module

; Function scope
(function_declaration) @scope.function

; Class scope
(class_declaration) @scope.class

; Block scope (if/while/for bodies)
(statement_block) @scope.block

; ============================================================================
; DEFINITIONS [REQUIRED]
; ============================================================================
; Capture definition sites - where symbols are introduced

; Function definitions
(function_declaration
  name: (identifier) @definition.function
)

; Class definitions
(class_declaration
  name: (identifier) @definition.class
)

; Method definitions
(method_definition
  name: (property_identifier) @definition.method
)

; Constructor definitions
(method_definition
  name: (property_identifier) @definition.constructor
  (#match? @definition.constructor "^constructor$")
)

; Variable definitions
(variable_declarator
  name: (identifier) @definition.variable
)

; Parameter definitions
(formal_parameter
  name: (identifier) @definition.parameter
)

; Field/property definitions
(field_definition
  name: (property_identifier) @definition.field
)

; ============================================================================
; REFERENCES [REQUIRED]
; ============================================================================
; Capture reference sites - where symbols are used

; Function/method calls - COMPLETE CAPTURE on call node
; DO NOT capture property_identifier or field_identifier
; Use extractors to derive method name, receiver, etc.
(call_expression) @reference.call

; Variable references
(identifier) @reference.variable

; Variable in property chains (for receiver tracking)
(member_expression
  object: (identifier) @reference.variable.base
)

; Source/target in assignments (for data flow)
(assignment_expression
  left: (identifier) @reference.variable.target
  right: (identifier) @reference.variable.source
)

; 'this' keyword
(this) @reference.this

; 'super' keyword
(super) @reference.super

; Type references (in annotations, extends clauses, etc.)
(type_identifier) @reference.type_reference

; ============================================================================
; ASSIGNMENTS / RETURNS [REQUIRED]
; ============================================================================

; Variable assignments
(assignment_expression) @assignment.variable

; Return statements
(return_statement) @return.variable

; ============================================================================
; EXPORTS [REQUIRED]
; ============================================================================

; Export declarations
(export_statement) @export.variable

; ============================================================================
; MODIFIERS [REQUIRED]
; ============================================================================

; Visibility modifiers (public, private, protected, etc.)
(accessibility_modifier) @modifier.visibility

; ============================================================================
; OPTIONAL CAPTURES (Language-Specific)
; ============================================================================
; Add language-specific features below
; Make sure to add corresponding entries to capture_schema.ts optional list

; Example: TypeScript interfaces
; (interface_declaration
;   name: (type_identifier) @definition.interface
; )

; Example: Python decorators
; (decorator) @decorator.function

; Example: Rust traits
; (trait_item
;   name: (type_identifier) @definition.trait
; )

; ============================================================================
; NOTES FOR NEW LANGUAGE IMPLEMENTATION
; ============================================================================
;
; 1. Replace placeholder node types with your language's actual tree-sitter nodes
;    - Check tree-sitter grammar for your language
;    - Use tree-sitter playground to inspect AST
;
; 2. Some node names will be different:
;    - JavaScript/TypeScript: call_expression
;    - Python: call
;    - Rust: call_expression
;    All use @reference.call (same semantic meaning)
;
; 3. Focus on COMPLETE captures:
;    - Capture call_expression, not property_identifier
;    - Capture method_definition, not just the name
;    - Let extractors handle deriving child data
;
; 4. Test incrementally:
;    - Add one capture category at a time
;    - Run validation: npm run validate:captures -- --lang=yourlanguage
;    - Run tests: npm test -- yourlanguage
;
; 5. Required captures MUST exist - implement all of them
;    - Validation will fail if any required capture is missing
;
; 6. Optional captures - add to capture_schema.ts first
;    - Add pattern to optional list
;    - Document why it's needed
;    - Then add to your .scm file
;
; 7. Extractors and Builders:
;    - Create {language}_metadata.ts with extractors
;    - Create {language}_builder_config.ts with builder handlers
;    - See existing languages for examples
;
; Good luck! Refer to CAPTURE-SCHEMA.md and existing .scm files for guidance.
