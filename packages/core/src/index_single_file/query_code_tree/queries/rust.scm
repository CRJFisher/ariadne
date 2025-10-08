;; ==============================================================================
;; SEMANTIC INDEX - Rust Language Support
;; ==============================================================================
;; Captures semantic information for Rust using verified node types
;;
;; IMPORTANT PATTERN NOTES:
;; 1. Most identifiers are DIRECT CHILDREN, not named fields
;;    ✓ Correct: (parameter (identifier) @capture)
;;    ✗ Wrong:   (parameter pattern: (identifier) @capture)
;;
;; 2. Trait method signatures use function_signature_item (no body)
;;    Trait default methods use function_item (with body)
;;
;; 3. Parameters in closures with type annotations use same structure as functions
;;    Simple: (identifier) direct child of closure_parameters
;;    Typed:  (parameter (identifier)) nested structure
;;
;; See RUST_QUERY_PATTERNS.md for complete AST-to-query mapping
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
(struct_item
  body: (field_declaration_list) @scope.class
)

(enum_item
  body: (enum_variant_list) @scope.enum
)

(trait_item
  body: (declaration_list) @scope.interface
)

(impl_item
  body: (declaration_list) @scope.block
)

; Module scopes
(mod_item) @scope.module

; Block scopes
(unsafe_block) @scope.block.unsafe
(async_block) @scope.block.async

; Control flow scopes
(if_expression) @scope.block
(match_expression) @scope.block
(for_expression) @scope.block
(while_expression) @scope.block
(loop_expression) @scope.block
(match_arm) @scope.block

;; ==============================================================================
;; PATTERN MATCHING
;; ==============================================================================

; Match expressions with value and body
(match_expression
  value: (_) @reference.variable) @reference.variable

; Match arms with patterns and values
(match_arm
  pattern: (_) @reference.variable
  value: (_) @reference.variable) @reference.variable

; Pattern variables - general capture of identifiers in pattern contexts
; This will capture most pattern-bound variables automatically

; Struct pattern destructuring
(struct_pattern
  type: (type_identifier) @reference.type_reference) @reference.variable

; Tuple pattern destructuring
(tuple_pattern) @reference.variable

; Or patterns (pattern | pattern)
(or_pattern) @reference.variable

; Range patterns
(range_pattern) @reference.variable

; Ref patterns
(ref_pattern) @reference.variable

; Mut patterns
(mut_pattern) @modifier.mutability

; Slice patterns
(slice_pattern) @reference.variable

; If-let expressions
(if_expression
  condition: (let_condition
    pattern: (_) @reference.variable
    value: (_) @reference.variable)) @reference.variable

; While-let expressions
(while_expression
  condition: (let_condition
    pattern: (_) @reference.variable
    value: (_) @reference.variable)) @reference.variable

; Let-else statements
(let_declaration
  pattern: (_) @reference.variable
  value: (_) @reference.variable
  alternative: (_) @reference.variable) @reference.variable

; Pattern in for loops
(for_expression
  pattern: (_) @reference.variable
  value: (_) @reference.variable) @reference.variable

; Function parameters with patterns
(parameter
  pattern: (tuple_pattern) @reference.variable) @reference.variable

(parameter
  pattern: (struct_pattern) @reference.variable) @reference.variable

;; ==============================================================================
;; DEFINITIONS - Basic symbols
;; ==============================================================================

; Struct with generics (must come first to match before general pattern)
(struct_item
  name: (type_identifier) @definition.class.generic
  type_parameters: (type_parameters)
)

; Struct definitions (general)
(struct_item
  name: (type_identifier) @definition.class
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

; Enum variants - identifier is direct child, not named field
(enum_variant
  (identifier) @definition.enum_member
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
  trait: (type_identifier) @reference.type_reference
  type: (type_identifier) @reference.type
) @reference.type_reference.impl

; Trait implementations with generic type
(impl_item
  trait: (type_identifier) @reference.type_reference
  type: (generic_type
    type: (type_identifier) @reference.type.generic
  )
) @reference.type_reference.impl.generic

; Async methods in trait implementations - capture all async methods
(impl_item
  trait: (_)
  body: (declaration_list
    (function_item
      (function_modifiers
        "async"
      )
      (identifier) @definition.method.async
    )
  )
)

; Methods in trait implementations - capture all methods
(impl_item
  trait: (_)
  body: (declaration_list
    (function_item
      (identifier) @definition.method
    )
  )
)

; Methods in regular impl blocks - capture all methods
(impl_item
  type: (_)
  body: (declaration_list
    (function_item
      (identifier) @definition.method
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

; Trait methods (signatures without body) - identifier is direct child
(trait_item
  body: (declaration_list
    (function_signature_item
      (identifier) @definition.interface.method
    )
  )
)

; Trait methods with default implementation - identifier is direct child
(trait_item
  body: (declaration_list
    (function_item
      (identifier) @definition.method.default
    )
  )
)

; Associated types in traits
(trait_item
  body: (declaration_list
    (associated_type
      name: (type_identifier) @definition.type_alias
    )
  )
)

; Associated types in trait implementations
(impl_item
  trait: (_)
  body: (declaration_list
    (type_item
      name: (type_identifier) @definition.type_alias.impl
    )
  )
)

; Associated constants in traits
(trait_item
  body: (declaration_list
    (const_item
      name: (identifier) @definition.constant
    )
  )
)

; Type aliases
(type_item
  name: (type_identifier) @definition.type_alias
)

; Constants
(const_item
  name: (identifier) @definition.constant
)

; Static items
(static_item
  name: (identifier) @definition.variable
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

; Function parameters - direct identifier child (not pattern field)
(parameter
  (identifier) @definition.parameter
)

; Self parameters - capture the whole node
(self_parameter) @definition.parameter.self

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
    "move" @modifier.reference
  )
) @definition.function.async_move_closure

; Closure parameters - simple identifiers
(closure_expression
  parameters: (closure_parameters
    (identifier) @definition.parameter.closure
  )
)

; Closure parameters with type annotations - same structure as function parameters
(closure_expression
  parameters: (closure_parameters
    (parameter
      (identifier) @definition.parameter.closure
    )
  )
)

; Loop variables
(for_expression
  pattern: (identifier) @definition.variable
)

; Loop variables in tuple patterns
(for_expression
  pattern: (tuple_pattern
    (identifier) @definition.variable
  )
)

; Loop variables in while-let patterns
(while_expression
  condition: (let_condition
    pattern: (_) @definition.variable
  )
)

; Variables in while-let conditions
(let_condition
  pattern: (identifier) @definition.variable
)

; Module definitions with body
(mod_item
  name: (identifier) @definition.module
  body: (declaration_list) @definition.function
) @definition.function

; Module declarations without body (external file)
(mod_item
  name: (identifier) @definition.module
  !body
) @definition.function

; Public module definitions
(mod_item
  (visibility_modifier) @definition.visibility
  name: (identifier) @definition.module.public
) @definition.function


;; ==============================================================================
;; GENERICS AND LIFETIMES
;; ==============================================================================

; Type parameters (simple)
(type_parameters
  (type_identifier) @definition.type_parameter
)

; Constrained type parameters (e.g., T: Clone)
(constrained_type_parameter
  left: (type_identifier) @definition.type_parameter.constrained
  bounds: (trait_bounds) @type.type_constraint
)

; Const parameters
(const_parameter
  name: (identifier) @definition.parameter
)

; Lifetime parameters in type parameters
(type_parameters
  (lifetime) @type.type_parameter
)

; Lifetime parameters in type arguments
(type_arguments
  (lifetime) @type.type_parameter
)

; Lifetime references in types
(reference_type
  (lifetime) @type.type_reference
)

; Lifetimes in trait bounds
(trait_bounds
  (lifetime) @type.type_reference
)

;; ==============================================================================
;; FUNCTION TYPES AND HIGHER-ORDER PATTERNS
;; ==============================================================================

; Function pointer types
(function_type
  "fn" @type.type_reference
  parameters: (parameters) @type.type_parameters
  return_type: (_)? @type.type_annotation
) @type.type_reference

; Trait object function types (Fn, FnMut, FnOnce)
(generic_type
  type: (type_identifier) @type.type_reference
  (#match? @type.type_reference "^(Fn|FnMut|FnOnce)$")
) @type.type_reference

; Higher-order function calls (map, filter, fold, etc.)
(call_expression
  function: (field_expression
    value: (_) @reference.call
    field: (field_identifier) @reference.call
    (#match? @reference.call "^(map|filter|fold|for_each|find|any|all|collect|flat_map|filter_map|take|skip|take_while|skip_while)$")
  )
) @reference.call

; Functions returning impl Trait
(function_item
  return_type: (abstract_type) @return.variable
) @definition.function.returns_impl

; Functions accepting impl Trait parameters
(function_item
  parameters: (parameters
    (parameter
      type: (abstract_type) @definition.interface
    )
  )
) @definition.function.accepts_impl

;; ==============================================================================
;; WHERE CLAUSES AND CONSTRAINTS
;; ==============================================================================

; Where clause
(where_clause) @type.type_constraint

; Where predicates with type bounds
(where_predicate
  left: (type_identifier) @type.type
  bounds: (trait_bounds) @type.type_constraint
)

; Lifetime where predicates
(where_predicate
  left: (lifetime) @type.type_parameter
  bounds: (trait_bounds) @type.type_constraint
)

; Trait bounds in where clauses
(trait_bounds
  (type_identifier) @type.type_reference
)

; Generic trait bounds
(trait_bounds
  (generic_type
    type: (type_identifier) @type.type_reference.generic
  )
)

;; ==============================================================================
;; IMPORTS
;; ==============================================================================

; Simple use statements with full path - capturing the last identifier as the import name
(use_declaration
  argument: (scoped_identifier
    (identifier) @import.import
  )
) @import.import

; Simple use statements without path (e.g., use self)
(use_declaration
  argument: (identifier) @import.import
) @import.import

; Use with alias (scoped path)
(use_declaration
  argument: (use_as_clause
    (scoped_identifier
      name: (identifier) @import.import
    )
    "as"
    (identifier) @import.import
  )
) @import.import.aliased

; Use with alias (simple identifier)
(use_declaration
  argument: (use_as_clause
    (identifier) @import.import
    "as"
    (identifier) @import.import
  )
) @import.import.aliased

; Wildcard imports
(use_declaration
  argument: (use_wildcard) @import.import
) @import.import.declaration

; Use lists (e.g., use module::{A, B, C})
(use_declaration
  argument: (use_list
    (identifier) @import.import
  )
) @import.import

; Scoped use lists with simple items (e.g., std::fmt::{Display, Formatter})
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.import
    list: (use_list
      (identifier) @import.import
    )
  )
) @import.import

; Scoped use lists with scoped items
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.import
    list: (use_list
      (scoped_identifier
        name: (identifier) @import.import
      )
    )
  )
) @import.import

; Scoped use lists with aliases
(use_declaration
  argument: (scoped_use_list
    path: (_) @import.import
    list: (use_list
      (use_as_clause
        (identifier) @import.import
        "as"
        (identifier) @import.import
      )
    )
  )
) @import.import

; Nested use lists (e.g., use std::{collections::{HashMap, HashSet}})
(use_declaration
  argument: (scoped_use_list
    list: (use_list
      (scoped_use_list
        path: (_) @import.import
        list: (use_list
          (identifier) @import.import
        )
      )
    )
  )
) @import.import

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
) @modifier.visibility

; Crate visibility - pub(crate)
(visibility_modifier
  (crate) @modifier.visibility
) @modifier.visibility

; Super visibility - pub(super)
(visibility_modifier
  (super) @modifier.visibility
) @modifier.super

; Path visibility - pub(in path::to::module)
(visibility_modifier
  "in"
  (scoped_identifier) @modifier.visibility
) @modifier.visibility

; Self visibility - pub(self) (equivalent to private)
(visibility_modifier
  (self) @modifier.visibility
) @modifier.reference

;; ==============================================================================
;; EXPORTS (public items)
;; ==============================================================================

; Public structs
(struct_item
  (visibility_modifier)
  name: (type_identifier) @export.class
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
  name: (type_identifier) @export.interface
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
  name: (identifier) @definition.macro) @reference.macro

; Macro invocations
(macro_invocation
  macro: (identifier) @reference.macro) @reference.macro

; Scoped macro invocations
(macro_invocation
  macro: (scoped_identifier
    name: (identifier) @reference.macro.scoped
  )) @reference.macro

; Built-in macro invocations
(macro_invocation
  macro: (identifier) @reference.macro.builtin
  (#match? @reference.macro.builtin "^(println|eprintln|print|eprint|vec|panic|assert|debug_assert|format|write|writeln|todo|unimplemented|unreachable|compile_error|include|include_str|include_bytes|concat|stringify|env|option_env|cfg|column|file|line|module_path|assert_eq|assert_ne|debug_assert_eq|debug_assert_ne|matches|dbg|try|join|select)$")
) @reference.macro

; Async macro invocations (tokio::select!, tokio::join!, etc.)
(macro_invocation
  macro: (scoped_identifier
    path: (identifier) @modifier.visibility
    name: (identifier) @reference.macro.async
  )
  (#eq? @modifier.visibility "tokio")
  (#match? @reference.macro.async "^(select|join|spawn|timeout)$")
) @reference.macro

; Attribute macros
(attribute_item
  (attribute) @decorator.macro) @decorator.macro

; Derive macros - simplified pattern
(attribute_item
  (attribute
    (identifier) @decorator.macro
    (token_tree) @decorator.macro)
  (#eq? @decorator.macro "derive")) @decorator.macro

; Procedural macro usage
(attribute_item
  (attribute
    (scoped_identifier
      path: (identifier) @decorator.macro
      name: (identifier) @decorator.macro)) @decorator.macro)

;; ==============================================================================
;; OWNERSHIP AND REFERENCES
;; ==============================================================================

; Reference expressions (borrow) - matches all references
(reference_expression
  value: (_) @reference.variable.borrowed
) @reference.variable

; Mutable reference expressions (mutable borrow)
(reference_expression
  (mutable_specifier)
  value: (_) @reference.variable.borrowed
) @reference.variable.mut

; Dereference expressions
(unary_expression
  (_) @reference.variable
) @reference.variable

; Reference types
(reference_type
  type: (_) @type.type_reference.inner
) @type.type_reference

; Mutable reference types
(reference_type
  (mutable_specifier)
  type: (_) @type.type_reference.inner
) @type.type_reference.mut

; Smart pointer types (Box, Rc, Arc, RefCell, Weak)
(generic_type
  type: (type_identifier) @type.type_reference
  type_arguments: (type_arguments) @type.type_argument
) @type.type_reference
  (#match? @type.type_reference "^(Box|Rc|Arc|RefCell|Weak|Mutex|RwLock)$")

; Specific smart pointer patterns for better matching
(generic_type
  type: (type_identifier) @type.type_reference
  (#match? @type.type_reference "^Box$")
) @type.type_reference

(generic_type
  type: (type_identifier) @type.type_reference
  (#match? @type.type_reference "^Rc$")
) @type.type_reference

(generic_type
  type: (type_identifier) @type.type_reference
  (#match? @type.type_reference "^Arc$")
) @type.type_reference

; Box::new() calls (smart pointer allocation)
(call_expression
  function: (scoped_identifier
    path: (identifier) @type.module
    name: (identifier) @type.function
  )
  (#eq? @type.module "Box")
  (#eq? @type.function "new")
) @type.type_reference

; Smart pointer method calls (clone, as_ref, as_mut, etc.)
(call_expression
  function: (field_expression
    value: (_) @type.type_reference
    field: (field_identifier) @type.method
  )
  (#match? @type.method "^(clone|as_ref|as_mut|get|get_mut|borrow|borrow_mut|try_borrow|try_borrow_mut|lock|try_lock|read|write|try_read|try_write)$")
) @type.type_reference

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
    value: (_) @reference.variable
    field: (field_identifier) @reference.call
  )
)

; Chained method calls
(call_expression
  function: (field_expression
    value: (field_expression
      value: (_) @reference.variable.base
      field: (field_identifier) @reference.property.field1
    )
    field: (field_identifier) @reference.call.chained
  )
)

; Associated function calls (Type::function)
(call_expression
  function: (scoped_identifier
    path: (_) @reference.type
    name: (identifier) @reference.call
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
    value: (_) @reference.variable
    field: (field_identifier) @reference.call)
) @reference.call

; Generic function calls
(call_expression
  function: (generic_function
    function: (identifier) @reference.call.generic
  )
)

; Field access
(field_expression
  value: (_) @reference.variable
  field: (field_identifier) @reference.field
)

; Struct construction
(struct_expression
  name: (_) @reference.constructor.struct
)

; Type references
(type_identifier) @reference.type

; Self and super
(self) @reference.this
(super) @reference.super

; Assignments
(assignment_expression
  left: (identifier) @reference.variable.target
  right: (_) @reference.variable.source
)

; Compound assignments
(compound_assignment_expr
  left: (identifier) @reference.variable.target
  right: (_) @reference.variable.source
)

; Return expressions
(return_expression
  (_)? @return.variable
)


; Try operator - capture the whole expression to include "?"
(try_expression) @reference.variable

; Await expressions
(await_expression) @reference.variable

; General identifier references
(identifier) @reference.variable