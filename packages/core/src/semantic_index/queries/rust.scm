;; ==============================================================================
;; SEMANTIC INDEX - Rust Language Support (Corrected)
;; ==============================================================================
;; Captures semantic information for Rust using verified node types
;; ==============================================================================

;; ==============================================================================
;; SCOPES - Define lexical boundaries
;; ==============================================================================

; Root scope
(source_file) @scope.module

; Function scopes
(function_item) @scope.function
(closure_expression) @scope.closure

; Type scopes
(struct_item) @scope.struct
(enum_item) @scope.enum
(trait_item) @scope.trait
(impl_item) @scope.impl

; Module scopes
(mod_item) @scope.module

; Block scopes
(block) @scope.block
(unsafe_block) @scope.block.unsafe
(async_block) @scope.block.async

; Control flow scopes
(if_expression) @scope.if
(match_expression) @scope.match
(for_expression) @scope.for
(while_expression) @scope.while
(loop_expression) @scope.loop
(match_arm) @scope.match_arm

;; ==============================================================================
;; PATTERN MATCHING
;; ==============================================================================

; Match expressions with value and body
(match_expression
  value: (_) @match.value) @match.expression

; Match arms with patterns and values
(match_arm
  pattern: (_) @pattern.definition
  value: (_) @pattern.value) @pattern.match_arm

; Pattern variables - general capture of identifiers in pattern contexts
; This will capture most pattern-bound variables automatically

; Struct pattern destructuring
(struct_pattern
  type: (type_identifier) @pattern.struct_type) @pattern.struct_destructure

; Tuple pattern destructuring
(tuple_pattern) @pattern.tuple_destructure

; Or patterns (pattern | pattern)
(or_pattern) @pattern.or

; Range patterns
(range_pattern) @pattern.range

; Ref patterns
(ref_pattern) @pattern.ref

; Mut patterns
(mut_pattern) @pattern.mut

; Slice patterns
(slice_pattern) @pattern.slice

; If-let expressions
(if_expression
  condition: (let_condition
    pattern: (_) @pattern.if_let
    value: (_) @pattern.if_let_value)) @control_flow.if_let

; While-let expressions
(while_expression
  condition: (let_condition
    pattern: (_) @pattern.while_let
    value: (_) @pattern.while_let_value)) @control_flow.while_let

; Let-else statements
(let_declaration
  pattern: (_) @pattern.let_else_pattern
  value: (_) @pattern.let_else_value
  alternative: (_) @pattern.let_else_alternative) @pattern.let_else

; Pattern in for loops
(for_expression
  pattern: (_) @pattern.for_loop
  value: (_) @pattern.for_loop_iterable) @pattern.for_loop_pattern

; Function parameters with patterns
(parameter
  pattern: (tuple_pattern) @pattern.param_destructure) @pattern.param_tuple

(parameter
  pattern: (struct_pattern) @pattern.param_destructure) @pattern.param_struct

;; ==============================================================================
;; DEFINITIONS - Basic symbols
;; ==============================================================================

; Struct with generics (must come first to match before general pattern)
(struct_item
  name: (type_identifier) @def.struct.generic
  type_parameters: (type_parameters)
)

; Struct definitions (general)
(struct_item
  name: (type_identifier) @def.struct
)

; Struct fields
(field_declaration
  name: (field_identifier) @def.field
)

; Enum with generics (must come first)
(enum_item
  name: (type_identifier) @def.enum.generic
  type_parameters: (type_parameters)
)

; Enum definitions (general)
(enum_item
  name: (type_identifier) @def.enum
)

; Enum variants
(enum_variant
  name: (identifier) @def.enum_variant
)

; Generic functions (must come first)
(function_item
  name: (identifier) @def.function.generic
  type_parameters: (type_parameters)
)

; Async functions (identified by modifiers)
(function_item
  (function_modifiers
    "async"
  )
  name: (identifier) @def.function.async
)

; Unsafe functions (identified by modifiers)
(function_item
  (function_modifiers
    "unsafe"
  )
  name: (identifier) @def.function.unsafe
)

; Function definitions (general)
(function_item
  name: (identifier) @def.function
)

; Trait implementations
(impl_item
  trait: (type_identifier) @impl.trait
  type: (type_identifier) @impl.type
) @impl.trait_impl

; Trait implementations with generic type
(impl_item
  trait: (type_identifier) @impl.trait
  type: (generic_type
    type: (type_identifier) @impl.type.generic
  )
) @impl.trait_impl.generic

; Methods in trait implementations (with self parameter)
(impl_item
  trait: (_)
  body: (declaration_list
    (function_item
      name: (identifier) @def.trait_impl_method
      parameters: (parameters
        (self_parameter)
      )
    )
  )
)

; Associated functions in trait implementations
(impl_item
  trait: (_)
  body: (declaration_list
    (function_item
      name: (identifier) @def.trait_impl_method.associated
      parameters: (parameters
        (parameter)
      )
    )
  )
)

; Methods in regular impl blocks (with self parameter)
(impl_item
  type: (_)
  body: (declaration_list
    (function_item
      name: (identifier) @def.method
      parameters: (parameters
        (self_parameter)
      )
    )
  )
)

; Associated functions in regular impl blocks (no self parameter)
(impl_item
  type: (_)
  body: (declaration_list
    (function_item
      name: (identifier) @def.method.associated
      parameters: (parameters
        (parameter)
      )
    )
  )
)

; Constructor functions (named patterns)
(impl_item
  body: (declaration_list
    (function_item
      name: (identifier) @def.constructor
      (#match? @def.constructor "^(new|default|from|try_from|with_.*)$")
    )
  )
)

; Generic traits (must come first) - captured as interfaces
(trait_item
  name: (type_identifier) @def.interface.generic
  type_parameters: (type_parameters)
) @scope.interface

; Trait definitions (general) - captured as interfaces
(trait_item
  name: (type_identifier) @def.interface
) @scope.interface

; Trait methods (signatures without body)
(trait_item
  body: (declaration_list
    (function_signature_item
      name: (identifier) @def.trait_method
    )
  )
)

; Trait methods with default implementation
(trait_item
  body: (declaration_list
    (function_item
      name: (identifier) @def.trait_method.default
    )
  )
)

; Associated types in traits
(trait_item
  body: (declaration_list
    (associated_type
      name: (type_identifier) @def.associated_type
    )
  )
)

; Associated types in trait implementations
(impl_item
  trait: (_)
  body: (declaration_list
    (type_item
      name: (type_identifier) @def.associated_type.impl
    )
  )
)

; Associated constants in traits
(trait_item
  body: (declaration_list
    (const_item
      name: (identifier) @def.associated_const
    )
  )
)

; Type aliases
(type_item
  name: (type_identifier) @def.type_alias
)

; Constants
(const_item
  name: (identifier) @def.const
)

; Static items
(static_item
  name: (identifier) @def.static
)

; Variable bindings
(let_declaration
  pattern: (identifier) @def.variable
)

; Mutable variables
(let_declaration
  (mutable_specifier)
  pattern: (identifier) @def.variable.mut
)

; Function parameters
(parameter
  pattern: (identifier) @def.param
)

; Self parameters
(self_parameter
  (self) @def.param.self
)

; Closure expressions
(closure_expression) @def.function.closure

; Closure parameters
(closure_expression
  parameters: (closure_parameters
    (identifier) @def.param.closure
  )
)

; Loop variables
(for_expression
  pattern: (identifier) @def.loop_var
)

; Module definitions
(mod_item
  name: (identifier) @def.module
)

;; ==============================================================================
;; GENERICS AND LIFETIMES
;; ==============================================================================

; Type parameters (simple)
(type_parameters
  (type_identifier) @def.type_param
)

; Constrained type parameters (e.g., T: Clone)
(constrained_type_parameter
  left: (type_identifier) @def.type_param.constrained
  bounds: (trait_bounds) @constraint.bounds
)

; Const parameters
(const_parameter
  name: (identifier) @def.const_param
)

; Lifetime parameters in type parameters
(type_parameters
  (lifetime) @lifetime.param
)

; Lifetime parameters in type arguments
(type_arguments
  (lifetime) @lifetime.param
)

; Lifetime references in types
(reference_type
  (lifetime) @lifetime.ref
)

; Lifetimes in trait bounds
(trait_bounds
  (lifetime) @lifetime.ref
)

;; ==============================================================================
;; WHERE CLAUSES AND CONSTRAINTS
;; ==============================================================================

; Where clause
(where_clause) @constraint.where_clause

; Where predicates with type bounds
(where_predicate
  left: (type_identifier) @constraint.type
  bounds: (trait_bounds) @constraint.bounds
)

; Lifetime where predicates
(where_predicate
  left: (lifetime) @constraint.lifetime
  bounds: (trait_bounds) @constraint.bounds
)

; Trait bounds in where clauses
(trait_bounds
  (type_identifier) @constraint.trait
)

; Generic trait bounds
(trait_bounds
  (generic_type
    type: (type_identifier) @constraint.trait.generic
  )
)

;; ==============================================================================
;; IMPORTS
;; ==============================================================================

; Simple use statements
(use_declaration
  argument: (scoped_identifier
    name: (identifier) @import.name
  )
)

; Use with alias
(use_declaration
  argument: (use_as_clause
    path: (scoped_identifier
      name: (identifier) @import.source
    )
    alias: (identifier) @import.alias
  )
)

; Wildcard imports
(use_declaration
  argument: (use_wildcard) @import.wildcard
)

; Use lists
(use_declaration
  argument: (use_list
    (identifier) @import.list.item
  )
)

; Scoped use lists (e.g., std::fmt::{Display, Formatter})
(use_declaration
  argument: (scoped_use_list
    list: (use_list
      (identifier) @import.list.item
    )
  )
)

; External crates
(extern_crate_declaration
  name: (identifier) @import.extern_crate
)

;; ==============================================================================
;; VISIBILITY MODIFIERS
;; ==============================================================================

; Visibility modifiers
(visibility_modifier) @visibility.pub

;; ==============================================================================
;; EXPORTS (public items)
;; ==============================================================================

; Public structs
(struct_item
  (visibility_modifier)
  name: (type_identifier) @export.struct
)

; Public enums
(enum_item
  (visibility_modifier)
  name: (type_identifier) @export.enum
)

; Public functions
(function_item
  (visibility_modifier)
  name: (identifier) @export.function
)

; Public traits
(trait_item
  (visibility_modifier)
  name: (type_identifier) @export.trait
)

; Public modules
(mod_item
  (visibility_modifier)
  name: (identifier) @export.module
)

; Re-exports (pub use with alias)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (use_as_clause
    path: (_) @export.pub_use.source
    alias: (identifier) @export.pub_use.alias
  )
) @export.pub_use

; Re-exports (pub use without alias)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (scoped_identifier) @export.pub_use.path
) @export.pub_use

; Re-exports (pub use simple identifier)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (identifier) @export.pub_use.name
) @export.pub_use

; Re-exports (pub use with use_list)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (scoped_use_list
    path: (_) @export.pub_use.source
    list: (use_list) @export.pub_use.items
  )
) @export.pub_use

;; ==============================================================================
;; MACROS
;; ==============================================================================

; Macro definitions
(macro_definition
  name: (identifier) @def.macro
)

; Macro invocations
(macro_invocation
  macro: (identifier) @ref.macro
)

; Scoped macro invocations
(macro_invocation
  macro: (scoped_identifier
    name: (identifier) @ref.macro.scoped
  )
)

;; ==============================================================================
;; OWNERSHIP AND REFERENCES
;; ==============================================================================

; Reference expressions (borrow) - matches all references
(reference_expression
  value: (_) @ref.borrowed
) @ownership.borrow

; Mutable reference expressions (mutable borrow)
(reference_expression
  (mutable_specifier)
  value: (_) @ref.borrowed.mut
) @ownership.borrow_mut

; Dereference expressions
(unary_expression
  (_) @ref.dereferenced
) @ownership.deref

; Reference types
(reference_type
  type: (_) @type.inner
) @type.reference

; Mutable reference types
(reference_type
  (mutable_specifier)
  type: (_) @type.inner.mut
) @type.reference.mut

; Smart pointer types (Box, Rc, Arc, RefCell, Weak)
(generic_type
  type: (type_identifier) @type.smart_pointer.name
  type_arguments: (type_arguments) @type.smart_pointer.args
) @type.smart_pointer
  (#match? @type.smart_pointer.name "^(Box|Rc|Arc|RefCell|Weak|Mutex|RwLock)$")

; Box::new() calls (smart pointer allocation)
(call_expression
  function: (scoped_identifier
    path: (identifier) @box.module
    name: (identifier) @box.function
  )
  (#eq? @box.module "Box")
  (#eq? @box.function "new")
) @smart_pointer.allocation

; Smart pointer method calls (clone, as_ref, as_mut, etc.)
(call_expression
  function: (field_expression
    value: (_) @smart_pointer.instance
    field: (field_identifier) @smart_pointer.method
  )
  (#match? @smart_pointer.method "^(clone|as_ref|as_mut|get|get_mut|borrow|borrow_mut|try_borrow|try_borrow_mut|lock|try_lock|read|write|try_read|try_write)$")
) @smart_pointer.method_call

;; ==============================================================================
;; REFERENCES AND CALLS
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @ref.call
)

; Method calls
(call_expression
  function: (field_expression
    value: (_) @ref.receiver
    field: (field_identifier) @ref.method_call
  )
)

; Chained method calls
(call_expression
  function: (field_expression
    value: (field_expression
      value: (_) @ref.receiver.base
      field: (field_identifier) @ref.chain.field1
    )
    field: (field_identifier) @ref.method_call.chained
  )
)

; Associated function calls (Type::function)
(call_expression
  function: (scoped_identifier
    path: (_) @ref.type
    name: (identifier) @ref.associated_function
  )
)

; Static method call (associated function) - uses ::
(call_expression
  function: (scoped_identifier
    path: (identifier) @class.ref
    name: (identifier) @method.static)
) @static_method_call

; Instance method call - uses .
(call_expression
  function: (field_expression
    value: (_) @instance.ref
    field: (field_identifier) @method.instance)
) @instance_method_call

; Generic function calls
(call_expression
  function: (generic_function
    function: (identifier) @ref.call.generic
  )
)

; Field access
(field_expression
  value: (_) @ref.object
  field: (field_identifier) @ref.field
)

; Struct construction
(struct_expression
  name: (_) @ref.constructor.struct
)

; Type references
(type_identifier) @ref.type

; Self and super
(self) @ref.self
(super) @ref.super

; Assignments
(assignment_expression
  left: (identifier) @ref.assign.target
  right: (_) @ref.assign.source
)

; Compound assignments
(compound_assignment_expr
  left: (identifier) @ref.compound.target
  right: (_) @ref.compound.source
)

; Return expressions
(return_expression
  (_)? @ref.return
)


; Try operator
(try_expression
  (_) @ref.try
)

; Await expressions
(await_expression
  (_) @ref.await
)

; General identifier references
(identifier) @ref.identifier