;; Tree-sitter queries for Python generic type testing
;; These queries help extract generic type parameters and references for testing

;; Extract TypeVar declarations
(assignment
  left: (identifier) @typevar_name
  right: (call
    function: (attribute
      object: (identifier) @typing_module
      attribute: (identifier) @typevar_call)
    arguments: (argument_list
      (string) @typevar_string
      (identifier)* @constraints
      (keyword_argument
        name: (identifier) @bound_key
        value: (identifier) @bound_type)?
      (keyword_argument
        name: (identifier) @covariant_key
        value: (true|false) @covariant_value)?))
  (#eq? @typevar_call "TypeVar"))

;; Extract Generic base class usage
(class_definition
  name: (identifier) @class_name
  superclasses: (argument_list
    (subscript
      value: (attribute
        object: (identifier) @typing_module
        attribute: (identifier) @generic_class)
      slice: (slice
        (identifier) @type_param)*)?
    (identifier)* @other_bases)
  (#eq? @generic_class "Generic"))

;; Extract generic type annotations with square brackets
(type_annotation
  (subscript
    value: (identifier) @base_type
    slice: (slice
      (identifier) @type_arg)*))

;; Extract Optional type usage
(subscript
  value: (attribute
    object: (identifier) @typing_module
    attribute: (identifier) @optional_type)
  slice: (slice
    (identifier) @optional_arg)
  (#eq? @optional_type "Optional"))

;; Extract Union type usage  
(subscript
  value: (attribute
    object: (identifier) @typing_module
    attribute: (identifier) @union_type)
  slice: (slice
    (identifier) @union_arg)*
  (#eq? @union_type "Union"))

;; Extract Protocol usage
(subscript
  value: (attribute
    object: (identifier) @typing_module
    attribute: (identifier) @protocol_type)
  slice: (slice
    (identifier) @protocol_arg)*
  (#eq? @protocol_type "Protocol"))

;; Extract TypedDict usage
(subscript
  value: (attribute
    object: (identifier) @typing_module
    attribute: (identifier) @typeddict_type)
  slice: (slice
    (identifier) @typeddict_arg)*
  (#eq? @typeddict_type "TypedDict"))