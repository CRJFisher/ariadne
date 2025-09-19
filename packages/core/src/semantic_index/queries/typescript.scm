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
(class_declaration) @scope.class
(abstract_class_declaration) @scope.class
(class) @scope.class

; TypeScript-specific scopes
(interface_declaration) @scope.interface
(enum_declaration) @scope.enum
(internal_module) @scope.namespace

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
;; TYPESCRIPT TYPE DEFINITIONS
;; ==============================================================================

; Interface definitions
(interface_declaration
  name: (type_identifier) @def.interface
) @interface.definition

; Type alias definitions
(type_alias_declaration
  name: (type_identifier) @def.type_alias
  value: (_) @type.alias.value
) @type_alias.definition

; Enum definitions
(enum_declaration
  name: (identifier) @def.enum
) @enum.definition

; Enum members
(enum_body
  (property_identifier) @def.enum.member
)

(enum_body
  (enum_assignment
    name: (property_identifier) @def.enum.member
    value: (_) @enum.member.value
  )
)

; Namespace definitions
(internal_module
  name: (identifier) @def.namespace
) @namespace.definition

; Type parameter definitions
(type_parameter
  (type_identifier) @def.type_param
  constraint: (constraint
    (_) @type_param.constraint
  )?
) @type_param.definition

;; ==============================================================================
;; TYPE ANNOTATIONS AND GENERICS
;; ==============================================================================

; Generic type parameters on functions
(function_declaration
  name: (identifier) @function.name
  type_parameters: (type_parameters) @function.type_params
) @function.generic

; Generic type parameters on classes
(class_declaration
  name: (type_identifier) @class.name
  type_parameters: (type_parameters) @class.type_params
) @class.generic

(abstract_class_declaration
  name: (type_identifier) @class.name
  type_parameters: (type_parameters) @class.type_params
) @class.generic

; Generic type parameters on interfaces
(interface_declaration
  name: (type_identifier) @interface.name
  type_parameters: (type_parameters) @interface.type_params
) @interface.generic

; Generic type parameters on methods
(method_definition
  name: (property_identifier) @method.name
  type_parameters: (type_parameters) @method.type_params
) @method.generic

; Parameter type annotations
(required_parameter
  pattern: (identifier) @param.name
  type: (type_annotation
    (_) @param.type
  )
) @param.typed

(optional_parameter
  pattern: (identifier) @param.name
  type: (type_annotation
    (_) @param.type
  )
) @param.typed.optional

; Return type annotations
(function_declaration
  name: (identifier) @function.name
  return_type: (type_annotation
    (_) @function.return_type
  )
) @function.with_return_type

(method_definition
  name: (property_identifier) @method.name
  return_type: (type_annotation
    (_) @method.return_type
  )
) @method.with_return_type

(arrow_function
  return_type: (type_annotation
    (_) @arrow.return_type
  )
) @arrow.with_return_type

; Property type annotations (interface)
(property_signature
  name: (property_identifier) @property.name
  type: (type_annotation
    (_) @property.type
  )
) @property.typed

; Field type annotations (class)
(public_field_definition
  name: (property_identifier) @field.name
  type: (type_annotation
    (_) @field.type
  )
) @field.typed

; Variable type annotations
(variable_declarator
  name: (identifier) @var.name
  type: (type_annotation
    (_) @var.type
  )
) @var.typed

;; ==============================================================================
;; ACCESS MODIFIERS AND DECORATORS
;; ==============================================================================

; Access modifiers on methods
(method_definition
  (accessibility_modifier) @method.access
  name: (property_identifier) @method.name
) @method.with_access

; Access modifiers on fields
(public_field_definition
  (accessibility_modifier) @field.access
  name: (property_identifier) @field.name
) @field.with_access

; Readonly modifier
(public_field_definition
  "readonly" @field.readonly
  name: (property_identifier) @field.name
) @field.with_readonly

; Static modifier
(method_definition
  "static" @method.static
  name: (property_identifier) @method.name
) @method.with_static

(public_field_definition
  "static" @field.static
  name: (property_identifier) @field.name
) @field.with_static

; Constructor parameter properties (with access modifiers)
(required_parameter
  (accessibility_modifier) @param.access
  pattern: (identifier) @param.property
) @constructor.param_property

; Constructor parameter properties as field definitions (with access modifiers)
(required_parameter
  (accessibility_modifier)
  pattern: (identifier) @def.field.param_property
) @field.param_property

; Constructor parameter properties (readonly)
(required_parameter
  "readonly" @param.readonly
  pattern: (identifier) @param.property
) @constructor.param_property.readonly

; Constructor parameter properties as field definitions (readonly)
(required_parameter
  "readonly"
  pattern: (identifier) @def.field.param_property
) @field.param_property.readonly

; Class decorators
(class_declaration
  (decorator
    (identifier) @decorator.class
  )
  name: (type_identifier) @decorated.class
) @class.decorated

(abstract_class_declaration
  (decorator
    (identifier) @decorator.class
  )
  name: (type_identifier) @decorated.class
) @class.decorated

; Method decorators (decorator and method are siblings in class_body)
(class_body
  (decorator
    (identifier) @decorator.method
  )
  (method_definition
    name: (property_identifier) @decorated.method
  ) @method.decorated
)

; Property decorators (decorator is child of field definition)
(public_field_definition
  (decorator
    (identifier) @decorator.property
  )
  name: (property_identifier) @decorated.property
) @property.decorated

;; ==============================================================================
;; DEFINITIONS - Symbols that introduce new names (JavaScript base + TypeScript)
;; ==============================================================================

; Function definitions
(function_declaration
  name: (identifier) @def.function
)

(function_expression
  name: (identifier) @def.function
)

; Arrow functions assigned to variables
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

; Class definitions with inheritance and implements
(class_declaration
  name: (type_identifier) @def.class
  (class_heritage
    (extends_clause
      (identifier) @class.extends
    )?
    (implements_clause
      (type_identifier) @class.implements
    )*
  )?
)

(abstract_class_declaration
  name: (type_identifier) @def.class
  (class_heritage
    (extends_clause
      (identifier) @class.extends
    )?
    (implements_clause
      (type_identifier) @class.implements
    )*
  )?
)

; Method definitions (capture static and accessibility modifiers)
(method_definition
  (accessibility_modifier)? @method.accessibility
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
(public_field_definition
  (accessibility_modifier)? @field.accessibility
  "static"? @field.static
  "readonly"? @field.readonly
  name: (property_identifier) @def.field
) @field.definition

(public_field_definition
  name: (private_property_identifier) @def.field.private
)

; Parameters
(required_parameter
  pattern: (identifier) @def.param
)

(optional_parameter
  pattern: (identifier) @def.param.optional
)

(rest_pattern
  (identifier) @def.param.rest
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
  declaration: (type_alias_declaration
    name: (type_identifier) @export.type_alias
  )
)

; Enum exports
(export_statement
  declaration: (enum_declaration
    name: (identifier) @export.enum
  )
)

;; ==============================================================================
;; IMPORTS - Standard JavaScript imports
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
;; EXPORTS - Standard JavaScript exports
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
    name: (type_identifier) @export.default.class
  )
)

(export_statement
  declaration: (abstract_class_declaration
    name: (type_identifier) @export.default.class
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
    name: (type_identifier) @export.declaration
  )
)

(export_statement
  declaration: (abstract_class_declaration
    name: (type_identifier) @export.declaration
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
;; REFERENCES with Enhanced Context (JavaScript + TypeScript)
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @ref.call
)

; Generic function calls (TypeScript)
(call_expression
  function: (identifier) @ref.call.generic
  type_arguments: (type_arguments) @ref.call.type_args
) @call.generic

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

; Constructor calls with type arguments (TypeScript)
(new_expression
  constructor: (identifier) @ref.constructor.generic
  type_arguments: (type_arguments) @ref.constructor.type_args
) @constructor_call.generic

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

; Type references (TypeScript)
(type_identifier) @ref.type

(generic_type
  name: (type_identifier) @ref.type.generic
  type_arguments: (type_arguments) @ref.type.args
) @type_reference.generic

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

; Type assertions (TypeScript - only 'as' expressions, angle brackets parse as JSX)
(as_expression
  (_) @ref.cast.value
  (_) @ref.cast.type
) @type.cast

; Typeof queries (TypeScript)
(type_query
  (identifier) @ref.typeof
) @typeof.expr

; General identifier references (catch-all)
(identifier) @ref.identifier