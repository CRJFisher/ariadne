;; ==============================================================================
;; SEMANTIC INDEX - Python with Enhanced Type Tracking
;; ==============================================================================
;; Captures all semantic information needed for type resolution and method calls
;; ==============================================================================

;; ==============================================================================
;; SCOPES - Define lexical boundaries
;; ==============================================================================

; Root scope
(module) @scope.module

; Function scopes
(function_definition) @scope.function
(lambda) @scope.lambda

; Class scopes
(class_definition) @scope.class

; Method scopes (functions within classes)
(class_definition
  body: (block
    (function_definition) @scope.method
  )
)

; Block scopes
(block) @scope.block
(for_statement) @scope.for
(while_statement) @scope.while
(with_statement) @scope.with
(if_statement) @scope.if
(elif_clause) @scope.elif
(else_clause) @scope.else
(try_statement) @scope.try
(except_clause) @scope.except
(finally_clause) @scope.finally
(match_statement) @scope.match
(case_clause) @scope.case

; Comprehension scopes
(list_comprehension) @scope.comprehension
(dictionary_comprehension) @scope.comprehension
(set_comprehension) @scope.comprehension
(generator_expression) @scope.comprehension

;; ==============================================================================
;; DEFINITIONS - Symbols that introduce new names
;; ==============================================================================

; Function definitions
(function_definition
  name: (identifier) @def.function
)

; Async function definitions
(function_definition
  "async" @function.async
  name: (identifier) @def.function.async
)

; Lambda functions assigned to variables
(assignment
  left: (identifier) @def.lambda @assign.target
  right: (lambda) @assign.source.lambda
) @assignment.lambda

; Class definitions with inheritance
(class_definition
  name: (identifier) @def.class
  superclasses: (argument_list
    (identifier) @class.extends
  )?
)

; Method definitions (including special methods)
(class_definition
  body: (block
    (function_definition
      name: (identifier) @def.method
    )
  )
)

; Constructor
(class_definition
  body: (block
    (function_definition
      name: (identifier) @def.constructor
      (#eq? @def.constructor "__init__")
    ) @constructor.definition
  )
)

; Static methods
(class_definition
  body: (block
    (decorated_definition
      (decorator
        (identifier) @decorator.static
        (#eq? @decorator.static "staticmethod")
      )
      definition: (function_definition
        name: (identifier) @def.method.static
      )
    ) @method.static
  )
)

; Class methods
(class_definition
  body: (block
    (decorated_definition
      (decorator
        (identifier) @decorator.classmethod
        (#eq? @decorator.classmethod "classmethod")
      )
      definition: (function_definition
        name: (identifier) @def.method.class
      )
    ) @method.classmethod
  )
)

; Property decorators
(class_definition
  body: (block
    (decorated_definition
      (decorator
        (identifier) @decorator.property
        (#eq? @decorator.property "property")
      )
      definition: (function_definition
        name: (identifier) @def.property
      )
    ) @property.definition
  )
)

; Class attributes
(class_definition
  body: (block
    (expression_statement
      (assignment
        left: (identifier) @def.field
        right: (_) @field.value
      )
    )
  )
)

; Variable assignments
(assignment
  left: (identifier) @def.variable @assign.target
  right: (_) @assign.source
) @assignment.var

; Annotated assignments (with type hints)
(assignment
  left: (identifier) @def.variable.typed @assign.target
  type: (_) @type.annotation
  right: (_)? @assign.source.typed
) @assignment.typed

; Multiple assignments
(assignment
  left: (pattern_list
    (identifier) @def.variable.multiple
  )
  right: (_) @assign.source.multiple
) @assignment.multiple

; Tuple unpacking
(assignment
  left: (tuple_pattern
    (identifier) @def.variable.tuple
  )
  right: (_) @assign.source.tuple
) @assignment.tuple

; Parameters
(parameters
  (identifier) @def.param
)

(parameters
  (default_parameter
    name: (identifier) @def.param.default
  )
)

(parameters
  (typed_parameter
    (identifier) @def.param.typed
    type: (_) @param.type
  )
)

(parameters
  (typed_default_parameter
    name: (identifier) @def.param.typed.default
    type: (_) @param.type.default
  )
)

; *args and **kwargs
(parameters
  (list_splat_pattern
    (identifier) @def.param.args
  )
)

(parameters
  (dictionary_splat_pattern
    (identifier) @def.param.kwargs
  )
)

; Loop variables
(for_statement
  left: (identifier) @def.loop_var
)

(for_statement
  left: (pattern_list
    (identifier) @def.loop_var.multiple
  )
)

; Comprehension variables
(for_in_clause
  left: (identifier) @def.comprehension_var
)

; Exception variables
(except_clause
  (as_pattern
    alias: (as_pattern_target
      (identifier) @def.except_var
    )
  )
)

; With statement variables
(with_statement
  (with_clause
    (with_item
      (as_pattern
        alias: (as_pattern_target
          (identifier) @def.with_var
        )
      )
    )
  )
)

;; ==============================================================================
;; IMPORTS
;; ==============================================================================

; Import statements
(import_statement
  name: (dotted_name) @import.module
)

(import_statement
  name: (aliased_import
    name: (dotted_name) @import.module.source
    alias: (identifier) @import.module.alias
  )
)

; From imports
(import_from_statement
  module_name: (dotted_name) @import.source
  name: (dotted_name) @import.named
)

(import_from_statement
  module_name: (dotted_name) @import.source
  name: (aliased_import
    name: (dotted_name) @import.named.source
    alias: (identifier) @import.named.alias
  )
)

; Import all (from module import *)
(import_from_statement
  module_name: (dotted_name) @import.source.star
  (wildcard_import) @import.star
)

; Relative imports
(import_from_statement
  module_name: (relative_import) @import.source.relative
  name: (dotted_name) @import.named.relative
)

;; ==============================================================================
;; EXPORTS (Python's implicit export model)
;; ==============================================================================

; __all__ definition (explicit exports)
(module
  (expression_statement
    (assignment
      left: (identifier) @export.all
      (#eq? @export.all "__all__")
      right: (list) @export.all.list
    )
  )
)

; Individual items in __all__ list
(module
  (expression_statement
    (assignment
      left: (identifier) @_all_var
      (#eq? @_all_var "__all__")
      right: (list
        (string) @export.explicit
      )
    )
  )
)

; Top-level function definitions (implicit exports)
(module
  (function_definition
    name: (identifier) @export.function
  )
)

; Top-level class definitions (implicit exports)
(module
  (class_definition
    name: (identifier) @export.class
  )
)

; Top-level variable assignments (implicit exports)
(module
  (expression_statement
    (assignment
      left: (identifier) @export.variable
    )
  )
)

;; ==============================================================================
;; REFERENCES with Enhanced Context
;; ==============================================================================

; Function calls
(call
  function: (identifier) @ref.call
)

; Method calls with receiver tracking
(call
  function: (attribute
    object: (_) @ref.receiver
    attribute: (identifier) @ref.method_call
  )
) @method_call.full

; Chained method calls (2 levels)
(call
  function: (attribute
    object: (attribute
      object: (_) @ref.receiver.base
      attribute: (identifier) @ref.chain.prop1
    ) @ref.receiver.chain
    attribute: (identifier) @ref.method_call.chained
  )
) @method_call.chained

; Deep property chains (3+ levels)
(call
  function: (attribute
    object: (attribute
      object: (attribute) @ref.receiver.deep
      attribute: (identifier) @ref.chain.prop2
    ) @ref.receiver.chain2
    attribute: (identifier) @ref.method_call.deep
  )
) @method_call.deep

; Constructor calls (class instantiation)
(call
  function: (identifier) @ref.constructor
  arguments: (argument_list)
) @constructor_call

; Attribute access
(attribute
  object: (identifier) @ref.object
  attribute: (identifier) @ref.property
) @member_access

; Subscript access
(subscript
  value: (identifier) @ref.subscript.object
  subscript: (_) @ref.subscript.index
) @subscript_access

; Assignments (capture both sides)
(assignment
  left: (identifier) @ref.assign.target
  right: (_) @ref.assign.source
) @assignment.expr

(assignment
  left: (attribute
    object: (identifier) @ref.assign.object
    attribute: (identifier) @ref.assign.property
  ) @ref.assign.member
  right: (_) @ref.assign.source.member
) @assignment.member

; Augmented assignments (+=, -=, etc.)
(augmented_assignment
  left: (identifier) @ref.augment.target
  right: (_) @ref.augment.source
) @assignment.augmented

; Return statements
(return_statement
  (_) @ref.return
) @return.statement

; Yield expressions
(yield
  (_) @ref.yield
) @yield.expression

; Delete statements
(delete_statement
  (identifier) @ref.delete
)

; Assert statements
(assert_statement
  (identifier) @ref.assert
)

; Decorators
(decorator
  (identifier) @ref.decorator
)

(decorator
  (call
    function: (identifier) @ref.decorator.call
  )
)

; self references (important for method context)
(identifier) @ref.self
(#eq? @ref.self "self")

; cls references (for classmethods)
(identifier) @ref.cls
(#eq? @ref.cls "cls")

; super() calls
(call
  function: (identifier) @ref.super
  (#eq? @ref.super "super")
) @super_call

; Type annotations in various contexts
(type
  (identifier) @ref.type
)

(type
  (generic_type
    (identifier) @ref.type.generic
  )
)

; General identifier references (catch-all)
(identifier) @ref.identifier