;; ==============================================================================
;; SEMANTIC INDEX - JavaScript/TypeScript with Enhanced Type Tracking
;; ==============================================================================
;; Captures all semantic information needed for type resolution and method calls
;; ==============================================================================

;; ==============================================================================
;; SCOPES - Define lexical boundaries
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
(class
  body: (class_body) @scope.class
)

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
;; DEFINITIONS - Symbols that introduce new names
;; ==============================================================================

;; ==============================================================================
;; DOCUMENTATION - JSDoc comments before definitions
;; ==============================================================================

; JSDoc comment before function declaration
(program
  (comment) @definition.function.documentation
  (function_declaration) @scope.function.documented
)

; JSDoc comment before class declaration
(program
  (comment) @definition.class.documentation
  (class_declaration) @scope.class.documented
)

; JSDoc comment before variable/constant declaration
(program
  (comment) @definition.variable.documentation
  (lexical_declaration) @scope.variable.documented
)

; JSDoc comment before method definition
(class_body
  (comment) @definition.method.documentation
  (method_definition) @scope.method.documented
)

; Function definitions
(function_declaration
  name: (identifier) @definition.function
)

(function_expression
  name: (identifier) @definition.function
)

; Arrow functions assigned to variables (captures both assignment and function definition)
(variable_declarator
  name: (identifier) @definition.function @assignment.variable
  value: (arrow_function) @reference.variable
) @assignment.variable

; Variable declarations with assignments
(variable_declarator
  name: (identifier) @definition.variable @assignment.variable
  value: (_) @reference.variable
) @assignment.variable

; Variable declarations with constructor calls
(variable_declarator
  name: (identifier) @definition.variable @assignment.variable
  value: (new_expression
    constructor: (identifier) @reference.call
  ) @reference.variable
) @assignment.variable

; Destructuring
(variable_declarator
  name: (object_pattern) @definition.variable
)

(variable_declarator
  name: (array_pattern) @definition.variable
)

; Variable declarations without initialization (e.g., let x; var y;)
; This pattern captures uninitialized variables for completeness and consistency
; with TypeScript, Python, and Rust query patterns
; The !value syntax ensures this only matches variables WITHOUT an initializer
(variable_declarator
  name: (identifier) @definition.variable
  !value
)

; Class definitions with inheritance
(class_declaration
  name: (identifier) @definition.class
  (class_heritage
    (identifier) @reference.type_reference
  )?
)

; Method definitions (capture static modifier)
(method_definition
  "static"? @modifier.visibility
  name: (property_identifier) @definition.method
  (#not-eq? @definition.method "constructor")
) @scope.method

(method_definition
  name: (private_property_identifier) @definition.method
)

; Constructor
(method_definition
  name: (property_identifier) @definition.constructor
  (#eq? @definition.constructor "constructor")
) @scope.constructor

; Field definitions
(field_definition
  "static"? @modifier.visibility
  property: (property_identifier) @definition.field
)

(field_definition
  property: (private_property_identifier) @definition.field
)

; Parameters
(formal_parameters
  (identifier) @definition.parameter
)

(formal_parameters
  (rest_pattern (identifier) @definition.parameter)
)

(formal_parameters
  (assignment_pattern
    left: (identifier) @definition.parameter
  )
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
;; IMPORTS
;; ==============================================================================

; Named imports
(import_specifier
  name: (identifier) @definition.import.named
)

(import_specifier
  name: (identifier)
  alias: (identifier) @definition.import.named
)

; Default imports
(import_clause
  (identifier) @definition.import.default
)

; Namespace imports
(namespace_import
  (identifier) @definition.import.namespace
)

;; ==============================================================================
;; COMMONJS IMPORTS
;; ==============================================================================

; Destructured require: const { foo, bar } = require('./module')
(variable_declarator
  name: (object_pattern
    (shorthand_property_identifier_pattern) @definition.import.require
  )
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)

; Simple require: const utils = require('./module')
(variable_declarator
  name: (identifier) @definition.import.require.simple
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)

;; ==============================================================================
;; RE-EXPORTS - Import definitions that forward exports
;; ==============================================================================
;; Re-exports create ImportDefinitions (for chain resolution) but do NOT create
;; local bindings in scope_to_definitions.

; Re-export with alias: export { foo as bar } from 'module'
; Note: This must come BEFORE the non-aliased pattern to match correctly
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @import.reexport.named.original
      alias: (identifier) @import.reexport.named.alias
    )
  )
  source: (string) @import.reexport.source.aliased
)

; Re-export named as default: export { foo as default } from 'module'
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @import.reexport.as_default.original
      alias: (identifier) @import.reexport.as_default.alias
      (#eq? @import.reexport.as_default.alias "default")
    )
  )
  source: (string) @import.reexport.as_default.source
)

; Re-export default as named: export { default as foo } from 'module'
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @import.reexport.default.original
      (#eq? @import.reexport.default.original "default")
      alias: (identifier) @import.reexport.default.alias
    )
  )
  source: (string) @import.reexport.default.source
)

; Re-export named (no alias): export { foo } from 'module'
; Must check in handler that export_specifier does NOT have an alias field
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @import.reexport.named.simple
    )
  )
  source: (string) @import.reexport.named.simple.source
)

; Namespace re-export with alias: export * as utils from 'module'
(export_statement
  (namespace_export (identifier) @import.reexport.namespace.alias)
  source: (string) @import.reexport.namespace.aliased.source
)

;; ==============================================================================
;; EXPORTS
;; ==============================================================================

; Named exports
(export_specifier
  name: (identifier) @export.variable
)

(export_specifier
  name: (identifier) @export.variable
  alias: (identifier) @export.variable
)

; Default exports
(export_statement
  (identifier) @export.variable
)

(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function
  )
)

(export_statement
  declaration: (class_declaration
    name: (identifier) @export.class
  )
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
    name: (identifier) @export.class
  )
)

; Namespace exports (export * from 'module')
(export_statement
  source: (string) @export.namespace
)

; Namespace exports with alias (export * as ns from 'module')
(export_statement
  (namespace_export (identifier) @export.namespace)
  source: (string) @export.namespace
)

; NOTE: Re-exports (export { foo } from 'module') are now handled by the
; RE-EXPORTS section above as import definitions with export metadata.
; They are NOT handled here to avoid duplicates.

;; ==============================================================================
;; REFERENCES with Enhanced Context
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @reference.call
)

; Method calls with receiver tracking
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier) @reference.call
  )
) @reference.call.full

; Chained method calls (2 levels)
(call_expression
  function: (member_expression
    object: (member_expression
      object: (_) @reference.variable.base
      property: (property_identifier) @reference.property.prop1
    ) @reference.variable.chain
    property: (property_identifier) @reference.call.chained
  )
) @reference.call.chained

; Deep property chains (3+ levels)
(call_expression
  function: (member_expression
    object: (member_expression
      object: (member_expression) @reference.variable.deep
      property: (property_identifier) @reference.property.prop2
    ) @reference.variable.chain2
    property: (property_identifier) @reference.call.deep
  )
) @reference.call.deep

; Constructor calls
(new_expression
  constructor: (identifier) @reference.constructor
) @reference.call

; Constructor calls with assignment (already captured in definitions)
(variable_declarator
  value: (new_expression
    constructor: (identifier) @reference.constructor.assigned
  )
)

; Property access
(member_expression
  object: (identifier) @reference.variable
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
  right: (_) @reference.variable.source.member
) @assignment.property

; Return statements
(return_statement
  (_) @return.variable
) @return.function

; Update expressions
(update_expression
  argument: (identifier) @reference.variable.update
)

; JSX components
(jsx_opening_element
  (identifier) @reference.call.jsx
)

(jsx_self_closing_element
  (identifier) @reference.call.jsx
)

; this references (important for method context)
(this) @reference.this

; super references (for inheritance)
(super) @reference.super

; Static method call - object is a class identifier (capitalized)
(call_expression
  function: (member_expression
    object: (identifier) @reference.type_reference
    property: (property_identifier) @modifier.visibility)
  (#match? @reference.type_reference "^[A-Z]")) @reference.call

; Instance method call - object is lowercase/instance
(call_expression
  function: (member_expression
    object: (identifier) @reference.variable
    property: (property_identifier) @reference.call)
  (#not-match? @reference.variable "^[A-Z]")) @reference.call

; General identifier references (catch-all)
(identifier) @reference.variable