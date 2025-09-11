;; Tree-sitter queries for TypeScript generic type testing
;; These queries help extract generic type parameters and references for testing

;; Extract generic type parameter declarations
(type_parameters
  (type_parameter
    name: (type_identifier) @type_param
    constraint: (type_annotation)? @constraint
    default: (type)? @default))

;; Extract generic type references in type annotations
(type_annotation
  (generic_type
    name: (type_identifier) @base_type
    type_arguments: (type_arguments
      (type_identifier) @type_arg)*))

;; Extract utility type usage
(type_annotation
  (generic_type
    name: (type_identifier) @utility_type
    type_arguments: (type_arguments) @util_args)
  (#match? @utility_type "^(Partial|Required|Pick|Omit|Record|Exclude|Extract|ReturnType|Parameters)$"))

;; Extract conditional type expressions
(conditional_type
  check: (type_identifier) @check_type
  extends: (type) @extends_type
  true: (type) @true_type
  false: (type) @false_type)

;; Extract mapped type expressions  
(mapped_type_clause
  name: (type_identifier) @mapped_param
  type: (index_type_query
    object: (type_identifier) @keyof_type))

;; Extract template literal types
(template_literal_type
  (template_substitution
    (type_identifier) @template_param)*)