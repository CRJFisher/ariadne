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
      entity: SemanticEntity.CLOSURE,
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
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_const: true }),
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
      entity: SemanticEntity.TYPE_ALIAS,
      modifiers: () => ({ is_associated: true }),
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
  // RUST VISIBILITY SYSTEM
  // ============================================================================
  [
    "visibility.pub",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.MODIFIER,
      modifiers: () => ({ visibility_level: "public" }),
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
    "call.constructor",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.CONSTRUCTOR,
    },
  ],

  // Variable and field access
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