/**
 * Canonical capture schema for all tree-sitter query files
 *
 * DESIGN PRINCIPLES:
 *
 * 1. COMPLETE CAPTURES - Capture entire syntactic units, not fragments
 *    - Capture the full method_definition node, not method name + parameters separately
 *    - Capture the full call_expression node, not property_identifier + call separately
 *    - One capture → multiple semantic entities extracted by builders
 *
 * 2. POSITIVE VALIDATION - Only explicitly allowed captures are valid
 *    - Required captures (must exist in every language)
 *    - Optional captures (language-specific features)
 *    - Everything else is implicitly invalid
 *
 * 3. BUILDER EXTRACTION - Builders extract multiple entities from single captures
 *    - @definition.method capture → method def + parameters + return type
 *    - @reference.call capture → call ref + receiver + property chain
 *    - Eliminates duplicate/overlapping captures
 *
 * This approach is closed and maintainable - we explicitly list what IS allowed,
 * rather than trying to enumerate everything that ISN'T allowed.
 */

import { SemanticCategory, SemanticEntity } from "../index_single_file";

// ============================================================================
// Core Types
// ============================================================================

export interface CaptureSchema {
  /**
   * Required captures - every language MUST have these
   *
   * Based on common captures from analysis (24 core patterns)
   */
  required: CapturePattern[];

  /**
   * Optional captures - language-specific features allowed
   *
   * Explicitly lists all valid optional captures.
   * Any capture not in required OR optional is INVALID.
   */
  optional: CapturePattern[];

  /**
   * Naming conventions and rules
   */
  rules: NamingRules;
}

export interface CapturePattern {
  /**
   * Regular expression matching valid capture names
   * Example: /^@definition\.function$/
   */
  pattern: RegExp;

  /**
   * Human-readable description of what this captures
   */
  description: string;

  /**
   * Which semantic category this maps to
   */
  category: SemanticCategory;

  /**
   * Which semantic entity this maps to
   */
  entity: SemanticEntity;

  /**
   * Example usage in .scm file
   */
  example: string;

  /**
   * Expected node types for this capture across languages
   * Used to enforce "complete capture" principle
   *
   * Example for @reference.call:
   * - TypeScript/JavaScript: call_expression
   * - Python: call
   * - Rust: call_expression
   *
   * Validation can warn if capture targets fragment nodes like:
   * - property_identifier (should be on parent call_expression)
   * - identifier in attribute context (should be on parent call)
   */
  expected_node_types?: {
    typescript?: string[];
    javascript?: string[];
    python?: string[];
    rust?: string[];
  };

  /**
   * Language-specific notes (if any)
   */
  notes?: string;
}

export interface NamingRules {
  /**
   * Overall pattern: @{category}.{entity}[.{qualifier}]
   */
  pattern: RegExp;

  /**
   * Maximum nesting depth (e.g., @a.b.c.d = 4 parts)
   */
  max_depth: number;
}

// ============================================================================
// Canonical Schema Definition
// ============================================================================

export const CANONICAL_CAPTURE_SCHEMA: CaptureSchema = {
  // ========================================
  // REQUIRED CAPTURES
  // ========================================
  // Based on 24 common captures from analysis, filtered to remove duplicates
  required: [
    // --- Scope Captures ---
    {
      pattern: /^@scope\.module$/,
      description: "Module/file-level scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.MODULE,
      example: "(program) @scope.module"
    },
    {
      pattern: /^@scope\.function$/,
      description: "Function scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION,
      example: "(function_declaration) @scope.function"
    },
    {
      pattern: /^@scope\.class$/,
      description: "Class scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
      example: "(class_declaration) @scope.class"
    },
    {
      pattern: /^@scope\.block$/,
      description: "Block scope (if/while/for bodies, etc.)",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      example: "(statement_block) @scope.block"
    },

    // --- Definition Captures ---
    {
      pattern: /^@definition\.function$/,
      description: "Function definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      example: "(function_declaration name: (identifier) @definition.function)"
    },
    {
      pattern: /^@definition\.class$/,
      description: "Class definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
      example: "(class_declaration name: (identifier) @definition.class)"
    },
    {
      pattern: /^@definition\.method$/,
      description: "Method definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      example: "(method_definition name: (property_identifier) @definition.method)"
    },
    {
      pattern: /^@definition\.constructor$/,
      description: "Constructor definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTRUCTOR,
      example: "(method_definition name: (property_identifier) @definition.constructor)"
    },
    {
      pattern: /^@definition\.variable$/,
      description: "Variable definition name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      example: "(variable_declarator name: (identifier) @definition.variable)"
    },
    {
      pattern: /^@definition\.parameter$/,
      description: "Function/method parameter name",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      example: "(formal_parameter name: (identifier) @definition.parameter)"
    },
    {
      pattern: /^@definition\.field$/,
      description: "Class field/property definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FIELD,
      example: "(field_definition name: (property_identifier) @definition.field)"
    },

    // --- Reference Captures ---
    {
      pattern: /^@reference\.call$/,
      description: "Function/method call - single capture on complete call node",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(call_expression) @reference.call",
      expected_node_types: {
        typescript: ["call_expression"],
        javascript: ["call_expression"],
        python: ["call"],
        rust: ["call_expression"]
      },
      notes: "Captures complete call node. Extractors derive: method name, receiver, property chain, call type."
    },
    {
      pattern: /^@reference\.variable$/,
      description: "Variable reference",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(identifier) @reference.variable"
    },
    {
      pattern: /^@reference\.variable\.base$/,
      description: "Base object in property chain (for tracking receivers)",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(identifier) @reference.variable.base"
    },
    {
      pattern: /^@reference\.variable\.source$/,
      description: "Source variable in assignments/flows",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(identifier) @reference.variable.source"
    },
    {
      pattern: /^@reference\.variable\.target$/,
      description: "Target variable in assignments/flows",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(identifier) @reference.variable.target"
    },
    {
      pattern: /^@reference\.this$/,
      description: "Reference to 'this' keyword",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(this) @reference.this"
    },
    {
      pattern: /^@reference\.super$/,
      description: "Reference to 'super' keyword",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(super) @reference.super"
    },
    {
      pattern: /^@reference\.type_reference$/,
      description: "Reference to a type/class name",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(type_identifier) @reference.type_reference"
    },

    // --- Assignment/Return ---
    {
      pattern: /^@assignment\.variable$/,
      description: "Variable assignment",
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
      example: "(assignment_expression) @assignment.variable"
    },
    {
      pattern: /^@return\.variable$/,
      description: "Return statement value",
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.VARIABLE,
      example: "(return_statement) @return.variable"
    },

    // --- Export ---
    {
      pattern: /^@export\.variable$/,
      description: "Exported variable/function",
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE,
      example: "(export_statement) @export.variable"
    },

    // --- Modifier ---
    {
      pattern: /^@modifier\.visibility$/,
      description: "Visibility modifier (public, private, protected, etc.)",
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VARIABLE, // Modifier is a special category
      example: "(accessibility_modifier) @modifier.visibility"
    },
  ],

  // ========================================
  // OPTIONAL CAPTURES
  // ========================================
  // Language-specific features explicitly allowed
  optional: [
    // TypeScript-specific
    {
      pattern: /^@definition\.interface$/,
      description: "TypeScript interface definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
      example: "(interface_declaration name: (type_identifier) @definition.interface)"
    },
    {
      pattern: /^@definition\.type_alias$/,
      description: "TypeScript/Rust type alias",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_ALIAS,
      example: "(type_alias_declaration name: (type_identifier) @definition.type_alias)"
    },
    {
      pattern: /^@definition\.enum$/,
      description: "TypeScript/Rust enum definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
      example: "(enum_declaration name: (identifier) @definition.enum)"
    },
    {
      pattern: /^@definition\.enum_member$/,
      description: "Enum member definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM_MEMBER,
      example: "(enum_member name: (identifier) @definition.enum_member)"
    },
    {
      pattern: /^@definition\.namespace$/,
      description: "TypeScript namespace definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.NAMESPACE,
      example: "(namespace_declaration name: (identifier) @definition.namespace)"
    },
    {
      pattern: /^@definition\.type_parameter$/,
      description: "Generic type parameter",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_PARAMETER,
      example: "(type_parameter name: (type_identifier) @definition.type_parameter)"
    },
    {
      pattern: /^@definition\.property$/,
      description: "Class property/field definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PROPERTY,
      example: "(property_definition name: (property_identifier) @definition.property)"
    },

    // Python-specific
    {
      pattern: /^@decorator\.(function|class|method|property)$/,
      description: "Python decorator",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.FUNCTION, // Entity depends on what's decorated
      example: "(decorator) @decorator.function"
    },

    // Rust-specific
    {
      pattern: /^@definition\.trait$/,
      description: "Rust trait definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE, // Map to interface semantically
      example: "(trait_item name: (type_identifier) @definition.trait)"
    },
    {
      pattern: /^@definition\.impl$/,
      description: "Rust impl block",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS, // impl block is like extending a class
      example: "(impl_item) @definition.impl)"
    },
    {
      pattern: /^@definition\.constant$/,
      description: "Rust constant definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      example: "(const_item name: (identifier) @definition.constant)"
    },
    {
      pattern: /^@definition\.macro$/,
      description: "Rust macro definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      example: "(macro_definition name: (identifier) @definition.macro)"
    },
    {
      pattern: /^@definition\.module$/,
      description: "Rust module definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.MODULE,
      example: "(mod_item name: (identifier) @definition.module)"
    },
    {
      pattern: /^@definition\.(class|enum|function|interface)\.generic$/,
      description: "Generic struct/enum/function/trait with type parameters",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION, // Varies
      example: "(function_item type_parameters: (_) name: (identifier) @definition.function.generic)"
    },
    {
      pattern: /^@definition\.method\.async$/,
      description: "Async method definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      example: "(function_item (function_modifiers 'async') name: (identifier) @definition.method.async)"
    },
    {
      pattern: /^@definition\.function\.closure$/,
      description: "Closure expression",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      example: "(closure_expression) @definition.function.closure"
    },
    {
      pattern: /^@definition\.parameter\.self$/,
      description: "Rust self parameter",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      example: "(self_parameter) @definition.parameter.self"
    },
    {
      pattern: /^@definition\.variable\.mut$/,
      description: "Mutable variable definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      example: "(let_declaration (mutable_specifier) pattern: (identifier) @definition.variable.mut)"
    },
    {
      pattern: /^@reference\.macro$/,
      description: "Macro invocation",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(macro_invocation macro: (identifier) @reference.macro)"
    },
    {
      pattern: /^@reference\.variable\.borrowed$/,
      description: "Borrowed reference (&)",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(reference_expression value: (_) @reference.variable.borrowed)"
    },
    {
      pattern: /^@import\.declaration$/,
      description: "Import/use declaration",
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      example: "(use_declaration) @import.declaration"
    },
    {
      pattern: /^@export\.(module|declaration)$/,
      description: "Export module or re-export declaration",
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.MODULE,
      example: "(mod_item (visibility_modifier) name: (identifier) @export.module)"
    },
    {
      pattern: /^@scope\.block\.(unsafe|async)$/,
      description: "Rust unsafe or async block",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      example: "(unsafe_block) @scope.block.unsafe"
    },
    {
      pattern: /^@modifier\.(mutability|visibility)$/,
      description: "Rust mutability or visibility modifier",
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VARIABLE,
      example: "(mut_pattern) @modifier.mutability"
    },
    {
      pattern: /^@decorator\.macro$/,
      description: "Rust attribute macro",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.FUNCTION,
      example: "(attribute_item) @decorator.macro"
    },

    // Generic/Type-specific (TypeScript/Rust)
    {
      pattern: /^@reference\.call\.generic$/,
      description: "Generic function/method call with type arguments",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(call_expression type_arguments: (_)) @reference.call.generic"
    },
    {
      pattern: /^@reference\.constructor$/,
      description: "Constructor call",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
      example: "(new_expression) @reference.constructor"
    },
    {
      pattern: /^@reference\.constructor\.generic$/,
      description: "Generic constructor call with type arguments",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
      example: "(new_expression type_arguments: (_)) @reference.constructor.generic"
    },

    // Property access
    {
      pattern: /^@reference\.property$/,
      description: "Property access (not a call)",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.PROPERTY,
      example: "(member_expression) @reference.property"
    },
    {
      pattern: /^@reference\.property\.(optional|computed|assign)$/,
      description: "Property access with qualifiers",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.PROPERTY,
      example: "(member_expression) @reference.property.optional"
    },
    {
      pattern: /^@reference\.member_access(\.optional|\.computed|\.assign)?$/,
      description: "Member access patterns",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.PROPERTY,
      example: "(member_expression) @reference.member_access"
    },

    // Import/Export variants
    {
      pattern: /^@definition\.import$/,
      description: "Import definition",
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      example: "(import_statement) @definition.import"
    },
    {
      pattern: /^@import\.reexport$/,
      description: "Re-export pattern",
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      example: "(export_statement source: (_)) @import.reexport"
    },
    {
      pattern: /^@export\.(class|function|variable|interface|enum|type_alias|namespace)$/,
      description: "Export declarations",
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.VARIABLE, // Varies by what's exported
      example: "(export_statement) @export.function"
    },

    // Assignment variants
    {
      pattern: /^@assignment\.(property|constructor)$/,
      description: "Property or constructor assignments",
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.PROPERTY,
      example: "(assignment_expression) @assignment.property"
    },

    // Modifier variants
    {
      pattern: /^@modifier\.(access_modifier|readonly_modifier|static|async)$/,
      description: "Various language modifiers",
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VARIABLE,
      example: "(public_modifier) @modifier.access_modifier"
    },

    // Scope variants
    {
      pattern: /^@scope\.method$/,
      description: "Method scope (some languages capture method separate from body)",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.METHOD,
      example: "(method_definition) @scope.method"
    },
    {
      pattern: /^@scope\.(closure|namespace|interface|enum|trait|impl)$/,
      description: "Language-specific scope types",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION, // Varies by scope type
      example: "(arrow_function) @scope.closure"
    },

    // Type references
    {
      pattern: /^@type\.(identifier|annotation)$/,
      description: "Type identifier or annotation",
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ALIAS,
      example: "(type_identifier) @type.identifier"
    },

    // JSX-specific (JavaScript/TypeScript)
    {
      pattern: /^@reference\.call\.jsx$/,
      description: "JSX element as function call",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(jsx_element) @reference.call.jsx"
    },

    // TypeScript - Interface members
    {
      pattern: /^@definition\.interface\.(method|property)$/,
      description: "Interface method or property definition",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      example: "(method_signature name: (property_identifier) @definition.interface.method)"
    },

    // Type system
    {
      pattern: /^@type\.type_assertion$/,
      description: "TypeScript type assertion",
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_ALIAS,
      example: "(as_expression) @type.type_assertion"
    },

    // Scopes - language-specific
    {
      pattern: /^@scope\.(namespace|constructor|comprehension)$/,
      description: "Language-specific scope types",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.NAMESPACE,
      example: "(namespace_declaration) @scope.namespace"
    },

    // Rust - Macros
    {
      pattern: /^@decorator\.macro$/,
      description: "Rust macro decorator",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.FUNCTION,
      example: "(attribute_item) @decorator.macro"
    },
    {
      pattern: /^@reference\.macro$/,
      description: "Rust macro invocation",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      example: "(macro_invocation) @reference.macro"
    },

    // Rust - Function modifiers
    {
      pattern: /^@definition\.function\.(unsafe|const|async)$/,
      description: "Rust function modifiers",
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      example: "(function_item) @definition.function.unsafe"
    },

    // Rust - Type system
    {
      pattern: /^@reference\.type$/,
      description: "Rust type reference (for associated functions)",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(type_identifier) @reference.type"
    },

    // Rust - Memory/ownership
    {
      pattern: /^@reference\.variable\.borrowed$/,
      description: "Rust borrowed reference",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(reference_expression) @reference.variable.borrowed"
    },

    // Universal - Write references
    {
      pattern: /^@reference\.write$/,
      description: "Write/mutation reference",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(assignment_expression left: (_)) @reference.write"
    },

    // Universal - Return functions
    {
      pattern: /^@return\.function$/,
      description: "Returning a function value",
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.FUNCTION,
      example: "(return_statement value: (function)) @return.function"
    },

    // Universal - typeof operator
    {
      pattern: /^@reference\.typeof$/,
      description: "typeof operator reference",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(typeof_expression) @reference.typeof"
    },

    // Definition - Import variations
    {
      pattern: /^@definition\.import\.named$/,
      description: "Named import specifier",
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      example: "(import_specifier) @definition.import.named"
    },

    // Modifiers - Additional
    {
      pattern: /^@modifier\.(readonly|static|async)$/,
      description: "Additional modifiers",
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VARIABLE,
      example: "(readonly_modifier) @modifier.readonly"
    },

    // Rust - Specific references
    {
      pattern: /^@reference\.(field|struct)$/,
      description: "Rust field and struct references",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(field_identifier) @reference.field"
    },

    // Constructor variants
    {
      pattern: /^@reference\.constructor\.struct$/,
      description: "Rust struct constructor",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
      example: "(struct_expression) @reference.constructor.struct"
    },

    // Decorator variants
    {
      pattern: /^@decorator\.(class_var|property_decorator)$/,
      description: "Python decorator variants",
      category: SemanticCategory.DECORATOR,
      entity: SemanticEntity.PROPERTY,
      example: "(decorator) @decorator.property_decorator"
    },

    // Variable update references
    {
      pattern: /^@reference\.variable\.update$/,
      description: "Update expression reference (++, --, etc.)",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(update_expression) @reference.variable.update"
    },

    // Type - Generic context
    {
      pattern: /^@reference\.type\.generic$/,
      description: "Generic type reference",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(generic_type) @reference.type.generic"
    },

    // Import source
    {
      pattern: /^@import\.(source|module_path)$/,
      description: "Import source path",
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      example: "(import_statement source: (string)) @import.source"
    },

    // Scope - method (some languages separate method scope from body)
    {
      pattern: /^@scope\.method\.body$/,
      description: "Method body scope",
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.METHOD,
      example: "(statement_block) @scope.method.body"
    },

    // Variable - object reference (for method receivers)
    {
      pattern: /^@reference\.variable\.object$/,
      description: "Object reference in property access",
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      example: "(member_expression object: (identifier)) @reference.variable.object"
    },
  ],

  // ========================================
  // NAMING RULES
  // ========================================
  rules: {
    pattern: /^@[a-z_]+\.[a-z_]+(\.[a-z_]+)?$/,
    max_depth: 3
  }
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a capture name is valid according to the schema
 *
 * Uses POSITIVE validation: capture must be in required OR optional lists
 */
export function is_valid_capture(capture_name: string): boolean {
  // Must match overall naming pattern
  if (!CANONICAL_CAPTURE_SCHEMA.rules.pattern.test(capture_name)) {
    return false;
  }

  // Must be in required OR optional lists
  const is_required = CANONICAL_CAPTURE_SCHEMA.required.some((p) =>
    p.pattern.test(capture_name)
  );
  const is_optional = CANONICAL_CAPTURE_SCHEMA.optional.some((p) =>
    p.pattern.test(capture_name)
  );

  return is_required || is_optional;
}

/**
 * Get validation errors for a capture name
 */
export function get_capture_errors(capture_name: string): string[] {
  const errors: string[] = [];

  // Check naming rules
  if (!CANONICAL_CAPTURE_SCHEMA.rules.pattern.test(capture_name)) {
    errors.push(
      "Invalid capture name format. Must follow: @category.entity[.qualifier]"
    );
  }

  // Check depth
  const parts = capture_name.substring(1).split("."); // Remove leading @
  if (parts.length > CANONICAL_CAPTURE_SCHEMA.rules.max_depth) {
    errors.push(
      `Too many nesting levels (${parts.length}). Maximum is ${CANONICAL_CAPTURE_SCHEMA.rules.max_depth}`
    );
  }

  // Check if capture is in allowed lists (required OR optional)
  const is_required = CANONICAL_CAPTURE_SCHEMA.required.some((p) =>
    p.pattern.test(capture_name)
  );
  const is_optional = CANONICAL_CAPTURE_SCHEMA.optional.some((p) =>
    p.pattern.test(capture_name)
  );

  if (!is_required && !is_optional) {
    errors.push(
      `Capture '${capture_name}' is not in required or optional lists. ` +
        "All valid captures must be explicitly defined in the schema."
    );
  }

  return errors;
}
