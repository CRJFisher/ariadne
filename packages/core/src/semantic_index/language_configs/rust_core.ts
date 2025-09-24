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
    "def.enum",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
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
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
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