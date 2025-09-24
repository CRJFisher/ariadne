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

; Const functions
(function_item
  (function_modifiers "const")
  name: (identifier) @def.function.const
)

; Unsafe const functions (const unsafe order)
(function_item
  (function_modifiers "const" "unsafe")
  name: (identifier) @def.function.unsafe
)

(function_item
  (function_modifiers "const" "unsafe")
  name: (identifier) @def.function.const
)

; Unsafe const functions (unsafe const order)
(function_item
  (function_modifiers "unsafe" "const")
  name: (identifier) @def.function.unsafe
)

(function_item
  (function_modifiers "unsafe" "const")
  name: (identifier) @def.function.const
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

; Async methods in trait implementations (with self parameter)
(impl_item
  trait: (_)
  body: (declaration_list
    (function_item
      (function_modifiers
        "async"
      )
      name: (identifier) @def.trait_impl_method.async
      parameters: (parameters
        (self_parameter)
      )
    )
  )
)

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

; Async closures (experimental feature)
; Pattern: |args| async { ... }
(closure_expression
  body: (async_block) @async.block
) @def.function.async_closure

; Async move closures
; Pattern: |args| async move { ... }
(closure_expression
  body: (async_block
    "move" @async.move_modifier
  )
) @def.function.async_move_closure

; Closure parameters - simple identifiers
(closure_expression
  parameters: (closure_parameters
    (identifier) @def.param.closure
  )
)

; Closure parameters with type annotations
(closure_expression
  parameters: (closure_parameters
    (parameter
      pattern: (identifier) @def.param.closure
    )
  )
)

; Loop variables
(for_expression
  pattern: (identifier) @def.loop_var
)

; Loop variables in tuple patterns
(for_expression
  pattern: (tuple_pattern
    (identifier) @def.loop_var
  )
)

; Loop variables in while-let patterns
(while_expression
  condition: (let_condition
    pattern: (_) @while_let_pattern
  )
)

; Variables in while-let conditions
(let_condition
  pattern: (identifier) @def.loop_var
)

; Module definitions with body
(mod_item
  name: (identifier) @def.module
  body: (declaration_list) @module.body
) @module.inline

; Module declarations without body (external file)
(mod_item
  name: (identifier) @def.module
  !body
) @module.external

; Public module definitions
(mod_item
  (visibility_modifier) @module.visibility
  name: (identifier) @def.module.public
) @module.public


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
;; FUNCTION TYPES AND HIGHER-ORDER PATTERNS
;; ==============================================================================

; Function pointer types
(function_type
  "fn" @type.function_keyword
  parameters: (parameters) @type.function_params
  return_type: (_)? @type.function_return
) @type.function_pointer

; Trait object function types (Fn, FnMut, FnOnce)
(generic_type
  type: (type_identifier) @type.trait_name
  (#match? @type.trait_name "^(Fn|FnMut|FnOnce)$")
) @type.function_trait

; Higher-order function calls (map, filter, fold, etc.)
(call_expression
  function: (field_expression
    value: (_) @call.receiver
    field: (field_identifier) @call.method
    (#match? @call.method "^(map|filter|fold|for_each|find|any|all|collect|flat_map|filter_map|take|skip|take_while|skip_while)$")
  )
) @call.higher_order

; Functions returning impl Trait
(function_item
  return_type: (abstract_type) @return.impl_trait
) @def.function.returns_impl

; Functions accepting impl Trait parameters
(function_item
  parameters: (parameters
    (parameter
      type: (abstract_type) @param.impl_trait
    )
  )
) @def.function.accepts_impl

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

; Simple use statements with full path - capturing the last identifier as the import name
(use_declaration
  argument: (scoped_identifier
    (identifier) @import.name
  )
) @import.declaration

; Simple use statements without path (e.g., use self)
(use_declaration
  argument: (identifier) @import.name
) @import.declaration

; Use with alias (scoped path)
(use_declaration
  argument: (use_as_clause
    (scoped_identifier
      name: (identifier) @import.source
    )
    "as"
    (identifier) @import.alias
  )
) @import.declaration.aliased

; Use with alias (simple identifier)
(use_declaration
  argument: (use_as_clause
    (identifier) @import.source
    "as"
    (identifier) @import.alias
  )
) @import.declaration.aliased

; Wildcard imports
(use_declaration
  argument: (use_wildcard) @import.wildcard
) @import.wildcard.declaration

; Use lists (e.g., use module::{A, B, C})
(use_declaration
  argument: (use_list
    (identifier) @import.name
  )
) @import.list.declaration

; Scoped use lists with simple items (e.g., std::fmt::{Display, Formatter})
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.base_path
    list: (use_list
      (identifier) @import.name
    )
  )
) @import.scoped_list.declaration

; Scoped use lists with scoped items
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.base_path
    list: (use_list
      (scoped_identifier
        name: (identifier) @import.name
      )
    )
  )
) @import.scoped_list.declaration

; Scoped use lists with aliases
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.base_path
    list: (use_list
      (use_as_clause
        (identifier) @import.source
        "as"
        (identifier) @import.alias
      )
    )
  )
) @import.scoped_list.declaration

; Nested use lists (e.g., use std::{collections::{HashMap, HashSet}})
(use_declaration
  argument: (scoped_use_list
    list: (use_list
      (scoped_use_list
        path: (_) @import.nested_path
        list: (use_list
          (identifier) @import.name
        )
      )
    )
  )
) @import.nested.declaration

; Self imports in use lists (e.g., use std::fmt::{self, Display})
(use_declaration
  argument: (scoped_use_list
    list: (use_list
      (self) @import.self
    )
  )
) @import.self.declaration

; External crates (with or without alias)
(extern_crate_declaration
  (identifier) @import.extern_crate
) @import.extern_crate.declaration

; External crates with alias specifically
(extern_crate_declaration
  (identifier) @import.extern_crate.original
  "as"
  (identifier) @import.extern_crate.alias
) @import.extern_crate.aliased

;; ==============================================================================
;; VISIBILITY MODIFIERS
;; ==============================================================================

; Public visibility (plain pub)
(visibility_modifier
  "pub"
) @visibility.public

; Crate visibility - pub(crate)
(visibility_modifier
  (crate) @visibility.scope.crate
) @visibility.crate

; Super visibility - pub(super)
(visibility_modifier
  (super) @visibility.scope.super
) @visibility.super

; Path visibility - pub(in path::to::module)
(visibility_modifier
  "in"
  (scoped_identifier) @visibility.scope.path
) @visibility.restricted

; Self visibility - pub(self) (equivalent to private)
(visibility_modifier
  (self) @visibility.scope.self
) @visibility.self

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

; Re-exports (pub use with alias - scoped)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (use_as_clause
    (scoped_identifier
      name: (identifier) @export.pub_use.original_name
    ) @export.pub_use.source
    "as"
    (identifier) @export.pub_use.alias
  )
) @export.pub_use.aliased

; Re-exports (pub use simple alias)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (use_as_clause
    (identifier) @export.pub_use.original_name
    "as"
    (identifier) @export.pub_use.alias
  )
) @export.pub_use.aliased

; Re-exports (pub use with scoped path)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (scoped_identifier
    name: (identifier) @export.pub_use.name
  ) @export.pub_use.path
) @export.pub_use

; Re-exports (pub use simple identifier)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (identifier) @export.pub_use.name
) @export.pub_use.simple

; Re-exports (pub use with use_list)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (scoped_use_list
    path: (_) @export.pub_use.source_path
    list: (use_list
      (identifier) @export.pub_use.item
    )
  )
) @export.pub_use.list

; Re-exports (pub use with wildcard)
(use_declaration
  (visibility_modifier) @export.pub_use.visibility
  argument: (use_wildcard
    (scoped_identifier) @export.pub_use.wildcard_path
  )
) @export.pub_use.wildcard

; Re-exports with any visibility modifier
; This captures all pub use including pub(crate) use, pub(super) use, etc.
(use_declaration
  (visibility_modifier) @export.pub_use.visibility.any
  argument: (_) @export.pub_use.item
) @export.pub_use.any_visibility

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


; Try operator - capture the whole expression to include "?"
(try_expression) @ref.try

; Await expressions
(await_expression) @ref.await

; General identifier references
(identifier) @ref.identifier