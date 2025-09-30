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

; Function scopes (only top-level or nested, not in classes)
(module
  (function_definition) @scope.function
)
(function_definition
  body: (block
    (function_definition) @scope.function
  )
)
(lambda) @scope.lambda

; Class scopes
(class_definition) @scope.class

; Method scopes (functions within classes)
(class_definition
  body: (block
    (function_definition) @scope.method
  )
)

; Decorated method scopes (property getters, setters, staticmethod, classmethod)
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition) @scope.method
    )
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
  name: (identifier) @definition.function
)

; Async function definitions
(function_definition
  "async" @modifier.visibility
  name: (identifier) @definition.function.async
)

; Lambda functions assigned to variables
(assignment
  left: (identifier) @definition.lambda @assignment.target
  right: (lambda) @assignment.source.lambda
) @assignment.lambda

; Class definitions with inheritance
(class_definition
  name: (identifier) @definition.class
  superclasses: (argument_list
    (identifier) @reference.type_reference
  )?
)

; Method definitions (including special methods)
(class_definition
  body: (block
    (function_definition
      name: (identifier) @definition.method
    )
  )
)

; Constructor
(class_definition
  body: (block
    (function_definition
      name: (identifier) @definition.constructor
      (#eq? @definition.constructor "__init__")
    ) @scope.constructor
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
        name: (identifier) @definition.method.static
      )
    ) @modifier.visibility
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
        name: (identifier) @definition.method.class
      )
    ) @scope.method
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
        name: (identifier) @definition.property
      )
    ) @definition.property
  )
)

; Class attributes
(class_definition
  body: (block
    (expression_statement
      (assignment
        left: (identifier) @definition.field
        right: (_) @reference.identifier
      )
    )
  )
)

; Variable assignments
(assignment
  left: (identifier) @definition.variable @assignment.target
  right: (_) @assignment.source
) @assignment.var

; Annotated assignments (with type hints)
(assignment
  left: (identifier) @definition.variable.typed @assignment.target
  type: (_) @type.annotation
  right: (_)? @assignment.source.typed
) @assignment.typed

; Multiple assignments
(assignment
  left: (pattern_list
    (identifier) @definition.variable.multiple
  )
  right: (_) @assignment.source.multiple
) @assignment.multiple

; Tuple unpacking
(assignment
  left: (tuple_pattern
    (identifier) @definition.variable.tuple
  )
  right: (_) @assignment.source.tuple
) @assignment.tuple

; Parameters
(parameters
  (identifier) @definition.param
)

(parameters
  (default_parameter
    name: (identifier) @definition.param.default
  )
)

(parameters
  (typed_parameter
    (identifier) @definition.param.typed
    type: (_) @type.type_annotation
  )
)

(parameters
  (typed_default_parameter
    name: (identifier) @definition.param.typed.default
    type: (_) @type.type_annotation.default
  )
)

; *args and **kwargs
(parameters
  (list_splat_pattern
    (identifier) @definition.param.args
  )
)

(parameters
  (dictionary_splat_pattern
    (identifier) @definition.param.kwargs
  )
)

; Loop variables
(for_statement
  left: (identifier) @definition.loop_var
)

(for_statement
  left: (pattern_list
    (identifier) @definition.loop_var.multiple
  )
)

; Comprehension variables
(for_in_clause
  left: (identifier) @definition.comprehension_var
)

; Exception variables
(except_clause
  (as_pattern
    alias: (as_pattern_target
      (identifier) @definition.except_var
    )
  )
)

; With statement variables
(with_statement
  (with_clause
    (with_item
      (as_pattern
        alias: (as_pattern_target
          (identifier) @definition.with_var
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
  name: (dotted_name) @import.import
)

(import_statement
  name: (aliased_import
    name: (dotted_name) @import.import.source
    alias: (identifier) @import.import.alias
  )
)

; From imports
(import_from_statement
  module_name: (dotted_name) @import.import
  name: (dotted_name) @import.import
)

(import_from_statement
  module_name: (dotted_name) @import.import
  name: (aliased_import
    name: (dotted_name) @import.import.source
    alias: (identifier) @import.import.alias
  )
)

; Import all (from module import *)
(import_from_statement
  module_name: (dotted_name) @import.import.star
  (wildcard_import) @import.import
)

; Relative imports
(import_from_statement
  module_name: (relative_import) @import.import.relative
  name: (dotted_name) @import.import.relative
)

;; ==============================================================================
;; EXPORTS (Python's implicit export model)
;; ==============================================================================

; __all__ definition (explicit exports)
(module
  (expression_statement
    (assignment
      left: (identifier) @export.variable
      (#eq? @export.variable "__all__")
      right: (list) @export.variable.list
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
        (string) @export.variable
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
  function: (identifier) @reference.call
)

; Method calls with receiver tracking
(call
  function: (attribute
    object: (_) @reference.receiver
    attribute: (identifier) @reference.method_call
  )
) @reference.method_call.full

; Chained method calls (2 levels)
(call
  function: (attribute
    object: (attribute
      object: (_) @reference.receiver.base
      attribute: (identifier) @reference.chain.prop1
    ) @reference.receiver.chain
    attribute: (identifier) @reference.method_call.chained
  )
) @reference.method_call.chained

; Deep property chains (3+ levels)
(call
  function: (attribute
    object: (attribute
      object: (attribute) @reference.receiver.deep
      attribute: (identifier) @reference.chain.prop2
    ) @reference.receiver.chain2
    attribute: (identifier) @reference.method_call.deep
  )
) @reference.method_call.deep

; Constructor calls (class instantiation)
(call
  function: (identifier) @reference.constructor
  arguments: (argument_list)
) @reference.call

; Static method call - object is a class identifier (capitalized)
(call
  function: (attribute
    object: (identifier) @reference.type_reference
    attribute: (identifier) @modifier.visibility)
  (#match? @reference.type_reference "^[A-Z]")) @reference.call

; Instance method call - object is lowercase/instance
(call
  function: (attribute
    object: (identifier) @reference.ref
    attribute: (identifier) @reference.method_call)
  (#not-match? @reference.ref "^[A-Z]")) @reference.method_call

; Attribute access
(attribute
  object: (identifier) @reference.object
  attribute: (identifier) @reference.property
) @reference.member_access

; Subscript access
(subscript
  value: (identifier) @reference.subscript.object
  subscript: (_) @reference.subscript.index
) @reference.member_access

; Assignments (capture both sides)
(assignment
  left: (identifier) @reference.assign.target
  right: (_) @reference.assign.source
) @assignment.expr

(assignment
  left: (attribute
    object: (identifier) @reference.assign.object
    attribute: (identifier) @reference.assign.property
  ) @reference.assign.member
  right: (_) @reference.assign.source.member
) @assignment.member

; Augmented assignments (+=, -=, etc.)
(augmented_assignment
  left: (identifier) @reference.augment.target
  right: (_) @reference.augment.source
) @assignment.augmented

; Return statements
(return_statement
  (_) @reference.return
) @return.function

; Yield expressions
(yield
  (_) @reference.yield
) @return.expression

; Delete statements
(delete_statement
  (identifier) @reference.delete
)

; Assert statements
(assert_statement
  (identifier) @reference.assert
)

; Decorators
(decorator
  (identifier) @reference.decorator
)

(decorator
  (call
    function: (identifier) @reference.decorator.call
  )
)

; self references (important for method context)
(identifier) @reference.self
(#eq? @reference.self "self")

; cls references (for classmethods)
(identifier) @reference.cls
(#eq? @reference.cls "cls")

; super() calls
(call
  function: (identifier) @reference.super
  (#eq? @reference.super "super")
) @reference.call

; Type annotations in various contexts
(type
  (identifier) @reference.type
)

(type
  (generic_type
    (identifier) @reference.type.generic
  )
)

; General identifier references (catch-all)
(identifier) @reference.identifier