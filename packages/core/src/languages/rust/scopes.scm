;; see tree-sitter-rust/src/grammar.json for an exhaustive list of productions

;; scopes
(block) @local.scope              ; { ... }
(function_item) @local.scope
(declaration_list) @local.scope   ; mod { ... }

;; impl items can define types and lifetimes:
;;
;;    impl<'a, T> Trait for Struct { .. }
;;
;; in order to constrain those to the impl block,
;; we add a local scope here:
(impl_item) @local.scope
(struct_item) @local.scope
(enum_item) @local.scope
(union_item) @local.scope
(type_item) @local.scope
(trait_item) @local.scope

;; let expressions create scopes
(if_expression
  [(let_condition)
   (let_chain)]) @local.scope

;; each match arm can bind variables with
;; patterns, without creating a block scope;
;;
;;     match _ {
;;        (a, b) => a,
;;     }
;;
;; The bindings for a, b are constrained to
;; the match arm.
(match_arm) @local.scope

;; loop labels are defs that are available only
;; within the scope they create:
;;
;;     'outer: loop {
;;         let x = 2;
;;     };
;;     let y = 2;
;; 
;; Produces a scope graph like so:
;;
;; { 
;;   defs: [ y ],
;;   scopes: [
;;     {
;;       defs: [ 'outer ],
;;       scopes: [
;;         {
;;           defs: [ x ]
;;         }
;;       ]
;;     }
;;   ]
;; }
;;
(loop_expression) @local.scope
(for_expression) @local.scope
(while_expression) @local.scope


;; defs

;; let x = ...;
(let_declaration 
  pattern: (identifier) @local.definition.variable)

;; if let x = ...;
;; while let x = ...;
(let_condition
  .
  (identifier) @local.definition.variable)

;; let (a, b, ...) = ..;
;; if let (a, b, ...) = {}
;; while let (a, b, ...) = {}
;; match _ { (a, b) => { .. } }
(tuple_pattern (identifier) @local.definition.variable)

;; Some(a)
(tuple_struct_pattern
  type: (_)
  (identifier) @local.definition.variable)

;; let S { field: a } = ..;
(struct_pattern 
  (field_pattern 
    (identifier) @local.definition.variable))

;; let S { a, b } = ..;
(struct_pattern 
  (field_pattern 
    (shorthand_field_identifier) @local.definition.variable))

;; (mut x: T)
(mut_pattern (identifier) @local.definition.variable)

;; (ref x: T)
(ref_pattern (identifier) @local.definition.variable)

;; pub const x = ...;
(const_item
  (visibility_modifier) @_pub
  (identifier) @local.definition.const.exported
  (#match? @_pub "^pub"))

;; const x = ... (private)
(const_item (identifier) @local.definition.const)

;; pub static x = ...;
(static_item
  (visibility_modifier) @_pub
  (identifier) @local.definition.const.exported
  (#match? @_pub "^pub"))

;; static x = ... (private)
(static_item (identifier) @local.definition.const)

;; fn _(x: _)
(parameters 
  (parameter 
    pattern: (identifier) @local.definition.variable))
;; fn _(self)
(parameters 
  (self_parameter
    (self) @local.definition.variable))

;; type parameters
(type_parameters
  (type_identifier) @local.definition.typedef)
(type_parameters
  (lifetime) @local.definition.lifetime)
(constrained_type_parameter
  left: (type_identifier) @local.definition.typedef)

;; |x| { ... }
;; no type
(closure_parameters (identifier) @local.definition.variable)

;; |x: T| { ... }
;; with type
(closure_parameters
  (parameter
    (identifier) @local.definition.variable))

;; pub fn x(..)
(function_item
  (visibility_modifier) @_pub
  (identifier) @hoist.definition.function.exported
  (#match? @_pub "^pub"))

;; fn x(..) (private)
(function_item (identifier) @hoist.definition.function)

;; 'outer: loop { .. }
(loop_expression
  (label) @local.definition.label)

;; `for` exprs create two defs: a label (if any) and the
;; loop variable 
(for_expression . (identifier) @local.definition.variable)
(for_expression (label) @local.definition.label)

;; 'label: while cond { .. }
(while_expression
  (label) @local.definition.label)

;; pub struct
(struct_item
  (visibility_modifier) @_pub
  (type_identifier) @hoist.definition.struct.exported
  (#match? @_pub "^pub"))

;; struct (private)
(struct_item (type_identifier) @hoist.definition.struct)

;; pub enum
(enum_item
  (visibility_modifier) @_pub
  (type_identifier) @hoist.definition.enum.exported
  (#match? @_pub "^pub"))

;; enum (private)
(enum_item (type_identifier) @hoist.definition.enum)

;; pub union
(union_item
  (visibility_modifier) @_pub
  (type_identifier) @hoist.definition.union.exported
  (#match? @_pub "^pub"))

;; union (private)
(union_item (type_identifier) @hoist.definition.union)

;; pub type
(type_item
  (visibility_modifier) @_pub
  . (type_identifier) @hoist.definition.typedef.exported
  (#match? @_pub "^pub"))

;; type (private)
(type_item . (type_identifier) @hoist.definition.typedef)

;; pub trait
(trait_item
  (visibility_modifier) @_pub
  (type_identifier) @hoist.definition.interface.exported
  (#match? @_pub "^pub"))

;; trait (private)
(trait_item (type_identifier) @hoist.definition.interface)

;; struct and union fields
(field_declaration_list
  (field_declaration 
    (field_identifier) @local.definition.field))

;; enum variants
(enum_variant_list
  (enum_variant 
    (identifier) @local.definition.enumerator))

;; pub mod x;
(mod_item
  (visibility_modifier) @_pub
  (identifier) @local.definition.module.exported
  (#match? @_pub "^pub"))

;; mod x; (private)
(mod_item (identifier) @local.definition.module)

;; use statements

;; use item;
(use_declaration
  (identifier) @local.import)

;; use path as item;
(use_as_clause
  alias: (identifier) @local.import)

;; use path::item;
(use_declaration 
  (scoped_identifier 
    name: (identifier) @local.import))

;; use module::{member1, member2, member3};
(use_list
  (identifier) @local.import)
(use_list 
  (scoped_identifier
    name: (identifier) @local.import))


;; refs

;; !x
(unary_expression (identifier) @local.reference)

;; &x
(reference_expression (identifier) @local.reference)

;; (x)
(parenthesized_expression (identifier) @local.reference)

;; x?
(try_expression (identifier) @local.reference)

;; a = b
(assignment_expression (identifier) @local.reference)

;; a op b
(binary_expression (identifier) @local.reference)

;; a op= b
(compound_assignment_expr (identifier) @local.reference)

;; a as b
(type_cast_expression (identifier) @local.reference)

;; a()
(call_expression (identifier) @local.reference)

;; Self::foo()
;;
;; `foo` can be resolved
(call_expression
  (scoped_identifier
    (identifier) @_self_type
    (identifier) @local.reference)
  (#match? @_self_type "Self"))

;; Type::method() - e.g., Rectangle::new()
;;
;; Both the type and method are references
(call_expression
  function: (scoped_identifier
    path: (identifier) @local.reference
    name: (identifier) @local.reference))

;; self.foo() 
;;
;; `foo` can be resolved
(call_expression 
  function: (field_expression
    value: (self)
    field: (field_identifier) @local.reference))

;; obj.method() - e.g., rect.area()
;;
;; method is a reference (obj is already captured by field_expression)
(call_expression
  function: (field_expression
    field: (field_identifier) @local.reference))

;; return a
(return_expression (identifier) @local.reference)

;; break a
(break_expression (identifier) @local.reference)

;; break 'label
(break_expression (label) @local.reference)

;; continue 'label;
(continue_expression (label) @local.reference)

;; yield x;
(yield_expression (identifier) @local.reference)

;; await a
(await_expression (identifier) @local.reference)

;; (a, b)
(tuple_expression (identifier) @local.reference)

;; a[]
(index_expression (identifier) @local.reference)

;; ident;
(expression_statement (identifier) @local.reference)

;; a..b
(range_expression (identifier) @local.reference)

;; [ident; N]
(array_expression (identifier) @local.reference)

;; path::to::item
;;
;; `path` is a ref
(scoped_identifier 
  path: (identifier) @local.reference)

;; rhs of let decls
(let_declaration 
  value: (identifier) @local.reference)

;; type T = [T; N]
;;
;; N is a ident ref
(array_type
  length: (identifier) @local.reference)

;; S { _ }
(struct_expression
  (type_identifier) @local.reference)

;; S { a }
(struct_expression
  (field_initializer_list
    (shorthand_field_initializer
      (identifier) @local.reference)))

;; S { a: value }
(struct_expression
  (field_initializer_list
    (field_initializer 
      (identifier) @local.reference)))

;; S { ..a }
(struct_expression
  (field_initializer_list
    (base_field_initializer 
      (identifier) @local.reference)))

;; if a {}
(if_expression (identifier) @local.reference)

;; for pattern in value {}
;;
;; `value` is a ref
(for_expression
  value: (identifier) @local.reference)

;; while a {}
(while_expression (identifier) @local.reference)

;; if let _ = a {}
;;
;; the ident following the `=` is a ref
;; the ident preceding the `=` is a def
;; while let _ = a {}
(let_condition 
  "="
  (identifier) @local.reference)


;; match a
(match_expression (identifier) @local.reference)

;; match _ {
;;     pattern => a,
;; }
;;
;; this `a` is somehow not any expression form
(match_arm (identifier) @local.reference)

;; a.b
;;
;; `a` is a ref to the object, `b` is a ref to the field
(field_expression
  value: (identifier) @local.reference
  field: (field_identifier) @local.reference)

;; { stmt; foo }
(block
  (identifier) @local.reference)

;; arguments to method calls or function calls
(arguments
  (identifier) @local.reference)

;; impl S { .. }
(impl_item (type_identifier) @local.reference)

;; where T: ...
(where_predicate
  left: (type_identifier) @local.reference)

;; trait bounds
(trait_bounds
  (type_identifier) @local.reference)
(trait_bounds
  (lifetime) @local.reference)

;; idents in macros
(token_tree
  (identifier) @local.reference)

;; types

;; (T, U)
(tuple_type
  (type_identifier) @local.reference)

;; &T
(reference_type
  (type_identifier) @local.reference)

;; &'a T
(reference_type
  (lifetime) @local.reference)

;; &'a self
(self_parameter 
  (lifetime) @local.reference)

;; *mut T
;; *const T
(pointer_type
  (type_identifier) @local.reference)

;; A<_>
(generic_type
  (type_identifier) @local.reference)

;; _<V>
(type_arguments
  (type_identifier) @local.reference)
(type_arguments
  (lifetime) @local.reference)

;; T<U = V>
;;
;; U is ignored
;; V is a ref
(type_binding
  name: (_)
  type: (type_identifier) @local.reference)

;; [T]
(array_type
  (type_identifier) @local.reference)

;; type T = U;
;;
;; T is a def
;; U is a ref
(type_item 
  name: (_)
  type: (type_identifier) @local.reference)

(function_item 
  return_type: (type_identifier) @local.reference)

;; type refs in params
;;
;; fn _(_: T)
(parameters 
  (parameter 
    type: (type_identifier) @local.reference))

;; dyn T
(dynamic_type
  (type_identifier) @local.reference)

;; <T>::call()
(bracketed_type
  (type_identifier) @local.reference)

;; T as Trait
(qualified_type
  (type_identifier) @local.reference)

;; module::T
;;
;; `module` is a def
;; `T` is a ref
(scoped_type_identifier
  path: (identifier) @local.reference)

;; struct _ { field: Type }
;; `Type` is a ref
 (field_declaration
   name: (_)
   type: (type_identifier) @local.reference)
