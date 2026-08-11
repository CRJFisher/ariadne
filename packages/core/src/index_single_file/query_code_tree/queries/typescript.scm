;; ==============================================================================
;; SEMANTIC INDEX - TypeScript with Comprehensive Type System Support
;; ==============================================================================
;; Extends JavaScript patterns with TypeScript-specific constructs:
;; - Interfaces, type aliases, enums, namespaces
;; - Generic type parameters and constraints
;; - Type annotations and assertions
;; - Access modifiers and decorators
;; - TypeScript-specific imports/exports
;; ==============================================================================

;; ==============================================================================
;; SCOPES - Define lexical boundaries (JavaScript + TypeScript)
;; ==============================================================================

; Root scope
(program) @scope.module

; Function scopes
(function_declaration) @scope.function
(function_expression) @scope.function
(arrow_function) @scope.function
(generator_function_declaration) @scope.function
(generator_function) @scope.function

; Class scopes
(class_declaration
  body: (class_body) @scope.class
)
(abstract_class_declaration
  body: (class_body) @scope.class
)
(class
  body: (class_body) @scope.class
)

; TypeScript-specific scopes
(interface_declaration
  body: (interface_body) @scope.interface
)
(enum_declaration
  body: (enum_body) @scope.enum
)
(internal_module) @scope.namespace

; Block scopes
; Only capture standalone blocks (if/for/while/try/catch/etc.)
(for_statement) @scope.block
(for_in_statement) @scope.block
(while_statement) @scope.block
(do_statement) @scope.block
(if_statement) @scope.block
(switch_statement) @scope.block
(switch_case) @scope.block
(try_statement) @scope.block
(catch_clause) @scope.block
(finally_clause) @scope.block

;; ==============================================================================
;; TYPESCRIPT TYPE DEFINITIONS
;; ==============================================================================

; Interface definitions
(interface_declaration
  name: (type_identifier) @definition.interface
)

; Interface method signatures
(interface_declaration
  (interface_body
    (method_signature
      name: (property_identifier) @definition.interface.method
    ) @scope.method
  )
)

; Interface property signatures
(interface_declaration
  (interface_body
    (property_signature
      name: (property_identifier) @definition.interface.property
    )
  )
)

; Type alias definitions
(type_alias_declaration
  name: (type_identifier) @definition.type_alias
)

; Enum definitions
(enum_declaration
  name: (identifier) @definition.enum
)

; Enum members
(enum_body
  (property_identifier) @definition.enum.member
)

(enum_body
  (enum_assignment
    name: (property_identifier) @definition.enum.member
  )
)

; Namespace definitions
(internal_module
  name: (identifier) @definition.namespace
)

; Type parameter definitions
(type_parameter
  (type_identifier) @definition.type_parameter
)

;; ==============================================================================
;; TYPE ANNOTATIONS AND GENERICS
;; ==============================================================================

; Note: Type parameters and return type annotations are extracted by builders
; from the complete node captures. We don't capture them separately to avoid fragments.

; Variable declarations - simple pattern that matches all variable names
; This ensures variables are captured even when they have type annotations
; The more specific patterns below (with value assignments) will also match
(variable_declarator
  name: (identifier) @definition.variable
)

; Documentation comments (JSDoc block comments and line comments)
(comment) @definition.documentation

;; ==============================================================================
;; ACCESS MODIFIERS AND DECORATORS
;; ==============================================================================

; Access modifiers on methods
(method_definition
  (accessibility_modifier) @modifier.access_modifier
  name: (property_identifier) @definition.method
)

; Access modifiers on fields
(public_field_definition
  (accessibility_modifier) @modifier.access_modifier
  name: (property_identifier) @definition.field
)

; Readonly modifier
(public_field_definition
  "readonly" @modifier.readonly_modifier
  name: (property_identifier) @definition.field
)

; Static modifier
(method_definition
  "static" @modifier.visibility
  name: (property_identifier) @definition.method
)

(public_field_definition
  "static" @modifier.visibility
  name: (property_identifier) @definition.field
)

; Constructor parameter properties (with access modifiers)
; These create both a parameter AND an implicit class property
(required_parameter
  (accessibility_modifier)
  pattern: (identifier) @definition.parameter @definition.field
)

; Constructor parameter properties (readonly)
; These create both a parameter AND an implicit class property
(required_parameter
  "readonly"
  pattern: (identifier) @definition.parameter @definition.field
)

; Optional constructor parameter properties — same dual-capture as the required
; variants above. Split into an accessibility-modifier rule and a readonly rule
; because a single pattern cannot OR the two child constraints; a
; `private readonly x?` param matches both, but the duplicate @definition.field
; (and @definition.parameter.optional) captures collapse downstream via the
; location-keyed symbol_id, so exactly one property and one parameter result.
(optional_parameter
  (accessibility_modifier)
  pattern: (identifier) @definition.parameter.optional @definition.field
)

(optional_parameter
  "readonly"
  pattern: (identifier) @definition.parameter.optional @definition.field
)

; Class decorators (decorator first, then target)
(class_declaration
  (decorator
    (identifier) @decorator.class
  )
  name: (type_identifier)
)

(class_declaration
  (decorator
    (call_expression
      function: (identifier) @decorator.class
    )
  )
  name: (type_identifier)
)

(abstract_class_declaration
  (decorator
    (identifier) @decorator.class
  )
  name: (type_identifier)
)

(abstract_class_declaration
  (decorator
    (call_expression
      function: (identifier) @decorator.class
    )
  )
  name: (type_identifier)
)

; Method decorators (decorator is sibling in class_body, not child of method)
(class_body
  (decorator
    (identifier) @decorator.method
  )
  .
  (method_definition)
)

(class_body
  (decorator
    (call_expression
      function: (identifier) @decorator.method
    )
  )
  .
  (method_definition)
)

; Property decorators
(public_field_definition
  (decorator
    (identifier) @decorator.property
  )
  name: (property_identifier)
)

(public_field_definition
  (decorator
    (call_expression
      function: (identifier) @decorator.property
    )
  )
  name: (property_identifier)
)

;; ==============================================================================
;; DEFINITIONS - Symbols that introduce new names (JavaScript base + TypeScript)
;; ==============================================================================

; Function definitions
(function_declaration
  name: (identifier) @definition.function
)

(function_expression
  name: (identifier) @definition.function
)

; Arrow functions assigned to variables
; Arrow functions assigned to variables (captures both assignment and function definition)
(variable_declarator
  name: (identifier) @definition.function @assignment.variable
  value: (arrow_function)
) @assignment.variable

; Function expressions assigned to variables — registers the outer var name as a
; function in the enclosing scope. The inner name of a named function expression
; is captured separately above and stays scoped to the function body.
(variable_declarator
  name: (identifier) @definition.function @assignment.variable
  value: (function_expression)
) @assignment.variable

; === Anonymous arrow functions (inline callbacks, config objects, etc.) ===

; Inline arrow functions in call expression arguments (forEach, map, filter, etc.)
(call_expression
  arguments: (arguments
    (arrow_function) @definition.anonymous_function
  )
)

; Arrow functions in object properties (config objects)
(pair
  value: (arrow_function) @definition.anonymous_function
)

; Arrow functions in array literals
(array
  (arrow_function) @definition.anonymous_function
)

; IIFEs (Immediately Invoked Function Expressions)
(call_expression
  function: (parenthesized_expression
    (arrow_function) @definition.anonymous_function
  )
)

; Traditional function expressions in call arguments
(call_expression
  arguments: (arguments
    (function_expression) @definition.anonymous_function
  )
)

; Traditional function expressions in object properties
(pair
  value: (function_expression) @definition.anonymous_function
)

; Variable declarations with assignments (tracking only — definition created by generic pattern above)
(variable_declarator
  name: (identifier) @assignment.variable
  value: (_) @assignment.variable
) @assignment.variable

; Prototype-style method assignment: Counter.prototype.method = function () {}
; (the simple `app.method = fn` form is captured by the member-access @assignment.property below)
(assignment_expression
  left: (member_expression
    object: (member_expression)
    property: (property_identifier)
  )
) @assignment.property

; Variable declarations with namespace-qualified constructor calls
(variable_declarator
  name: (identifier) @assignment.variable
  value: (new_expression
    constructor: (member_expression) @assignment.constructor.qualified
  )
) @assignment.constructor.qualified

; Destructuring
(variable_declarator
  name: (object_pattern) @definition.variable
)

(variable_declarator
  name: (array_pattern) @definition.variable
)

; Class definitions with inheritance and implements
(class_declaration
  name: (type_identifier) @definition.class
  (class_heritage
    (extends_clause
      (identifier) @reference.type_reference
    )?
    (implements_clause
      (type_identifier) @reference.type_reference
    )*
  )?
)

(abstract_class_declaration
  name: (type_identifier) @definition.class
  (class_heritage
    (extends_clause
      (identifier) @reference.type_reference
    )?
    (implements_clause
      (type_identifier) @reference.type_reference
    )*
  )?
)

; Method definitions (capture static and accessibility modifiers)
(method_definition
  (accessibility_modifier)? @modifier.access_modifier
  "static"? @modifier.visibility
  name: (property_identifier) @definition.method
  (#not-eq? @definition.method "constructor")
) @scope.method

(method_definition
  name: (private_property_identifier) @definition.method
) @scope.method

; Computed-key method definitions: [Symbol.iterator]() { ... }
; Indexed as a callable node (the whole key text, e.g. `[Symbol.iterator]`, is the
; name) so the method body is a scope and any calls it makes are captured.
(method_definition
  name: (computed_property_name) @definition.method
) @scope.method

; Abstract method signatures in classes (not interfaces)
; These are abstract methods declared in abstract classes
; Try both method_signature and abstract_method_signature
(abstract_class_declaration
  body: (class_body
    (abstract_method_signature
      name: (property_identifier) @definition.method
    )
  )
)

; Also handle regular class_declaration that might have abstract methods
(class_declaration
  body: (class_body
    (abstract_method_signature
      name: (property_identifier) @definition.method
    )
  )
)

; Constructor
(method_definition
  name: (property_identifier) @definition.constructor
  (#eq? @definition.constructor "constructor")
) @scope.constructor

; Field definitions
(public_field_definition
  (accessibility_modifier)? @modifier.access_modifier
  "static"? @modifier.visibility
  "readonly"? @modifier.readonly_modifier
  name: (property_identifier) @definition.field
)

(public_field_definition
  name: (private_property_identifier) @definition.field
)

; Parameters - Apply to ALL callables (functions, methods, interface method signatures)
; These patterns are not scoped to specific parent nodes, so they match parameters
; in all callable contexts including interface method signatures.
;
; AST Structure (verified with tree-sitter):
;   required_parameter
;     ├── [pattern] identifier (captured here)
;     └── [type] type_annotation ": T"
;
;   optional_parameter
;     ├── [pattern] identifier (captured here)
;     ├── ? "?"
;     └── [type] type_annotation ": T"
;
;   required_parameter (rest parameter)
;     ├── [pattern] rest_pattern
;     │   ├── ... "..."
;     │   └── identifier (captured here - NO FIELD NAME!)
;     └── [type] type_annotation ": T[]"
;
; Required parameters
(required_parameter
  pattern: (identifier) @definition.parameter
)

; Optional parameters (contain ? token)
(optional_parameter
  pattern: (identifier) @definition.parameter.optional
)

; Rest parameters (...args)
; Note: rest_pattern does NOT have a field name for the identifier child
(rest_pattern
  (identifier) @definition.parameter
)

; Catch clause parameter
(catch_clause
  parameter: (identifier) @definition.parameter
)

; Loop variables
(for_in_statement
  left: (_
    (identifier) @definition.variable
  )
)

;; ==============================================================================
;; TYPESCRIPT IMPORTS/EXPORTS
;; ==============================================================================

; Interface exports
(export_statement
  declaration: (interface_declaration
    name: (type_identifier) @export.interface
  )
)

; Type alias exports
(export_statement
  (type_alias_declaration
    name: (type_identifier) @export.type_alias
  )
)

; Enum exports
(export_statement
  (enum_declaration
    name: (identifier) @export.enum
  )
)

;; ==============================================================================
;; IMPORTS - Standard JavaScript imports
;; ==============================================================================

; Named imports - captures both simple and aliased imports
; For simple imports (no alias): captures the name
; For aliased imports: captures the alias, handler extracts original name
(import_specifier
  alias: (identifier) @definition.import
)

(import_specifier
  name: (identifier) @definition.import
  !alias
)

; Default imports
(import_clause
  (identifier) @definition.import
)

; Namespace imports
(namespace_import
  (identifier) @definition.import
)

;; ==============================================================================
;; RE-EXPORTS - Import definitions that forward exports
;; ==============================================================================
;; Re-exports create ImportDefinitions (for chain resolution) but do NOT create
;; local bindings in scope_to_definitions.

; Re-export patterns: export { foo } from 'module'
; Capture complete export_statement, handler extracts details
(export_statement
  (export_clause
    (export_specifier)
  )
  source: (string)
) @import.reexport

; export * from 'module' — forwards the module's whole export surface under no
; name of its own. The bare "*" is a direct child of export_statement; the
; `export * as ns` form nests its star inside (namespace_export), so the two
; patterns are disjoint.
(export_statement
  "*"
  source: (string)
) @import.reexport.wildcard

; export * as ns from 'module' — a single named namespace object, not a
; wildcard surface. Capturing the identifier keeps the symbol on the bound name.
(export_statement
  (namespace_export (identifier) @import.reexport.namespace)
  source: (string)
)

;; ==============================================================================
;; EXPORTS - Standard JavaScript exports
;; ==============================================================================

; Named exports
(export_specifier
  name: (identifier) @export.variable
)

; Default exports
(export_statement
  (identifier) @export.variable
)

; Export declarations
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @export.variable
    )
  )
)

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @export.variable
    )
  )
)

; Export function declarations
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function
  )
)

; Export class declarations
(export_statement
  declaration: (class_declaration
    name: (type_identifier) @export.class
  )
)

(export_statement
  declaration: (abstract_class_declaration
    name: (type_identifier) @export.class
  )
)

; NOTE: Re-exports (export { foo } from 'module') are now handled by the
; RE-EXPORTS section above as import definitions with export metadata.
; They are NOT handled here to avoid duplicates.

;; ==============================================================================
;; REFERENCES with Enhanced Context (JavaScript + TypeScript)
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @reference.call
)

; Generic function calls (TypeScript)
(call_expression
  function: (identifier) @reference.call.generic
  type_arguments: (type_arguments)
) @reference.call.generic

; Method calls with receiver tracking
; Complete capture - extractor derives method name, receiver, property chain
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (property_identifier)
  )
) @reference.call

; Private method calls: this.#method()
; Private members use `private_property_identifier` rather than `property_identifier`,
; so the receiver-tracking rule above misses them. The extractor derives `#method`
; and the `this` self-reference identically for both property node types.
(call_expression
  function: (member_expression
    object: (_) @reference.variable
    property: (private_property_identifier)
  )
) @reference.call

; Constructor calls
(new_expression
  constructor: (identifier) @reference.constructor
)

; Constructor calls with type arguments (TypeScript)
(new_expression
  constructor: (identifier) @reference.constructor.generic
  type_arguments: (type_arguments)
)

; Namespace-qualified constructor calls: new models.User(name)
(new_expression
  constructor: (member_expression) @reference.constructor.qualified
)

; Property access — any receiver shape (obj.x, this.x, a.b.c, getX().y), one
; capture per member_expression node
(member_expression
  object: (_)
  property: (property_identifier)
) @reference.member_access

; Base object and property name of an identifier-receiver member read. The base
; stays pinned to an identifier — a wider base would mint a variable reference
; whose name is a whole sub-expression — and the property-name read feeds
; indirect reachability for methods read as values.
(member_expression
  object: (identifier) @reference.variable.base
  property: (property_identifier) @reference.property
)

; Computed member access (bracket notation)
(subscript_expression
  object: (identifier) @reference.variable
  index: (_) @reference.property.computed
) @reference.member_access.computed

; Type references (TypeScript)
(type_identifier) @reference.type

(generic_type
  name: (type_identifier) @reference.type.generic
  type_arguments: (type_arguments)
)

; Assignments (capture both sides)
(assignment_expression
  left: (identifier) @reference.variable.target
  right: (_) @reference.variable.source
) @assignment.variable

; A write to a member invokes the setter, never the getter, so the target
; carries no member read — the general member pattern above is suppressed at
; write positions by the same rule.
(assignment_expression
  left: (member_expression
    object: (identifier) @reference.variable.object
    property: (property_identifier) @reference.property.assign
  )
  right: (_) @reference.variable.source
) @assignment.property

; Return statements
(return_statement
  (_) @return.variable
) @return.function

; Update expressions
(update_expression
  argument: (identifier) @reference.variable.update
)

; JSX component usages are captured only for `.tsx`, which is parsed with the tsx
; grammar; the JSX patterns live in query_loader's JSX_COMPONENT_CAPTURES and are
; appended there. This file stays JSX-free so it compiles against the typescript
; grammar used for `.ts`, where an angle-bracket `<T>x` is a type assertion, not
; a JSX element.

; this references (important for method context)
(this) @reference.this

; super references (for inheritance)
(super) @reference.super

; Type assertions (TypeScript - only 'as' expressions, angle brackets parse as JSX)
(as_expression) @type.type_assertion

; Typeof queries (TypeScript)
(type_query
  (identifier) @reference.typeof
) @reference.typeof

; Field-initializer member read: narrowed to this/super so external-object fields
; aren't double-captured (the property_access pattern already handles those).
(public_field_definition
  value: (member_expression
    object: [(this) (super)]
    property: (property_identifier) @reference.variable
  )
)

; Shorthand object property ({ fn }): the catch-all (identifier) fires only on the
; definition-site node, so this supplies the use-site read.
(object
  (shorthand_property_identifier) @reference.variable
)

; Value-position callables — a function handed to a framework by name is never
; invoked at a syntactic call site, so this read is the only evidence it is
; reachable. Bare identifier arguments are covered by the catch-all identifier
; read plus indirect reachability; the member form, the object-literal value,
; and a named function expression's own name need their own capture.
(arguments
  (member_expression) @reference.callable_value
)

(pair
  value: (member_expression) @reference.callable_value
)

(arguments
  (function_expression
    name: (identifier) @reference.callable_value
  )
)

; General identifier references (catch-all)
(identifier) @reference.variable