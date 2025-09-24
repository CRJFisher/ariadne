/**
 * Core Rust capture mapping configuration (without pattern matching and async/functions)
 */

import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
} from "../capture_types";

/**
 * Core capture configurations for Rust (scopes, definitions, references, imports, exports)
 */
export const RUST_CORE_MAPPINGS = new Map<string, CaptureMapping>([
  // ============================================================================
  // SCOPES - Rust lexical boundaries
  // ============================================================================
  [
    "scope.module",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.MODULE,
    },
  ],
  [
    "scope.function",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "scope.closure",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true }),
    },
  ],
  [
    "scope.impl",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
      modifiers: () => ({ is_impl_block: true }),
    },
  ],
  [
    "scope.trait",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.INTERFACE,
    },
  ],
  [
    "scope.struct",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
    },
  ],
  [
    "scope.enum",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.ENUM,
    },
  ],
  [
    "scope.block",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
    },
  ],
  [
    "scope.block.unsafe",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_unsafe: true }),
    },
  ],
  [
    "scope.for",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_loop: true, loop_type: "for" }),
    },
  ],
  [
    "scope.while",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_loop: true, loop_type: "while" }),
    },
  ],
  [
    "scope.loop",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_loop: true, loop_type: "loop" }),
    },
  ],

  // ============================================================================
  // DEFINITIONS - Rust type and value definitions
  // ============================================================================

  // Struct definitions
  [
    "def.struct",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
    },
  ],
  [
    "def.struct.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLASS,
      modifiers: () => ({ is_generic: true }),
    },
  ],
  [
    "def.enum",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
    },
  ],
  [
    "def.enum.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
      modifiers: () => ({ is_generic: true }),
    },
  ],
  [
    "def.enum_variant",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM_MEMBER,
    },
  ],
  [
    "def.function",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "def.function.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_generic: true }),
    },
  ],
  [
    "def.function.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_async: true }),
    },
  ],
  [
    "def.function.const",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_const: true }),
    },
  ],
  [
    "def.function.unsafe",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_unsafe: true }),
    },
  ],
  [
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
    },
  ],
  [
    "def.method.associated",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_static: true }),
    },
  ],
  [
    "def.variable",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "def.constant",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTANT,
    },
  ],
  [
    "def.parameter",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
    },
  ],
  [
    "def.field",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PROPERTY,
    },
  ],
  [
    "def.trait",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
    },
  ],
  [
    "def.type",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE,
    },
  ],

  // Const items (different from def.constant)
  [
    "def.const",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTANT,
    },
  ],

  // Static items
  [
    "def.static",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_static: true }),
    },
  ],

  // Parameters (different from def.parameter)
  [
    "def.param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
    },
  ],
  [
    "def.param.self",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_self: true }),
    },
  ],

  // Loop variables
  [
    "def.loop_var",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_loop_var: true }),
    },
  ],

  // Module definitions
  [
    "def.module",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.MODULE,
    },
  ],

  // Interface definitions (different from def.trait)
  [
    "def.interface",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
    },
  ],
  [
    "def.interface.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
      modifiers: () => ({ is_generic: true }),
    },
  ],

  // Type alias definitions (different from def.type)
  [
    "def.type_alias",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_ALIAS,
    },
  ],

  // Type parameters
  [
    "def.type_param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],

  // Const parameters
  [
    "def.const_param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTANT,
      modifiers: () => ({ is_const_generic: true }),
    },
  ],

  // Constructor functions
  [
    "def.constructor",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],

  // Trait methods
  [
    "def.trait_method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_trait_method: true }),
    },
  ],
  [
    "def.trait_method.default",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_trait_method: true, has_default_impl: true }),
    },
  ],

  // Trait implementation methods
  [
    "def.trait_impl_method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_trait_impl_method: true }),
    },
  ],
  [
    "def.trait_impl_method.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_trait_impl_method: true, is_async: true }),
    },
  ],

  // Associated types
  [
    "def.associated_type",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_associated_type: true }),
    },
  ],
  [
    "def.associated_type.impl",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_associated_type: true, is_trait_impl: true }),
    },
  ],

  // Associated constants
  [
    "def.associated_const",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTANT,
      modifiers: () => ({ is_associated: true }),
    },
  ],

  // Macro definitions
  [
    "def.macro",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.MACRO,
    },
  ],

  // ============================================================================
  // TYPE CONSTRAINTS
  // ============================================================================
  [
    "constraint.where_clause",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_CONSTRAINT,
    },
  ],
  [
    "constraint.bounds",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_CONSTRAINT,
    },
  ],
  [
    "constraint.type",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],
  [
    "constraint.trait",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_CONSTRAINT,
    },
  ],
  [
    "constraint.trait.generic",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_CONSTRAINT,
    },
  ],
  [
    "constraint.lifetime",
    {
      category: SemanticCategory.TYPE,
      entity: SemanticEntity.TYPE_PARAMETER,
      modifiers: () => ({ is_lifetime: true }),
    },
  ],

  // ============================================================================
  // RUST VISIBILITY SYSTEM
  // ============================================================================
  [
    "visibility.public",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VISIBILITY,
      modifiers: () => ({ visibility_level: "public" }),
    },
  ],
  [
    "visibility.crate",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VISIBILITY,
      modifiers: () => ({ visibility_level: "crate" }),
    },
  ],
  [
    "visibility.super",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VISIBILITY,
      modifiers: () => ({ visibility_level: "super" }),
    },
  ],
  [
    "visibility.restricted",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VISIBILITY,
      modifiers: () => ({ visibility_level: "restricted" }),
    },
  ],
  [
    "visibility.self",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VISIBILITY,
      modifiers: () => ({ visibility_level: "self" }),
    },
  ],

  // ============================================================================
  // EXPORTS - Rust public items
  // ============================================================================
  [
    "export.struct",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.CLASS,
    },
  ],
  [
    "export.enum",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.ENUM,
    },
  ],
  [
    "export.function",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.FUNCTION,
    },
  ],

  // ============================================================================
  // IMPORTS - Rust use system
  // ============================================================================
  [
    "import.name",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IDENTIFIER,
    },
  ],
  [
    "import.path",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.MODULE,
    },
  ],

  // ============================================================================
  // REFERENCES - Rust usage patterns
  // ============================================================================

  // Function and method calls
  [
    "ref.call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
    },
  ],
  [
    "ref.method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: (node) => {
        // Find the receiver for method calls
        const parent = node.parent;
        if (parent?.type === "call_expression") {
          const fieldExpr = parent.children.find(
            (child) => child.type === "field_expression"
          );
          if (fieldExpr) {
            const receiver = fieldExpr.children.find(
              (child) => child.type !== "field_identifier" && child.type !== "."
            );
            if (receiver) {
              return {
                receiver_node: receiver,
                is_method_call: true,
              };
            }
          }
        }
        return { is_method_call: true };
      },
    },
  ],
  [
    "ref.method_call.chained",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      context: () => ({ is_chained_call: true }),
    },
  ],
  [
    "call.function",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "call.method",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
    },
  ],
  [
    "method.instance",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
    },
  ],
  [
    "method.static",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_static: true }),
    },
  ],
  [
    "call.receiver",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "call.method",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_higher_order: true }),
    },
  ],
  [
    "call.higher_order",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      modifiers: () => ({ is_higher_order: true }),
    },
  ],
  [
    "smart_pointer.method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      modifiers: () => ({ is_smart_pointer_method: true }),
    },
  ],
  [
    "call.constructor",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],

  // Variable and field access
  [
    "ref.receiver",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.associated_function",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CALL,
      modifiers: () => ({ is_associated_call: true }),
    },
  ],
  [
    "ref.object",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.variable",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "ref.field",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.PROPERTY,
    },
  ],

  // Type references
  [
    "ref.type",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
    },
  ],
  [
    "ref.trait",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.INTERFACE,
    },
  ],

  // Macro references
  [
    "ref.macro",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MACRO,
    },
  ],
  [
    "ref.macro.scoped",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MACRO,
    },
  ],
  [
    "ref.macro.builtin",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MACRO,
      modifiers: () => ({ is_builtin: true }),
    },
  ],
  [
    "ref.macro.async",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MACRO,
      modifiers: () => ({ is_async_macro: true }),
    },
  ],

  // ============================================================================
  // STATIC VS INSTANCE METHOD DETECTION
  // ============================================================================
  [
    "class.ref",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CLASS,
      modifiers: () => ({
        is_static_access: true,
        receiver_type: "static",
      }),
    },
  ],
]);