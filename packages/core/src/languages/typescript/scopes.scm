;; typescript, javascript, and tsx inherit the same common
;; grammar, and add onto it. this file contains additional
;; queries for typescript types and ADTs, it also revises
;; certain queries (classes, function parameters).

;; scopes

[
  (statement_block)
  (class_body)
  (arrow_function)
  (object)
  ;; anonymous function expressions create scopes, just like arrow functions
  (function_expression)
  (function_declaration)
  (generator_function_declaration)
  (for_statement)
  (for_in_statement)
  (switch_case)
  (catch_clause)
  ;; assignments are permitted inside sequence exprs:
  ;;
  ;;     const a = 2;
  ;;     throw f = 1, f, a;
  ;; 
  ;; should produce:
  ;;
  ;;     {
  ;;       defs: [ a ],
  ;;       scopes [{
  ;;          defs: [ f ],
  ;;          refs: [ f, a ]
  ;;       }],
  ;;     }
  (sequence_expression)

  ;; type signatures in properties may contain parameter
  ;; definitions, which can never have references. this
  ;; scope "seals" off this definitions.
  ;;
  ;;     type S = {
  ;;        getter: (f: string) => string;
  ;;     }
  ;;
  ;; should produce one top-level definition: `S`. without
  ;; sealing the property signature, it also produces `f`
  ;; as a top-level definition.
  (property_signature)
] @local.scope



;; defs

;; tree-sitter-javascript has 5 "declaration" kinds:
;;
;; - class
;; - function
;; - generator function
;; - lexical
;; - variable

;; function x()
(function_declaration
  (identifier) @hoist.definition.function)

;; export function x()
(export_statement
  (function_declaration
    (identifier) @hoist.definition.function.exported))

(generator_function_declaration
  (identifier) @hoist.definition.generator)

;; export function* x()
(export_statement
  (generator_function_declaration
    (identifier) @hoist.definition.generator.exported))

;; function params
(formal_parameters
  (required_parameter
    (identifier) @local.definition.parameter))
(formal_parameters
  (optional_parameter
    (identifier) @local.definition.parameter))

;; patterns

;; f(a, ...b)
(rest_pattern
  (identifier) @local.definition.variable)

;; f(a, y = f)
;;
;; the lhs is a def, the rhs is a ref
(assignment_pattern
  (identifier) @local.definition.variable
  (identifier) @local.reference)

;; for ([a, b] in thing)
;;
;; `a` & `b` are defs
(array_pattern
  (identifier) @local.definition.variable)

;; let {a, b} = obj;
(object_pattern
  (shorthand_property_identifier_pattern) @local.definition.variable)

;; var x = _
(variable_declaration
  (variable_declarator . (identifier) @local.definition.variable))

;; const x = _
(lexical_declaration
  "const"
  (variable_declarator . (identifier) @local.definition.constant))

;; export const x = _
(export_statement
  (lexical_declaration
    "const"
    (variable_declarator . (identifier) @local.definition.constant.exported)))

;; let x = _
(lexical_declaration
  "let"
  (variable_declarator . (identifier) @local.definition.variable))

;; export let x = _
(export_statement
  (lexical_declaration
    "let"
    (variable_declarator . (identifier) @local.definition.variable.exported)))

;; capture the value in variable declarations: const x = VALUE
(variable_declarator
  value: (identifier) @local.reference)

;; a = b
(assignment_expression
  .
  (identifier) @local.definition.variable)

;; method def
;;
;; TODO: support getters and setters here, blocked on:
;; https://github.com/tree-sitter/tree-sitter/issues/1461
;; Methods are hoisted so they can be accessed from outside the class
(method_definition
  (property_identifier) @hoist.definition.method)

;; private method def
(method_definition
  (private_property_identifier) @hoist.definition.method)

;; class
(class_declaration
  (type_identifier) @local.definition.class)

;; export class
(export_statement
  (class_declaration
    (type_identifier) @local.definition.class.exported))

;; arrow func
(arrow_function
  (identifier) @local.definition.variable)


;; imports

;; import defaultMember from "module";
(import_statement
  (import_clause (identifier) @local.import))

;; import { member } from "module";
;; import { member as alias } from "module";
(import_statement
  (import_clause
    (named_imports
      [(import_specifier !alias (identifier) @local.import)
       (import_specifier alias: (identifier) @local.import)])))

;; for (item in list)
;;
;; `item` is a def
(for_in_statement 
  left: (identifier) @local.definition.variable)

;; labels
(labeled_statement
  (statement_identifier) @local.definition.label)

;; type T
(type_alias_declaration
  name:
  (type_identifier) @local.definition.alias)

;; type parameters in generic
;; functions or interfaces
(type_parameters
  (type_parameter
    (type_identifier) @local.definition))

;; enum T
(enum_declaration
  (identifier) @local.definition.enum)

;; enumerators
;;
;; enum Direction {
;;     L           // property_identifier
;;     D = "Down"  // enum_assignment
;; }
(enum_body
  (property_identifier) @local.definition.enumerator)
(enum_body
  (enum_assignment
    (property_identifier) @local.definition.enumerator))

;; abstract class T
(abstract_class_declaration
  (type_identifier) @local.definition.class)

;; class _ {
;;    t: T
;; }
(public_field_definition
  (property_identifier) @local.definition.property)

;; class {
;;    abstract f(T): U;
;; }
(abstract_method_signature
  (property_identifier) @local.definition.property)

;; interface T
(interface_declaration
  (type_identifier) @local.definition.interface)

;; catch clauses
(catch_clause
  (identifier) @local.definition.variable)


;; refs

;; someVar;
(expression_statement (identifier) @local.reference)

;; { "a": value }
(object
  (pair
    (identifier) @local.reference))

;; y = {a, b}
(object
  (shorthand_property_identifier) @local.reference)


;; [ a, b, c ]
(array
  (identifier) @local.reference)

;; new Object()
(new_expression
  (identifier) @local.reference)

;; return x;
(return_statement 
  (identifier) @local.reference)

;; yield t;
(yield_expression
  (identifier) @local.reference)

;; call expression
(call_expression
  (identifier) @local.reference)
  
;; method call expression: this.method() or obj.method()
;; We need to exclude super.method() calls since they reference parent class methods
(call_expression
  (member_expression
    object: [(this) (identifier)]
    property: (property_identifier) @local.reference.method))

;; private method call expression: this.#privateMethod() or obj.#privateMethod()
(call_expression
  (member_expression
    object: [(this) (identifier)]
    property: (private_property_identifier) @local.reference.method))

;; call arguments
(arguments
  (identifier) @local.reference)

;; type arguments
(type_arguments
  (type_identifier) @local.reference)

;; index expression
(subscript_expression
  (identifier) @local.reference)

;; member expression: a.b (only capture the object, not the property)
(member_expression
  object: (identifier) @local.reference)

;; property access in assignment: obj.prop = value (capture the property)
(assignment_expression
  left: (member_expression
    object: (this)
    property: (property_identifier) @local.reference))

;; property access in assignment: obj.prop = value (capture the property)
(assignment_expression
  left: (member_expression
    object: (identifier)
    property: (property_identifier) @local.reference))

;; property access in return: return obj.prop (capture the property)
(return_statement
  (member_expression
    object: (this)
    property: (property_identifier) @local.reference))

;; property access in return: return obj.prop (capture the property)
(return_statement
  (member_expression
    object: (identifier)
    property: (property_identifier) @local.reference))

;; nested identifier: <React.StrictMode>
;;
;; `React` is a ref
;; `StrictMode` is ignored
(nested_identifier
  .
  (identifier) @local.reference)

;; await ident;
(await_expression 
  (identifier) @local.reference)

;; a + b
(binary_expression
  (identifier) @local.reference)

;; -x
(unary_expression
  (identifier) @local.reference)

;; x++
(update_expression
  (identifier) @local.reference)

;; a += b
(augmented_assignment_expression
  (identifier) @local.reference)

;; (a)
(parenthesized_expression
  (identifier) @local.reference)

;; tuples
(sequence_expression
  (identifier) @local.reference)

;; c? a : b
(ternary_expression
  (identifier) @local.reference)

;; {...object}
(spread_element
  (identifier) @local.reference)

;; exports are refs
;;
;; export { name, name };
;; export { name as alias };
(export_statement
  (export_clause
    (export_specifier name: (identifier) @local.reference.exported)))

;; CommonJS exports: module.exports = { func1, func2 }
(assignment_expression
  left: (member_expression
    object: (identifier) @_module
    property: (property_identifier) @_exports)
  right: (object
    (shorthand_property_identifier) @local.reference.exported)
  (#eq? @_module "module")
  (#eq? @_exports "exports"))

;; CommonJS exports: module.exports = { key: value }
(assignment_expression
  left: (member_expression
    object: (identifier) @_module
    property: (property_identifier) @_exports)
  right: (object
    (pair
      key: (property_identifier) @local.reference.exported))
  (#eq? @_module "module")
  (#eq? @_exports "exports"))

;; CommonJS exports: exports.name = ...
(assignment_expression
  left: (member_expression
    object: (identifier) @_exports
    property: (property_identifier) @local.reference.exported)
  (#eq? @_exports "exports"))

;; export default ident;
(export_statement
  (identifier) @local.reference)

;; for (item in list)
;;
;; `list` is a def
(for_in_statement 
  right: (identifier) @local.reference)

;; break f;
(break_statement (statement_identifier) @local.reference)

;; continue f;
(continue_statement (statement_identifier) @local.reference)

;; jsx
;; (jsx_expression
;;   (identifier) @local.reference)
;; 
;; (jsx_opening_element
;;   (identifier) @local.reference)
;; 
;; (jsx_closing_element
;;   (identifier) @local.reference)
;; 
;; (jsx_self_closing_element
;;   (identifier) @local.reference)


;; type refs

;; type _ = T
(type_alias_declaration
  value:
  (type_identifier) @local.reference)

;; (T)
(parenthesized_type
  (type_identifier) @local.reference)

;; T[]
(array_type
  (type_identifier) @local.reference)

;; A extends B ? C : D
(conditional_type
  (type_identifier) @local.reference)

;; ?T
(flow_maybe_type
  (type_identifier) @local.reference)

;; T<_>
(generic_type
  (type_identifier) @local.reference)

;; T & U
(intersection_type
  (type_identifier) @local.reference)

;; T | U
(union_type
  (type_identifier) @local.reference)

;; (T, U) => V
(function_type
  (type_identifier) @local.reference)

;; keyof T
(index_type_query
  (type_identifier) @local.reference)

;; val as T
(as_expression
  (identifier) @local.reference
  (type_identifier) @local.reference)

;; let t: T = foo();
;; {t: T, u: U}
(type_annotation
  (type_identifier) @local.reference)

;; [T, U]
(tuple_type
  (type_identifier) @local.reference)

;; T[U]
(lookup_type
  (type_identifier) @local.reference)

;; T.U
;;
;; `T` is ref
;; `U` is ignored
(nested_type_identifier
  .
  (identifier) @local.reference)

;; t is T
(type_predicate_annotation
  (type_predicate
    (identifier) @local.reference
    (type_identifier) @local.reference))

;; jsx
(jsx_expression
  (identifier) @local.reference)

(jsx_opening_element
  (identifier) @local.reference)

(jsx_closing_element
  (identifier) @local.reference)

(jsx_self_closing_element
  (identifier) @local.reference)