;; Tree-sitter queries for Rust generic type testing
;; These queries help extract generic type parameters and references for testing

;; Extract generic type parameter declarations
(type_parameters
  (type_parameter
    name: (type_identifier) @type_param
    bound: (trait_bounds
      (type_identifier) @trait_bound)*)?
  (lifetime_parameter
    (lifetime) @lifetime_param
    bound: (lifetime_bounds
      (lifetime) @lifetime_bound)*)?
  (const_parameter
    name: (identifier) @const_param
    type: (type_identifier) @const_type)?)

;; Extract generic type references
(generic_type
  type: (type_identifier) @base_type
  type_arguments: (type_arguments
    (type_identifier) @type_arg
    (lifetime) @lifetime_arg)*))

;; Extract associated type references
(qualified_type
  type: (type_identifier) @qualified_base
  name: (type_identifier) @associated_type)

;; Extract impl trait types
(impl_trait_type
  (trait_bounds
    (type_identifier) @impl_trait)*))

;; Extract dyn trait types  
(trait_object
  (trait_bounds
    (type_identifier) @dyn_trait
    (lifetime) @dyn_lifetime)*))

;; Extract reference types with lifetimes
(reference_type
  lifetime: (lifetime)? @ref_lifetime
  mutable: "mut"? @mutability
  type: (type_identifier) @ref_type)

;; Extract tuple types
(tuple_type
  (type_identifier) @tuple_element*)

;; Extract lifetime parameters in function signatures
(function_item
  parameters: (parameters
    (parameter
      pattern: (identifier) @param_name
      type: (reference_type
        lifetime: (lifetime) @param_lifetime
        type: (type_identifier) @param_type))))

;; Extract where clauses
(where_clause
  (where_predicate
    left: (type_identifier) @where_type
    bounds: (trait_bounds
      (type_identifier) @where_bound)*))

;; Extract trait bound syntax (T: Trait)
(bounded_type
  name: (type_identifier) @bounded_name
  bounds: (trait_bounds
    (type_identifier) @bound_trait)*))

;; Extract lifetime bounds (T: 'a)
(bounded_type
  name: (type_identifier) @lifetime_bounded_name
  bounds: (lifetime_bounds
    (lifetime) @lifetime_bound)*)