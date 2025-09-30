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
  value: (_) @reference.value) @reference.expression

; Match arms with patterns and values
(match_arm
  pattern: (_) @reference.definition
  value: (_) @reference.value) @reference.match_arm

; Pattern variables - general capture of identifiers in pattern contexts
; This will capture most pattern-bound variables automatically

; Struct pattern destructuring
(struct_pattern
  type: (type_identifier) @reference.struct_type) @reference.struct_destructure

; Tuple pattern destructuring
(tuple_pattern) @reference.tuple_destructure

; Or patterns (pattern | pattern)
(or_pattern) @reference.or

; Range patterns
(range_pattern) @reference.range

; Ref patterns
(ref_pattern) @reference.ref

; Mut patterns
(mut_pattern) @reference.mut

; Slice patterns
(slice_pattern) @reference.slice

; If-let expressions
(if_expression
  condition: (let_condition
    pattern: (_) @reference.if_let
    value: (_) @reference.if_let_value)) @reference.if_let

; While-let expressions
(while_expression
  condition: (let_condition
    pattern: (_) @reference.while_let
    value: (_) @reference.while_let_value)) @reference.while_let

; Let-else statements
(let_declaration
  pattern: (_) @reference.let_else_pattern
  value: (_) @reference.let_else_value
  alternative: (_) @reference.let_else_alternative) @reference.let_else

; Pattern in for loops
(for_expression
  pattern: (_) @reference.for_loop
  value: (_) @reference.for_loop_iterable) @reference.for_loop_pattern

; Function parameters with patterns
(parameter
  pattern: (tuple_pattern) @reference.param_destructure) @reference.param_tuple

(parameter
  pattern: (struct_pattern) @reference.param_destructure) @reference.param_struct

;; ==============================================================================
;; DEFINITIONS - Basic symbols
;; ==============================================================================

; Struct with generics (must come first to match before general pattern)
(struct_item
  name: (type_identifier) @definition.struct.generic
  type_parameters: (type_parameters)
)

; Struct definitions (general)
(struct_item
  name: (type_identifier) @definition.struct
)

; Struct fields
(field_declaration
  name: (field_identifier) @definition.field
)

; Enum with generics (must come first)
(enum_item
  name: (type_identifier) @definition.enum.generic
  type_parameters: (type_parameters)
)

; Enum definitions (general)
(enum_item
  name: (type_identifier) @definition.enum
)

; Enum variants
(enum_variant
  name: (identifier) @definition.enum_variant
)

; Generic functions (must come first)
(function_item
  name: (identifier) @definition.function.generic
  type_parameters: (type_parameters)
)

; Async functions (identified by modifiers)
(function_item
  (function_modifiers
    "async"
  )
  name: (identifier) @definition.function.async
)

; Const functions
(function_item
  (function_modifiers "const")
  name: (identifier) @definition.function.const
)

; Unsafe const functions (const unsafe order)
(function_item
  (function_modifiers "const" "unsafe")
  name: (identifier) @definition.function.unsafe
)

(function_item
  (function_modifiers "const" "unsafe")
  name: (identifier) @definition.function.const
)

; Unsafe const functions (unsafe const order)
(function_item
  (function_modifiers "unsafe" "const")
  name: (identifier) @definition.function.unsafe
)

(function_item
  (function_modifiers "unsafe" "const")
  name: (identifier) @definition.function.const
)

; Unsafe functions (identified by modifiers)
(function_item
  (function_modifiers
    "unsafe"
  )
  name: (identifier) @definition.function.unsafe
)

; Function definitions (general)
(function_item
  name: (identifier) @definition.function
)

; Trait implementations
(impl_item
  trait: (type_identifier) @reference.trait
  type: (type_identifier) @reference.type
) @reference.trait_impl

; Trait implementations with generic type
(impl_item
  trait: (type_identifier) @reference.trait
  type: (generic_type
    type: (type_identifier) @reference.type.generic
  )
) @reference.trait_impl.generic

; Async methods in trait implementations (with self parameter)
(impl_item
  trait: (_)
  body: (declaration_list
    (function_item
      (function_modifiers
        "async"
      )
      name: (identifier) @definition.trait_impl_method.async
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
      name: (identifier) @definition.trait_impl_method
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
      name: (identifier) @definition.trait_impl_method.associated
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
      name: (identifier) @definition.method
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
      name: (identifier) @definition.method.associated
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
      name: (identifier) @definition.constructor
      (#match? @definition.constructor "^(new|default|from|try_from|with_.*)$")
    )
  )
)

; Generic traits (must come first) - captured as interfaces
(trait_item
  name: (type_identifier) @definition.interface.generic
  type_parameters: (type_parameters)
) @scope.interface

; Trait definitions (general) - captured as interfaces
(trait_item
  name: (type_identifier) @definition.interface
) @scope.interface

; Trait methods (signatures without body)
(trait_item
  body: (declaration_list
    (function_signature_item
      name: (identifier) @definition.trait_method
    )
  )
)

; Trait methods with default implementation
(trait_item
  body: (declaration_list
    (function_item
      name: (identifier) @definition.trait_method.default
    )
  )
)

; Associated types in traits
(trait_item
  body: (declaration_list
    (associated_type
      name: (type_identifier) @definition.associated_type
    )
  )
)

; Associated types in trait implementations
(impl_item
  trait: (_)
  body: (declaration_list
    (type_item
      name: (type_identifier) @definition.associated_type.impl
    )
  )
)

; Associated constants in traits
(trait_item
  body: (declaration_list
    (const_item
      name: (identifier) @definition.associated_const
    )
  )
)

; Type aliases
(type_item
  name: (type_identifier) @definition.type_alias
)

; Constants
(const_item
  name: (identifier) @definition.const
)

; Static items
(static_item
  name: (identifier) @definition.static
)

; Variable bindings
(let_declaration
  pattern: (identifier) @definition.variable
)

; Mutable variables
(let_declaration
  (mutable_specifier)
  pattern: (identifier) @definition.variable.mut
)

; Function parameters
(parameter
  pattern: (identifier) @definition.param
)

; Self parameters
(self_parameter
  (self) @definition.param.self
)

; Closure expressions
(closure_expression) @definition.function.closure

; Async closures (experimental feature)
; Pattern: |args| async { ... }
(closure_expression
  body: (async_block) @modifier.block
) @definition.function.async_closure

; Async move closures
; Pattern: |args| async move { ... }
(closure_expression
  body: (async_block
    "move" @modifier.move_modifier
  )
) @definition.function.async_move_closure

; Closure parameters - simple identifiers
(closure_expression
  parameters: (closure_parameters
    (identifier) @definition.param.closure
  )
)

; Closure parameters with type annotations
(closure_expression
  parameters: (closure_parameters
    (parameter
      pattern: (identifier) @definition.param.closure
    )
  )
)

; Loop variables
(for_expression
  pattern: (identifier) @definition.loop_var
)

; Loop variables in tuple patterns
(for_expression
  pattern: (tuple_pattern
    (identifier) @definition.loop_var
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
  pattern: (identifier) @definition.loop_var
)

; Module definitions with body
(mod_item
  name: (identifier) @definition.module
  body: (declaration_list) @definition.body
) @definition.inline

; Module declarations without body (external file)
(mod_item
  name: (identifier) @definition.module
  !body
) @definition.external

; Public module definitions
(mod_item
  (visibility_modifier) @definition.visibility
  name: (identifier) @definition.module.public
) @definition.public


;; ==============================================================================
;; GENERICS AND LIFETIMES
;; ==============================================================================

; Type parameters (simple)
(type_parameters
  (type_identifier) @definition.type_param
)

; Constrained type parameters (e.g., T: Clone)
(constrained_type_parameter
  left: (type_identifier) @definition.type_param.constrained
  bounds: (trait_bounds) @type.bounds
)

; Const parameters
(const_parameter
  name: (identifier) @definition.const_param
)

; Lifetime parameters in type parameters
(type_parameters
  (lifetime) @type.param
)

; Lifetime parameters in type arguments
(type_arguments
  (lifetime) @type.param
)

; Lifetime references in types
(reference_type
  (lifetime) @type.ref
)

; Lifetimes in trait bounds
(trait_bounds
  (lifetime) @type.ref
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
) @definition.function.returns_impl

; Functions accepting impl Trait parameters
(function_item
  parameters: (parameters
    (parameter
      type: (abstract_type) @definition.impl_trait
    )
  )
) @definition.function.accepts_impl

;; ==============================================================================
;; WHERE CLAUSES AND CONSTRAINTS
;; ==============================================================================

; Where clause
(where_clause) @type.where_clause

; Where predicates with type bounds
(where_predicate
  left: (type_identifier) @type.type
  bounds: (trait_bounds) @type.bounds
)

; Lifetime where predicates
(where_predicate
  left: (lifetime) @type.lifetime
  bounds: (trait_bounds) @type.bounds
)

; Trait bounds in where clauses
(trait_bounds
  (type_identifier) @type.trait
)

; Generic trait bounds
(trait_bounds
  (generic_type
    type: (type_identifier) @type.trait.generic
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
      name: (identifier) @import.import
    )
    "as"
    (identifier) @import.alias
  )
) @import.declaration.aliased

; Use with alias (simple identifier)
(use_declaration
  argument: (use_as_clause
    (identifier) @import.import
    "as"
    (identifier) @import.alias
  )
) @import.declaration.aliased

; Wildcard imports
(use_declaration
  argument: (use_wildcard) @import.import
) @import.import.declaration

; Use lists (e.g., use module::{A, B, C})
(use_declaration
  argument: (use_list
    (identifier) @import.name
  )
) @import.list.declaration

; Scoped use lists with simple items (e.g., std::fmt::{Display, Formatter})
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.import
    list: (use_list
      (identifier) @import.name
    )
  )
) @import.scoped_list.declaration

; Scoped use lists with scoped items
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.import
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
    path: (_) @import.import
    list: (use_list
      (use_as_clause
        (identifier) @import.import
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
        path: (_) @import.import
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
      (self) @import.import
    )
  )
) @import.import.declaration

; External crates (with or without alias)
(extern_crate_declaration
  (identifier) @import.import
) @import.import.declaration

; External crates with alias specifically
(extern_crate_declaration
  (identifier) @import.import.original
  "as"
  (identifier) @import.import.alias
) @import.import.aliased

;; ==============================================================================
;; VISIBILITY MODIFIERS
;; ==============================================================================

; Public visibility (plain pub)
(visibility_modifier
  "pub"
) @modifier.public

; Crate visibility - pub(crate)
(visibility_modifier
  (crate) @modifier.scope.crate
) @modifier.crate

; Super visibility - pub(super)
(visibility_modifier
  (super) @modifier.scope.super
) @modifier.super

; Path visibility - pub(in path::to::module)
(visibility_modifier
  "in"
  (scoped_identifier) @modifier.scope.path
) @modifier.restricted

; Self visibility - pub(self) (equivalent to private)
(visibility_modifier
  (self) @modifier.scope.self
) @modifier.self

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
  (visibility_modifier) @export.variable.visibility
  argument: (use_as_clause
    (scoped_identifier
      name: (identifier) @export.variable.original_name
    ) @export.variable.source
    "as"
    (identifier) @export.variable.alias
  )
) @export.variable.aliased

; Re-exports (pub use simple alias)
(use_declaration
  (visibility_modifier) @export.variable.visibility
  argument: (use_as_clause
    (identifier) @export.variable.original_name
    "as"
    (identifier) @export.variable.alias
  )
) @export.variable.aliased

; Re-exports (pub use with scoped path)
(use_declaration
  (visibility_modifier) @export.variable.visibility
  argument: (scoped_identifier
    name: (identifier) @export.variable.name
  ) @export.variable.path
) @export.variable

; Re-exports (pub use simple identifier)
(use_declaration
  (visibility_modifier) @export.variable.visibility
  argument: (identifier) @export.variable.name
) @export.variable.simple

; Re-exports (pub use with use_list)
(use_declaration
  (visibility_modifier) @export.variable.visibility
  argument: (scoped_use_list
    path: (_) @export.variable.source_path
    list: (use_list
      (identifier) @export.variable.item
    )
  )
) @export.variable.list

; Re-exports (pub use with wildcard)
(use_declaration
  (visibility_modifier) @export.variable.visibility
  argument: (use_wildcard
    (scoped_identifier) @export.variable.wildcard_path
  )
) @export.variable.wildcard

; Re-exports with any visibility modifier
; This captures all pub use including pub(crate) use, pub(super) use, etc.
(use_declaration
  (visibility_modifier) @export.variable.visibility.any
  argument: (_) @export.variable.item
) @export.variable.any_visibility

;; ==============================================================================
;; MACROS
;; ==============================================================================

; Macro definitions (declarative)
(macro_definition
  name: (identifier) @definition.macro) @reference.macrodefinition

; Macro invocations
(macro_invocation
  macro: (identifier) @reference.macro) @call.macro_invocation

; Scoped macro invocations
(macro_invocation
  macro: (scoped_identifier
    name: (identifier) @reference.macro.scoped
  )) @call.scoped_macro_invocation

; Built-in macro invocations
(macro_invocation
  macro: (identifier) @reference.macro.builtin
  (#match? @reference.macro.builtin "^(println|eprintln|print|eprint|vec|panic|assert|debug_assert|format|write|writeln|todo|unimplemented|unreachable|compile_error|include|include_str|include_bytes|concat|stringify|env|option_env|cfg|column|file|line|module_path|assert_eq|assert_ne|debug_assert_eq|debug_assert_ne|matches|dbg|try|join|select)$")
) @call.builtin_macro_invocation

; Async macro invocations (tokio::select!, tokio::join!, etc.)
(macro_invocation
  macro: (scoped_identifier
    path: (identifier) @modifier.crate
    name: (identifier) @reference.macro.async
  )
  (#eq? @modifier.crate "tokio")
  (#match? @reference.macro.async "^(select|join|spawn|timeout)$")
) @call.async_macro_invocation

; Attribute macros
(attribute_item
  (attribute) @decorator.classcontent) @decorator.classmacro

; Derive macros - simplified pattern
(attribute_item
  (attribute
    (identifier) @decorator.classname
    (token_tree) @decorator.classarguments)
  (#eq? @decorator.classname "derive")) @decorator.classattribute

; Procedural macro usage
(attribute_item
  (attribute
    (scoped_identifier
      path: (identifier) @decorator.classcrate
      name: (identifier) @decorator.classname)) @decorator.classattribute)

;; ==============================================================================
;; OWNERSHIP AND REFERENCES
;; ==============================================================================

; Reference expressions (borrow) - matches all references
(reference_expression
  value: (_) @reference.borrowed
) @reference.borrow

; Mutable reference expressions (mutable borrow)
(reference_expression
  (mutable_specifier)
  value: (_) @reference.borrowed.mut
) @reference.borrow_mut

; Dereference expressions
(unary_expression
  (_) @reference.dereferenced
) @reference.deref

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

; Specific smart pointer patterns for better matching
(generic_type
  type: (type_identifier) @type.box
  (#match? @type.box "^Box$")
) @type.box

(generic_type
  type: (type_identifier) @type.rc
  (#match? @type.rc "^Rc$")
) @type.rc

(generic_type
  type: (type_identifier) @type.arc
  (#match? @type.arc "^Arc$")
) @type.arc

; Box::new() calls (smart pointer allocation)
(call_expression
  function: (scoped_identifier
    path: (identifier) @type.module
    name: (identifier) @type.function
  )
  (#eq? @type.module "Box")
  (#eq? @type.function "new")
) @type.allocation

; Smart pointer method calls (clone, as_ref, as_mut, etc.)
(call_expression
  function: (field_expression
    value: (_) @type.instance
    field: (field_identifier) @type.method
  )
  (#match? @type.method "^(clone|as_ref|as_mut|get|get_mut|borrow|borrow_mut|try_borrow|try_borrow_mut|lock|try_lock|read|write|try_read|try_write)$")
) @type.method_call

;; ==============================================================================
;; REFERENCES AND CALLS
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @reference.call
)

; Method calls
(call_expression
  function: (field_expression
    value: (_) @reference.receiver
    field: (field_identifier) @reference.method_call
  )
)

; Chained method calls
(call_expression
  function: (field_expression
    value: (field_expression
      value: (_) @reference.receiver.base
      field: (field_identifier) @reference.chain.field1
    )
    field: (field_identifier) @reference.method_call.chained
  )
)

; Associated function calls (Type::function)
(call_expression
  function: (scoped_identifier
    path: (_) @reference.type
    name: (identifier) @reference.associated_function
  )
)

; Static method call (associated function) - uses ::
(call_expression
  function: (scoped_identifier
    path: (identifier) @reference.type_reference
    name: (identifier) @modifier.visibility)
) @reference.call

; Instance method call - uses .
(call_expression
  function: (field_expression
    value: (_) @reference.ref
    field: (field_identifier) @reference.method_call)
) @reference.method_call

; Generic function calls
(call_expression
  function: (generic_function
    function: (identifier) @reference.call.generic
  )
)

; Field access
(field_expression
  value: (_) @reference.object
  field: (field_identifier) @reference.field
)

; Struct construction
(struct_expression
  name: (_) @reference.constructor.struct
)

; Type references
(type_identifier) @reference.type

; Self and super
(self) @reference.self
(super) @reference.super

; Assignments
(assignment_expression
  left: (identifier) @reference.assign.target
  right: (_) @reference.assign.source
)

; Compound assignments
(compound_assignment_expr
  left: (identifier) @reference.compound.target
  right: (_) @reference.compound.source
)

; Return expressions
(return_expression
  (_)? @reference.return
)


; Try operator - capture the whole expression to include "?"
(try_expression) @reference.try

; Await expressions
(await_expression) @reference.await

; General identifier references
(identifier) @reference.identifier