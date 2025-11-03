;; ==============================================================================
;; SEMANTIC INDEX - TypeScript with Comprehensive Type System Support
;; ==============================================================================
;; Extends JavaScript patterns with TypeScript-specific constructs:
;; - Interfaces, type aliases, enums, namespaces
;; - Generic type parameters and constraints
;; - Type annotations and assertions
;; - Access modifiers and decorators
;; - TypeScript-specific imports/exports
;; ==============================================================================

;; ==============================================================================
;; SCOPES - Define lexical boundaries (JavaScript + TypeScript)
;; ==============================================================================

; Root scope
(program) @scope.module

; Function scopes
(function_declaration) @scope.function
(function_expression) @scope.function
(arrow_function) @scope.function
(method_definition) @scope.method
(generator_function_declaration) @scope.function
(generator_function) @scope.function

; Class scopes
(class_declaration
  body: (class_body) @scope.class
)
(abstract_class_declaration
  body: (class_body) @scope.class
)
(class
  body: (class_body) @scope.class
)

; TypeScript-specific scopes
(interface_declaration
  body: (interface_body) @scope.interface
)
(enum_declaration
  body: (enum_body) @scope.enum
)
(internal_module) @scope.namespace

; Block scopes
; Only capture standalone blocks (if/for/while/try/catch/etc.)
(for_statement) @scope.block
(for_in_statement) @scope.block
(while_statement) @scope.block
(do_statement) @scope.block
(if_statement) @scope.block
(switch_statement) @scope.block
(switch_case) @scope.block
(try_statement) @scope.block
(catch_clause) @scope.block
(finally_clause) @scope.block

;; ==============================================================================
;; TYPESCRIPT TYPE DEFINITIONS
;; ==============================================================================

; Interface definitions
(interface_declaration
  name: (type_identifier) @definition.interface
) @definition.interface

; Interface method signatures
(interface_declaration
  (interface_body
    (method_signature
      name: (property_identifier) @definition.interface.method
    ) @scope.method
  )
)

; Interface property signatures
(interface_declaration
  (interface_body
    (property_signature
      name: (property_identifier) @definition.interface.property
    )
  )
)

; Type alias definitions
(type_alias_declaration
  name: (type_identifier) @definition.type_alias
) @definition.type_alias

; Enum definitions
(enum_declaration
  name: (identifier) @definition.enum
) @definition.enum

; Enum members
(enum_body
  (property_identifier) @definition.enum_member
)

(enum_body
  (enum_assignment
    name: (property_identifier) @definition.enum_member
  )
)

; Namespace definitions
(internal_module
  name: (identifier) @definition.namespace
) @definition.namespace

; Type parameter definitions
(type_parameter
  (type_identifier) @definition.type_parameter
) @definition.type_parameter

;; ==============================================================================
;; TYPE ANNOTATIONS AND GENERICS
;; ==============================================================================

; Note: Type parameters and return type annotations are extracted by builders
; from the complete node captures. We don't capture them separately to avoid fragments.

; Variable declarations - simple pattern that matches all variable names
; This ensures variables are captured even when they have type annotations
; The more specific patterns below (with value assignments) will also match
(variable_declarator
  name: (identifier) @definition.variable
)

;; ==============================================================================
;; ACCESS MODIFIERS AND DECORATORS
;; ==============================================================================

; Access modifiers on methods
(method_definition
  (accessibility_modifier) @modifier.access_modifier
  name: (property_identifier) @definition.method
) @scope.method

; Access modifiers on fields
(public_field_definition
  (accessibility_modifier) @modifier.access_modifier
  name: (property_identifier) @definition.field
) @definition.field

; Readonly modifier
(public_field_definition
  "readonly" @modifier.readonly_modifier
  name: (property_identifier) @definition.field
) @definition.field

; Static modifier
(method_definition
  "static" @modifier.visibility
  name: (property_identifier) @definition.method
) @scope.method

(public_field_definition
  "static" @modifier.visibility
  name: (property_identifier) @definition.field
) @definition.field

; Constructor parameter properties (with access modifiers)
; These create both a parameter AND an implicit class property
(required_parameter
  (accessibility_modifier)
  pattern: (identifier) @definition.parameter @definition.field
)

; Constructor parameter properties (readonly)
; These create both a parameter AND an implicit class property
(required_parameter
  "readonly"
  pattern: (identifier) @definition.parameter @definition.field
)

; Class decorators (decorator first, then target)
(class_declaration
  (decorator
    (identifier) @decorator.class
  )
  name: (type_identifier)
)

(class_declaration
  (decorator
    (call_expression
      function: (identifier) @decorator.class
    )
  )
  name: (type_identifier)
)

(abstract_class_declaration
  (decorator
    (identifier) @decorator.class
  )
  name: (type_identifier)
)

(abstract_class_declaration
  (decorator
    (call_expression
      function: (identifier) @decorator.class
    )
  )
  name: (type_identifier)
)

; Method decorators (decorator is sibling in class_body, not child of method)
(class_body
  (decorator
    (identifier) @decorator.method
  )
  .
  (method_definition)
)

(class_body
  (decorator
    (call_expression
      function: (identifier) @decorator.method
    )
  )
  .
  (method_definition)
)

; Property decorators
(public_field_definition
  (decorator
    (identifier) @decorator.property
  )
  name: (property_identifier)
)

(public_field_definition
  (decorator
    (call_expression
      function: (identifier) @decorator.property
    )
  )
  name: (property_identifier)
)

;; ==============================================================================
;; DEFINITIONS - Symbols that introduce new names (JavaScript base + TypeScript)
;; ==============================================================================

; Function definitions
(function_declaration
  name: (identifier) @definition.function
)

(function_expression
  name: (identifier) @definition.function
)

; Arrow functions assigned to variables
; Arrow functions assigned to variables (captures both assignment and function definition)
(variable_declarator
  name: (identifier) @definition.function @assignment.variable
  value: (arrow_function)
) @assignment.variable

; Variable declarations with assignments
(variable_declarator
  name: (identifier) @definition.variable @assignment.variable
  value: (_) @assignment.variable
) @assignment.variable

; Variable declarations with constructor calls
(variable_declarator
  name: (identifier) @definition.variable @assignment.variable
  value: (new_expression
    constructor: (identifier) @assignment.constructor
  )
) @assignment.constructor

; Destructuring
(variable_declarator
  name: (object_pattern) @definition.variable
)

(variable_declarator
  name: (array_pattern) @definition.variable
)

; Class definitions with inheritance and implements
(class_declaration
  name: (type_identifier) @definition.class
  (class_heritage
    (extends_clause
      (identifier) @reference.type_reference
    )?
    (implements_clause
      (type_identifier) @reference.type_reference
    )*
  )?
)

(abstract_class_declaration
  name: (type_identifier) @definition.class
  (class_heritage
    (extends_clause
      (identifier) @reference.type_reference
    )?
    (implements_clause
      (type_identifier) @reference.type_reference
    )*
  )?
)

; Method definitions (capture static and accessibility modifiers)
(method_definition
  (accessibility_modifier)? @modifier.access_modifier
  "static"? @modifier.visibility
  name: (property_identifier) @definition.method
  (#not-eq? @definition.method "constructor")
) @scope.method

(method_definition
  name: (private_property_identifier) @definition.method
)

; Abstract method signatures in classes (not interfaces)
; These are abstract methods declared in abstract classes
; Try both method_signature and abstract_method_signature
(abstract_class_declaration
  body: (class_body
    (abstract_method_signature
      name: (property_identifier) @definition.method
    )
  )
)

; Also handle regular class_declaration that might have abstract methods
(class_declaration
  body: (class_body
    (abstract_method_signature
      name: (property_identifier) @definition.method
    )
  )
)

; Constructor
(method_definition
  name: (property_identifier) @definition.constructor
  (#eq? @definition.constructor "constructor")
) @scope.constructor

; Field definitions
(public_field_definition
  (accessibility_modifier)? @modifier.access_modifier
  "static"? @modifier.visibility
  "readonly"? @modifier.readonly_modifier
  name: (property_identifier) @definition.field
) @definition.field

(public_field_definition
  name: (private_property_identifier) @definition.field
)

; Parameters - Apply to ALL callables (functions, methods, interface method signatures)
; These patterns are not scoped to specific parent nodes, so they match parameters
; in all callable contexts including interface method signatures.
;
; AST Structure (verified with tree-sitter):
;   required_parameter
;     ├── [pattern] identifier (captured here)
;     └── [type] type_annotation ": T"
;
;   optional_parameter
;     ├── [pattern] identifier (captured here)
;     ├── ? "?"
;     └── [type] type_annotation ": T"
;
;   required_parameter (rest parameter)
;     ├── [pattern] rest_pattern
;     │   ├── ... "..."
;     │   └── identifier (captured here - NO FIELD NAME!)
;     └── [type] type_annotation ": T[]"
;
; Required parameters
(required_parameter
  pattern: (identifier) @definition.parameter
)

; Optional parameters (contain ? token)
(optional_parameter
  pattern: (identifier) @definition.parameter.optional
)

; Rest parameters (...args)
; Note: rest_pattern does NOT have a field name for the identifier child
(rest_pattern
  (identifier) @definition.parameter
)

; Catch clause parameter
(catch_clause
  parameter: (identifier) @definition.parameter
)

; Loop variables
(for_in_statement
  left: (_
    (identifier) @definition.variable
  )
)

;; ==============================================================================
;; TYPESCRIPT IMPORTS/EXPORTS
;; ==============================================================================

; Interface exports
(export_statement
  declaration: (interface_declaration
    name: (type_identifier) @export.interface
  )
)

; Type alias exports
(export_statement
  (type_alias_declaration
    name: (type_identifier) @export.type_alias
  )
)

; Enum exports
(export_statement
  (enum_declaration
    name: (identifier) @export.enum
  )
)

;; ==============================================================================
;; IMPORTS - Standard JavaScript imports
;; ==============================================================================

; Named imports - captures both simple and aliased imports
; For simple imports (no alias): captures the name
; For aliased imports: captures the alias, handler extracts original name
(import_specifier
  alias: (identifier) @definition.import
)

(import_specifier
  name: (identifier) @definition.import
  !alias
)

; Default imports
(import_clause
  (identifier) @definition.import
)

; Namespace imports
(namespace_import
  (identifier) @definition.import
)

;; ==============================================================================
;; RE-EXPORTS - Import definitions that forward exports
;; ==============================================================================
;; Re-exports create ImportDefinitions (for chain resolution) but do NOT create
;; local bindings in scope_to_definitions.

; Re-export patterns: export { foo } from 'module'
; Capture complete export_statement, handler extracts details
(export_statement
  (export_clause
    (export_specifier)
  )
  source: (string)
) @import.reexport

;; ==============================================================================
;; EXPORTS - Standard JavaScript exports
;; ==============================================================================

; Named exports
(export_specifier
  name: (identifier) @export.variable
)

; Default exports
(export_statement
  (identifier) @export.variable
)

; Export declarations
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @export.variable
    )
  )
)

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @export.variable
    )
  )
)

; Export function declarations
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function
  )
)

; Export class declarations
(export_statement
  declaration: (class_declaration
    name: (type_identifier) @export.class
  )
)

(export_statement
  declaration: (abstract_class_declaration
    name: (type_identifier) @export.class
  )
)

; NOTE: Re-exports (export { foo } from 'module') are now handled by the
; RE-EXPORTS section above as import definitions with export metadata.
; They are NOT handled here to avoid duplicates.

;; ==============================================================================
;; REFERENCES with Enhanced Context (JavaScript + TypeScript)
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @reference.call
)

; Generic function calls (TypeScript)
(call_expression
  function: (identifier) @reference.call.generic
  type_arguments: (type_arguments)
) @reference.call.generic

; Method calls with receiver tracking
; Complete capture - extractor derives method name, receiver, property chain
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call

; Constructor calls
(new_expression
  constructor: (identifier) @reference.constructor
) @reference.call

; Constructor calls with type arguments (TypeScript)
(new_expression
  constructor: (identifier) @reference.constructor.generic
  type_arguments: (type_arguments)
) @reference.call.generic

; Property access
(member_expression
  object: (identifier) @reference.variable.base
  property: (property_identifier) @reference.property
) @reference.member_access

; Computed member access (bracket notation)
(subscript_expression
  object: (identifier) @reference.variable
  index: (_) @reference.property.computed
) @reference.member_access.computed

; Optional chaining member access
(member_expression
  object: (identifier) @reference.variable
  property: (property_identifier) @reference.property.optional
) @reference.member_access.optional

; Static method call - object is a class identifier (capitalized)
(call_expression
  function: (member_expression
    object: (identifier) @reference.type_reference
    property: (property_identifier))
  (#match? @reference.type_reference "^[A-Z]")) @reference.call

; Instance method call - object is lowercase/instance
(call_expression
  function: (member_expression
    object: (identifier) @reference.variable
    property: (property_identifier))
  (#not-match? @reference.variable "^[A-Z]")) @reference.call

; Type references (TypeScript)
(type_identifier) @reference.type

(generic_type
  name: (type_identifier) @reference.type.generic
  type_arguments: (type_arguments)
)

; Assignments (capture both sides)
(assignment_expression
  left: (identifier) @reference.variable.target
  right: (_) @reference.variable.source
) @assignment.variable

(assignment_expression
  left: (member_expression
    object: (identifier) @reference.variable.object
    property: (property_identifier) @reference.property.assign
  ) @reference.member_access.assign
  right: (_) @reference.variable.source
) @assignment.property

; Return statements
(return_statement
  (_) @return.variable
) @return.function

; Update expressions
(update_expression
  argument: (identifier) @reference.variable.update
)

; JSX components (only valid in TSX, commented out for plain TypeScript)
; (jsx_opening_element
;   (identifier) @reference.call.jsx
; )
;
; (jsx_self_closing_element
;   (identifier) @reference.call.jsx
; )

; this references (important for method context)
(this) @reference.this

; super references (for inheritance)
(super) @reference.super

; Type assertions (TypeScript - only 'as' expressions, angle brackets parse as JSX)
(as_expression) @type.type_assertion

; Typeof queries (TypeScript)
(type_query
  (identifier) @reference.typeof
) @reference.typeof

; General identifier references (catch-all)
(identifier) @reference.variable