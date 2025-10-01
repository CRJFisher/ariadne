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
(lambda) @scope.closure

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
(for_statement) @scope.block
(while_statement) @scope.block
(with_statement) @scope.block
(if_statement) @scope.block
(elif_clause) @scope.block
(else_clause) @scope.block
(try_statement) @scope.block
(except_clause) @scope.block
(finally_clause) @scope.block
(match_statement) @scope.block
(case_clause) @scope.block

; Comprehension scopes
(list_comprehension) @scope.block
(dictionary_comprehension) @scope.block
(set_comprehension) @scope.block
(generator_expression) @scope.block

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
  left: (identifier) @definition.function @assignment.variable
  right: (lambda) @assignment.variable.lambda
) @assignment.variable

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
        (identifier) @modifier.visibility
        (#eq? @modifier.visibility "staticmethod")
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
        (identifier) @modifier.visibility
        (#eq? @modifier.visibility "classmethod")
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
        right: (_) @reference.variable
      )
    )
  )
)

; Variable assignments
(assignment
  left: (identifier) @definition.variable @assignment.variable
  right: (_) @assignment.variable
) @assignment.variable

; Annotated assignments (with type hints)
(assignment
  left: (identifier) @definition.variable.typed @assignment.variable
  type: (_) @type.type_annotation
  right: (_)? @assignment.variable.typed
) @assignment.variable

; Multiple assignments
(assignment
  left: (pattern_list
    (identifier) @definition.variable.multiple
  )
  right: (_) @assignment.variable.multiple
) @assignment.variable

; Tuple unpacking
(assignment
  left: (tuple_pattern
    (identifier) @definition.variable.tuple
  )
  right: (_) @assignment.variable.tuple
) @assignment.variable

; Parameters
(parameters
  (identifier) @definition.parameter
)

(parameters
  (default_parameter
    name: (identifier) @definition.parameter.default
  )
)

(parameters
  (typed_parameter
    (identifier) @definition.parameter.typed
    type: (_) @type.type_annotation
  )
)

(parameters
  (typed_default_parameter
    name: (identifier) @definition.parameter.typed.default
    type: (_) @type.type_annotation.default
  )
)

; *args and **kwargs
(parameters
  (list_splat_pattern
    (identifier) @definition.parameter.args
  )
)

(parameters
  (dictionary_splat_pattern
    (identifier) @definition.parameter.kwargs
  )
)

; Loop variables
(for_statement
  left: (identifier) @definition.variable
)

(for_statement
  left: (pattern_list
    (identifier) @definition.variable.multiple
  )
)

; Comprehension variables
(for_in_clause
  left: (identifier) @definition.variable
)

; Exception variables
(except_clause
  (as_pattern
    alias: (as_pattern_target
      (identifier) @definition.variable
    )
  )
)

; With statement variables
(with_statement
  (with_clause
    (with_item
      (as_pattern
        alias: (as_pattern_target
          (identifier) @definition.variable
        )
      )
    )
  )
)

;; ==============================================================================
;; IMPORTS
;; ==============================================================================

; Import statements (import X)
(import_statement
  name: (dotted_name) @definition.import
)

; Aliased import statements (import X as Y)
(import_statement
  name: (aliased_import
    name: (dotted_name) @definition.import
    alias: (identifier) @definition.import
  )
)

; From imports (from X import Y)
(import_from_statement
  module_name: (dotted_name)
  name: (dotted_name) @definition.import
)

; Aliased from imports (from X import Y as Z)
(import_from_statement
  module_name: (dotted_name)
  name: (aliased_import
    name: (dotted_name) @definition.import
    alias: (identifier) @definition.import
  )
)

; Import all (from module import *)
(import_from_statement
  module_name: (dotted_name)
  (wildcard_import) @definition.import
)

; Relative imports (from . import X, from .. import Y)
(import_from_statement
  module_name: (relative_import)
  name: (dotted_name) @definition.import
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
    object: (_) @reference.variable
    attribute: (identifier) @reference.call
  )
) @reference.call.full

; Chained method calls (2 levels)
(call
  function: (attribute
    object: (attribute
      object: (_) @reference.variable.base
      attribute: (identifier) @reference.property.prop1
    ) @reference.variable.chain
    attribute: (identifier) @reference.call.chained
  )
) @reference.call.chained

; Deep property chains (3+ levels)
(call
  function: (attribute
    object: (attribute
      object: (attribute) @reference.variable.deep
      attribute: (identifier) @reference.property.prop2
    ) @reference.variable.chain2
    attribute: (identifier) @reference.call.deep
  )
) @reference.call.deep

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
    object: (identifier) @reference.variable
    attribute: (identifier) @reference.call)
  (#not-match? @reference.variable "^[A-Z]")) @reference.call

; Attribute access
(attribute
  object: (identifier) @reference.variable
  attribute: (identifier) @reference.property
) @reference.member_access

; Subscript access
(subscript
  value: (identifier) @reference.variable.subscript
  subscript: (_) @reference.variable.index
) @reference.member_access

; Assignments (capture both sides)
(assignment
  left: (identifier) @reference.variable.target
  right: (_) @reference.variable.source
) @assignment.variable

(assignment
  left: (attribute
    object: (identifier) @reference.variable.object
    attribute: (identifier) @reference.property.assign
  ) @reference.member_access.assign
  right: (_) @reference.variable.source.member
) @assignment.property

; Augmented assignments (+=, -=, etc.)
(augmented_assignment
  left: (identifier) @reference.variable.target
  right: (_) @reference.variable.source
) @assignment.variable

; Return statements
(return_statement
  (_) @return.variable
) @return.function

; Yield expressions
(yield
  (_) @return.variable
) @return.variable

; Delete statements
(delete_statement
  (identifier) @reference.variable
)

; Assert statements
(assert_statement
  (identifier) @reference.variable
)

; Decorators
(decorator
  (identifier) @reference.call
)

(decorator
  (call
    function: (identifier) @reference.call.decorator
  )
)

; self references (important for method context)
(identifier) @reference.this
(#eq? @reference.this "self")

; cls references (for classmethods)
(identifier) @reference.this
(#eq? @reference.this "cls")

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
(identifier) @reference.variable