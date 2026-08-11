;; ==============================================================================
;; SEMANTIC INDEX - JavaScript/TypeScript with Enhanced Type Tracking
;; ==============================================================================
;; Captures all semantic information needed for type resolution and method calls
;; ==============================================================================

;; ==============================================================================
;; SCOPES - Define lexical boundaries
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
(class
  body: (class_body) @scope.class
)

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
;; DEFINITIONS - Symbols that introduce new names
;; ==============================================================================

; Function definitions
(function_declaration
  name: (identifier) @definition.function
)

(function_expression
  name: (identifier) @definition.function
)

; Arrow functions assigned to variables (captures both assignment and function definition)
(variable_declarator
  name: (identifier) @definition.function @assignment.variable
  value: (arrow_function) @reference.variable
) @assignment.variable

; Function expressions assigned to variables — registers the outer var name as a
; function in the enclosing scope. The inner name of a named function expression
; is captured separately above and stays scoped to the function body.
(variable_declarator
  name: (identifier) @definition.function @assignment.variable
  value: (function_expression) @reference.variable
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

(call_expression
  function: (parenthesized_expression
    (function_expression !name) @definition.anonymous_function
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

; Callables returned from a function. The returned callable owns its
; parameters, and no named definition claims it (a named function expression
; is captured above and keeps its own name).
(return_statement
  (function_expression !name) @definition.anonymous_function
)

(return_statement
  (arrow_function) @definition.anonymous_function
)

; Whole-module CommonJS export of an inline callable:
; module.exports = function (p) {} / (p) => {}. The property form
; (exports.NAME = fn) is captured by name above.
(assignment_expression
  left: (member_expression
    object: (identifier) @_module_obj
    property: (property_identifier) @_exports_prop)
  right: (function_expression !name) @definition.anonymous_function
  (#eq? @_module_obj "module")
  (#eq? @_exports_prop "exports")
)

(assignment_expression
  left: (member_expression
    object: (identifier) @_module_obj_arrow
    property: (property_identifier) @_exports_prop_arrow)
  right: (arrow_function) @definition.anonymous_function
  (#eq? @_module_obj_arrow "module")
  (#eq? @_exports_prop_arrow "exports")
)

; Object-literal shorthand methods: { m(p) {} }. Anchored to (object) so class
; bodies keep their method handling.
(object
  (method_definition
    name: (property_identifier) @definition.function
  )
)

; === CommonJS property exports of a function value ===
; exports.NAME = function () {} / () => {}   and   module.exports.NAME = ...
; The `(program (expression_statement ...))` anchor restricts the match to
; module top level, matching the export cache's top-level-only walk — a
; `exports.x = () => {}` nested in a function body is a local assignment, not a
; module export. Named function expressions are excluded (!name): they already
; produce a @definition.function (function_expression rule above) and are marked
; exported through the export cache. The body scope attaches to this
; property-located definition via find_body_scope_for_definition, exactly as for
; `const NAME = () => {}`.
(program
  (expression_statement
    (assignment_expression
      left: (member_expression
        object: (identifier) @_obj
        property: (property_identifier) @definition.function.commonjs_export)
      right: [(function_expression !name) (arrow_function)]
      (#eq? @_obj "exports"))))

(program
  (expression_statement
    (assignment_expression
      left: (member_expression
        object: (member_expression) @_obj
        property: (property_identifier) @definition.function.commonjs_export)
      right: [(function_expression !name) (arrow_function)]
      (#eq? @_obj "module.exports"))))

; Variable declarations with assignments
(variable_declarator
  name: (identifier) @definition.variable @assignment.variable
  value: (_) @reference.variable
) @assignment.variable

; Variable declarations with namespace-qualified constructor calls
(variable_declarator
  name: (identifier) @assignment.variable
  value: (new_expression
    constructor: (member_expression) @assignment.constructor.qualified
  )
) @assignment.constructor.qualified

; Destructuring binds one name per identifier in the pattern; capturing the
; whole pattern would bind a single name spelled "{ c }".
(object_pattern
  (shorthand_property_identifier_pattern) @definition.variable
)

(object_pattern
  (pair_pattern
    value: (identifier) @definition.variable
  )
)

(array_pattern
  (identifier) @definition.variable
)

(rest_pattern
  (identifier) @definition.variable
)

; Variable declarations without initialization (e.g., let x; var y;)
; This pattern captures uninitialized variables for completeness and consistency
; with TypeScript, Python, and Rust query patterns
; The !value syntax ensures this only matches variables WITHOUT an initializer
(variable_declarator
  name: (identifier) @definition.variable
  !value
)

; Documentation comments (JSDoc block comments and line comments)
(comment) @definition.documentation

; Class definitions with inheritance
(class_declaration
  name: (identifier) @definition.class
  (class_heritage
    (identifier) @reference.type_reference
  )?
)

; Named class expressions assigned to a CommonJS export, e.g.
; `module.exports = class X {}` or `exports.X = class X {}`. Anchoring the
; assignment target to an `exports` / `module` base keeps a non-export class
; expression (`const C = class Bar {}`, `obj.prop = class Bar {}`, a class passed
; as an argument) from registering a stray definition whose inner name would
; shadow an enclosing binding. An anonymous `class {}` has no name to identify
; and is left uncaptured.
(assignment_expression
  left: (member_expression
    object: (identifier) @_export_base
    (#match? @_export_base "^(module|exports)$")
  )
  right: (class
    name: (identifier) @definition.class
    (class_heritage
      (identifier) @reference.type_reference
    )?
  )
)

; Method definitions (capture static modifier)
(method_definition
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

; Constructor
(method_definition
  name: (property_identifier) @definition.constructor
  (#eq? @definition.constructor "constructor")
) @scope.constructor

; Field definitions
(field_definition
  "static"? @modifier.visibility
  property: (property_identifier) @definition.field
)

(field_definition
  property: (private_property_identifier) @definition.field
)

; Parameters
(formal_parameters
  (identifier) @definition.parameter
)

(formal_parameters
  (rest_pattern (identifier) @definition.parameter)
)

(formal_parameters
  (assignment_pattern
    left: (identifier) @definition.parameter
  )
)

; Catch clause parameter
; A catch binding is scoped to the catch block, not a parameter of any
; callable — it owns no signature slot.
(catch_clause
  parameter: (identifier) @definition.variable
)

; Loop variables. `for (const a of xs)` puts the identifier directly under
; `left`; the nested form covers `for (const { a } of xs)`.
(for_in_statement
  left: (identifier) @definition.variable
)

(for_in_statement
  left: (_
    (identifier) @definition.variable
  )
)

;; ==============================================================================
;; IMPORTS
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
;; COMMONJS IMPORTS - require() patterns
;; ==============================================================================

; Destructuring require - const { a, b, c } = require('./module')
; Captures individual identifiers from object destructuring
(variable_declarator
  name: (object_pattern
    (shorthand_property_identifier_pattern) @definition.import.require
  )
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)

; Array destructuring require - const [a, b, c] = require('./module')
; Captures individual identifiers from array destructuring
(variable_declarator
  name: (array_pattern
    (identifier) @definition.import.require
  )
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)

; Simple require - const utils = require('./module')
; Captures the single identifier
(variable_declarator
  name: (identifier) @definition.import.require.simple
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
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

;; ==============================================================================
;; EXPORTS
;; ==============================================================================

; Named exports
(export_specifier
  name: (identifier) @export.variable
)

(export_specifier
  name: (identifier) @export.variable
  alias: (identifier) @export.variable
)

; Default exports
(export_statement
  (identifier) @export.variable
)

(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function
  )
)

(export_statement
  declaration: (class_declaration
    name: (identifier) @export.class
  )
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
    name: (identifier) @export.class
  )
)

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

; NOTE: Re-exports (export { foo } from 'module') are now handled by the
; RE-EXPORTS section above as import definitions with export metadata.
; They are NOT handled here to avoid duplicates.

;; ==============================================================================
;; REFERENCES with Enhanced Context
;; ==============================================================================

; Function calls
(call_expression
  function: (identifier) @reference.call
)

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

; Prototype-style method assignment: Counter.prototype.method = function () {}
(assignment_expression
  left: (member_expression
    object: (member_expression)
    property: (property_identifier)
  )
) @assignment.property

; Return statements
(return_statement
  (_) @return.variable
) @return.function

; Update expressions
(update_expression
  argument: (identifier) @reference.variable.update
)

; JSX components — a tag whose name starts with a lowercase letter is an
; intrinsic host element (`<div>`), not a reference to any definition; every
; other tag (`<Panel>`, `<_Private>`) names a component, so the match excludes
; only the lowercase-initial host form. The `.tsx` TypeScript query carries an
; identical copy in query_loader's JSX_COMPONENT_CAPTURES; keep the two in sync.
(jsx_opening_element
  (identifier) @reference.call.jsx
  (#not-match? @reference.call.jsx "^[a-z]")
)

(jsx_self_closing_element
  (identifier) @reference.call.jsx
  (#not-match? @reference.call.jsx "^[a-z]")
)

; this references (important for method context)
(this) @reference.this

; super references (for inheritance)
(super) @reference.super

; Field-initializer member read: narrowed to this/super so external-object fields
; aren't double-captured (the property_access pattern already handles those).
(field_definition
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