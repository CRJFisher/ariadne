;; ==============================================================================
;; SEMANTIC INDEX - Rust Language Support
;; ==============================================================================
;; Captures semantic information for Rust using verified node types
;;
;; IMPORTANT PATTERN NOTES:
;; 1. Most identifiers are DIRECT CHILDREN, not named fields
;;    ✓ Correct: (parameter (identifier) @definition.parameter)
;;    ✗ Wrong:   (parameter pattern: (identifier) @definition.parameter)
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
  type: (_)
)

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
)

; Trait definitions (general) - captured as interfaces
(trait_item
  name: (type_identifier) @definition.interface
)

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
      (identifier) @definition.method
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
      name: (type_identifier) @definition.type_alias
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

; Assignment references with type annotations (for type tracking)
(let_declaration
  pattern: (identifier) @assignment.variable
  type: (_)
  value: (_)?
)

; Assignment references with struct literals (for constructor type tracking)
(let_declaration
  pattern: (identifier) @assignment.variable
  value: (struct_expression)
)

; Function parameters - direct identifier child (not pattern field)
(parameter
  (identifier) @definition.parameter
)

; Self parameters - capture the whole node
(self_parameter) @definition.parameter.self

; Closure expressions (named, assigned to variables)
(closure_expression) @definition.function.closure

; === Anonymous closures (inline callbacks in iterators, etc.) ===
; Note: In Rust, most closures are anonymous. The above pattern catches ALL closures.
; For consistency with other languages, we also tag inline closures as anonymous_function
; when they appear in common callback contexts.

; Closures in method call arguments (map, filter, etc.)
(arguments
  (closure_expression) @definition.anonymous_function
)

; Closure parameters - simple identifiers
(closure_expression
  parameters: (closure_parameters
    (identifier) @definition.parameter
  )
)

; Closure parameters with type annotations
(closure_expression
  parameters: (closure_parameters
    (parameter
      (identifier) @definition.parameter
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
  body: (declaration_list)
)

; Module declarations without body (external file)
; These reference modules in other files, so don't need body scopes
(mod_item
  name: (identifier) @definition.module
  !body
)

; Public module definitions with body
(mod_item
  (visibility_modifier)
  name: (identifier) @export.module
  body: (declaration_list)
)

; Public module declarations without body (external file)
(mod_item
  (visibility_modifier)
  name: (identifier) @export.module
  !body
)


;; ==============================================================================
;; GENERICS AND LIFETIMES
;; ==============================================================================

; Type parameters (simple)
(type_parameters
  (type_identifier) @definition.type_parameter
)

; Constrained type parameters (e.g., T: Clone)
(constrained_type_parameter
  left: (type_identifier) @definition.type_parameter
)

; Const parameters
(const_parameter
  name: (identifier) @definition.parameter
)

;; ==============================================================================
;; FUNCTION TYPES AND HIGHER-ORDER PATTERNS
;; ==============================================================================

; (No special patterns needed - method calls are handled in REFERENCES AND CALLS section)

;; ==============================================================================
;; IMPORTS
;; ==============================================================================

; Simple use declarations - capture complete node
(use_declaration) @definition.import

; Extern crate declarations - capture complete node
(extern_crate_declaration) @definition.import

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
  (super)
)

; Path visibility - pub(in path::to::module)
(visibility_modifier
  "in"
  (scoped_identifier)
)

; Self visibility - pub(self) (equivalent to private)
(visibility_modifier
  (self)
)

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

; Public constants (exported variables)
(const_item
  (visibility_modifier)
  name: (identifier) @export.variable
)

; Public statics (exported variables)
(static_item
  (visibility_modifier)
  name: (identifier) @export.variable
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

; Re-exports (pub use)
(use_declaration
  (visibility_modifier)
) @import.reexport

;; ==============================================================================
;; MACROS
;; ==============================================================================

; Macro definitions (declarative)
(macro_definition
  name: (identifier) @definition.macro
)

; Macro invocations
(macro_invocation
  macro: (identifier) @reference.macro
)

; Scoped macro invocations
(macro_invocation
  macro: (scoped_identifier
    name: (identifier) @reference.macro
  )
)

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

; Reference expressions (borrow)
(reference_expression
  value: (_) @reference.variable.borrowed
)

; Mutable reference expressions (mutable borrow)
(reference_expression
  (mutable_specifier)
  value: (_) @reference.variable.borrowed
)

; Dereference expressions
(unary_expression
  (_) @reference.variable
)

;; ==============================================================================
;; REFERENCES AND CALLS
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @reference.call
)

; Method calls (field_expression based)
(call_expression
  function: (field_expression) @reference.call
)

; Associated function calls (Type::function)
(call_expression
  function: (scoped_identifier) @reference.call
)

; Generic function calls
(call_expression
  function: (generic_function
    function: (identifier) @reference.call
  )
)

; Field access
(field_expression
  value: (identifier) @reference.variable.base
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