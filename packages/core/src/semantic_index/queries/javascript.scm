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
(class_declaration) @scope.class
(class) @scope.class

; Block scopes
(statement_block) @scope.block
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

; Function definitions
(function_declaration
  name: (identifier) @def.function
)

(function_expression
  name: (identifier) @def.function
)

; Arrow functions assigned to variables (captures assignment)
(variable_declarator
  name: (identifier) @def.arrow @assign.target
  value: (arrow_function) @assign.source.arrow
) @assignment.arrow

; Variable declarations with assignments
(variable_declarator
  name: (identifier) @def.variable @assign.target
  value: (_) @assign.source
) @assignment.var

; Variable declarations with constructor calls
(variable_declarator
  name: (identifier) @def.variable @assign.target
  value: (new_expression
    constructor: (identifier) @assign.constructor
  ) @assign.source.constructor
) @assignment.constructor

; Destructuring
(variable_declarator
  name: (object_pattern) @def.variable.destructured
)

(variable_declarator
  name: (array_pattern) @def.variable.destructured
)

; Class definitions with inheritance
(class_declaration
  name: (identifier) @def.class
  (class_heritage
    (identifier) @class.extends
  )?
)

; Method definitions (capture static modifier)
(method_definition
  "static"? @method.static
  name: (property_identifier) @def.method
) @method.definition

(method_definition
  name: (private_property_identifier) @def.method.private
)

; Constructor
(method_definition
  name: (property_identifier) @def.constructor
  (#eq? @def.constructor "constructor")
) @constructor.definition

; Field definitions
(field_definition
  "static"? @field.static
  property: (property_identifier) @def.field
)

(field_definition
  property: (private_property_identifier) @def.field.private
)

; Parameters
(formal_parameters
  (identifier) @def.param
)

(formal_parameters
  (rest_pattern (identifier) @def.param.rest)
)

(formal_parameters
  (assignment_pattern
    left: (identifier) @def.param.default
  )
)

; Catch clause parameter
(catch_clause
  parameter: (identifier) @def.catch_param
)

; Loop variables
(for_in_statement
  left: (_
    (identifier) @def.loop_var
  )
)

;; ==============================================================================
;; IMPORTS
;; ==============================================================================

; Import source (captured for all imports)
(import_statement
  source: (string) @import.source
)

; Named imports
(import_specifier
  name: (identifier) @import.named
)

(import_specifier
  name: (identifier) @import.named.source
  alias: (identifier) @import.named.alias
)

; Default imports
(import_clause
  (identifier) @import.default
)

; Namespace imports
(namespace_import
  (identifier) @import.namespace
)

;; ==============================================================================
;; EXPORTS
;; ==============================================================================

; Named exports
(export_specifier
  name: (identifier) @export.named
)

(export_specifier
  name: (identifier) @export.named.source
  alias: (identifier) @export.named.alias
)

; Default exports
(export_statement
  (identifier) @export.default
)

(export_statement
  declaration: (function_declaration
    name: (identifier) @export.default.function
  )
)

(export_statement
  declaration: (class_declaration
    name: (identifier) @export.default.class
  )
)

; Export declarations
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @export.declaration
    )
  )
)

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @export.declaration
    )
  )
)

; Export function declarations
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.declaration
  )
)

; Export class declarations
(export_statement
  declaration: (class_declaration
    name: (identifier) @export.declaration
  )
)

; Namespace exports (export * from 'module')
(export_statement
  source: (string) @export.namespace.source
)

; Namespace exports with alias (export * as ns from 'module')
(export_statement
  (namespace_export (identifier) @export.namespace.alias)
  source: (string) @export.namespace.source.aliased
)

; Re-exports (export { foo } from 'module')
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @export.reexport
    )
  )
  source: (string) @export.reexport.source
)

; Re-exports with alias (export { foo as bar } from 'module')
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @export.reexport.original
      alias: (identifier) @export.reexport.alias
    )
  )
  source: (string) @export.reexport.source.aliased
)

;; ==============================================================================
;; REFERENCES with Enhanced Context
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @ref.call
)

; Method calls with receiver tracking
(call_expression
  function: (member_expression
    object: (_) @ref.receiver
    property: (property_identifier) @ref.method_call
  )
) @method_call.full

; Chained method calls (2 levels)
(call_expression
  function: (member_expression
    object: (member_expression
      object: (_) @ref.receiver.base
      property: (property_identifier) @ref.chain.prop1
    ) @ref.receiver.chain
    property: (property_identifier) @ref.method_call.chained
  )
) @method_call.chained

; Deep property chains (3+ levels)
(call_expression
  function: (member_expression
    object: (member_expression
      object: (member_expression) @ref.receiver.deep
      property: (property_identifier) @ref.chain.prop2
    ) @ref.receiver.chain2
    property: (property_identifier) @ref.method_call.deep
  )
) @method_call.deep

; Constructor calls
(new_expression
  constructor: (identifier) @ref.constructor
) @constructor_call

; Constructor calls with assignment (already captured in definitions)
(variable_declarator
  value: (new_expression
    constructor: (identifier) @ref.constructor.assigned
  )
)

; Property access
(member_expression
  object: (identifier) @ref.object
  property: (property_identifier) @ref.property
) @member_access

; Computed member access (bracket notation)
(subscript_expression
  object: (identifier) @ref.object
  index: (_) @ref.property.computed
) @member_access.computed

; Optional chaining member access
(member_expression
  object: (identifier) @ref.object
  property: (property_identifier) @ref.property.optional
  "?." @optional_chaining_operator
) @member_access.optional

; Assignments (capture both sides)
(assignment_expression
  left: (identifier) @ref.assign.target
  right: (_) @ref.assign.source
) @assignment.expr

(assignment_expression
  left: (member_expression
    object: (identifier) @ref.assign.object
    property: (property_identifier) @ref.assign.property
  ) @ref.assign.member
  right: (_) @ref.assign.source.member
) @assignment.member

; Return statements
(return_statement
  (_) @ref.return
) @return.statement

; Update expressions
(update_expression
  argument: (identifier) @ref.update
)

; JSX components
(jsx_opening_element
  (identifier) @ref.jsx
)

(jsx_self_closing_element
  (identifier) @ref.jsx
)

; this references (important for method context)
(this) @ref.this

; super references (for inheritance)
(super) @ref.super

; General identifier references (catch-all)
(identifier) @ref.identifier