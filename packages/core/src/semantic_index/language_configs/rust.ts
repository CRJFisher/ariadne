/**
 * Rust capture mapping configuration
 *
 * Handles Rust's unique module system, ownership semantics, and type system
 */

import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";

/**
 * Map Rust tree-sitter captures to normalized semantic concepts
 *
 * Key Rust concepts handled:
 * - Complex visibility system (pub, pub(crate), pub(super), pub(in path))
 * - Module system (crate, super, self references)
 * - Traits vs impl blocks vs inherent implementations
 * - Associated functions vs methods (presence of self parameter)
 * - Ownership semantics (borrowing, dereferencing)
 * - Lifetimes and generic constraints
 */
export const RUST_CAPTURE_CONFIG: LanguageCaptureConfig = new Map<
  string,
  CaptureMapping
>([
  // ============================================================================
  // SCOPES - Rust lexical boundaries
  // ============================================================================
  [
    "scope.module",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.MODULE,
      context: (node) => ({
        scope_type: "module",
        is_crate_root: node.parent?.type === "source_file"
      }),
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
      context: (node) => ({
        scope_type: "closure",
        is_closure: true
      }),
    },
  ],
  [
    "scope.impl",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
      context: (node) => ({
        scope_type: "impl_block",
        // Will be enhanced with trait vs inherent impl info
      }),
    },
  ],
  [
    "scope.trait",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.INTERFACE,
      context: (node) => ({ scope_type: "trait_definition" }),
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
    "scope.match",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      context: (node) => ({ scope_type: "match_expression" }),
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
      context: (node) => ({
        rust_kind: "struct",
        definition_type: "struct"
      }),
    },
  ],

  // Enum definitions
  [
    "def.enum",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
      context: (node) => ({
        rust_kind: "enum",
        definition_type: "enum"
      }),
    },
  ],
  [
    "def.enum_variant",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM_MEMBER,
      context: (node) => ({ rust_kind: "enum_variant" }),
    },
  ],

  // Function definitions
  [
    "def.function",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      context: (node) => ({
        rust_kind: "function",
        is_standalone: true
      }),
    },
  ],
  [
    "def.function.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_async: true }),
      context: (node) => ({
        rust_kind: "function",
        is_standalone: true,
        is_async: true
      }),
    },
  ],
  [
    "def.function.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_generic: true }),
      context: (node) => ({
        rust_kind: "function",
        is_standalone: true,
        is_generic: true
      }),
    },
  ],
  [
    "def.function.closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true }),
      context: (node) => ({
        rust_kind: "closure",
        is_closure: true
      }),
    },
  ],

  // Method definitions (within impl blocks)
  [
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({
        is_method: true,
        is_static: false,
      }),
      context: (node) => ({
        rust_kind: "method",
        in_impl_block: true
      }),
    },
  ],

  // Associated functions (no self parameter - like static methods)
  [
    "def.method.associated",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({
        is_method: false,
        is_associated_function: true,
        is_static: true,
      }),
      context: (node) => ({
        rust_kind: "associated_function",
        in_impl_block: true
      }),
    },
  ],

  // Constructor methods (new, default, etc.)
  [
    "def.constructor",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({
        is_constructor: true,
        is_static: true,
      }),
      context: (node) => ({
        rust_kind: "constructor",
        in_impl_block: true
      }),
    },
  ],

  // Trait definitions
  [
    "def.trait",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
      context: (node) => ({
        rust_kind: "trait",
        definition_type: "trait"
      }),
    },
  ],

  // Type aliases
  [
    "def.type_alias",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_ALIAS,
      context: (node) => ({ rust_kind: "type_alias" }),
    },
  ],

  // Constants and statics
  [
    "def.const",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTANT,
      context: (node) => ({ rust_kind: "const" }),
    },
  ],
  [
    "def.static",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_static: true }),
      context: (node) => ({ rust_kind: "static" }),
    },
  ],

  // Variable bindings
  [
    "def.variable",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: (node) => {
        // Check if let binding has mut keyword
        const isMutable = node.parent?.children?.some(c => c.type === "mut");
        return { is_mutable: Boolean(isMutable) };
      },
      context: (node) => ({ rust_kind: "let_binding" }),
    },
  ],

  // Parameters
  [
    "def.param",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
    },
  ],

  // Module definitions
  [
    "def.module",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.MODULE,
      context: (node) => ({
        rust_kind: "module",
        definition_type: "module"
      }),
    },
  ],
  [
    "def.param.self",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_self: true }),
      context: (node) => ({
        parameter_type: "self",
        rust_kind: "self_parameter"
      }),
    },
  ],
  [
    "def.param.closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_closure_param: true }),
      context: (node) => ({
        parameter_type: "closure_param",
        rust_kind: "closure_parameter"
      }),
    },
  ],

  // ============================================================================
  // RUST VISIBILITY SYSTEM
  // ============================================================================
  [
    "visibility.pub",
    {
      category: SemanticCategory.MODIFIER,
      entity: SemanticEntity.VISIBILITY,
      context: (node) => {
        // Parse Rust visibility levels
        const text = node.text;
        if (text === "pub") {
          return { visibility_level: "public" };
        } else if (text.includes("pub(crate)")) {
          return { visibility_level: "crate" };
        } else if (text.includes("pub(super)")) {
          return { visibility_level: "super" };
        } else if (text.includes("pub(in")) {
          return {
            visibility_level: "restricted",
            visibility_path: text.match(/pub\(in\s+([^)]+)\)/)?.[1]
          };
        } else if (text.includes("pub(self)")) {
          return { visibility_level: "self" };
        }
        return { visibility_level: "public" };
      },
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
      context: (node) => ({ export_type: "struct" }),
    },
  ],
  [
    "export.function",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.FUNCTION,
      context: (node) => ({ export_type: "function" }),
    },
  ],
  [
    "export.trait",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.INTERFACE,
      context: (node) => ({ export_type: "trait" }),
    },
  ],
  [
    "export.reexport",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
      context: (node) => ({ export_type: "reexport" }),
    },
  ],

  // ============================================================================
  // IMPORTS - Rust use system
  // ============================================================================
  [
    "import.name",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      context: (node) => ({ import_style: "direct" }),
    },
  ],
  [
    "import.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      context: (node) => ({
        import_style: "aliased",
        original_name: node.text
      }),
    },
  ],
  [
    "import.alias",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      context: (node) => ({
        import_style: "aliased",
        alias_name: node.text
      }),
    },
  ],
  [
    "import.list.item",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
      context: (node) => ({
        import_style: "list_item"
      }),
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
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "ref.method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => ({ call_type: "method" }),
    },
  ],
  [
    "ref.associated_function",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_associated_call: true }),
      context: (node) => ({ call_type: "associated_function" }),
    },
  ],
  [
    "ref.receiver",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      context: (node) => ({ usage_type: "method_receiver" }),
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

  // Field access
  [
    "ref.object",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      context: (node) => ({ usage_type: "field_access_base" }),
    },
  ],
  [
    "ref.field",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.FIELD,
    },
  ],

  // Assignments
  [
    "ref.assign.target",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => ({ assignment_role: "target" }),
    },
  ],
  [
    "ref.assign.source",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
      context: (node) => ({ assignment_role: "source" }),
    },
  ],

  // Returns
  [
    "ref.return",
    {
      category: SemanticCategory.RETURN,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // Special Rust references
  [
    "ref.self",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_self_reference: true }),
      context: (node) => ({ rust_kind: "self_reference" }),
    },
  ],

  // Catch-all identifier
  [
    "ref.identifier",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // RUST-SPECIFIC FEATURES (not yet in simplified query)
  // ============================================================================

  // These would be added when expanding the query file:

  // Ownership and borrowing
  ["ownership.borrow", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.OPERATOR,
    modifiers: () => ({ is_borrow: true }),
    context: (node) => ({ rust_feature: "borrowing" }),
  }],

  ["ownership.borrow_mut", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.OPERATOR,
    modifiers: () => ({ is_mutable_borrow: true }),
    context: (node) => ({ rust_feature: "mutable_borrowing" }),
  }],

  ["ownership.deref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.OPERATOR,
    modifiers: () => ({ is_dereference: true }),
    context: (node) => ({ rust_feature: "dereferencing" }),
  }],

  // Lifetimes
  ["lifetime.param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    modifiers: () => ({ is_lifetime: true }),
    context: (node) => ({ rust_feature: "lifetime_parameter" }),
  }],

  ["lifetime.ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.TYPE_PARAMETER,
    modifiers: () => ({ is_lifetime: true }),
    context: (node) => ({ rust_feature: "lifetime_reference" }),
  }],

  // Traits and impls
  ["impl.trait", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.INTERFACE,
    context: (node) => ({
      rust_feature: "trait_implementation",
      impl_type: "trait"
    }),
  }],

  ["impl.inherent", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    context: (node) => ({
      rust_feature: "inherent_implementation",
      impl_type: "inherent"
    }),
  }],

  // Macros
  ["macro.call", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MACRO,
    context: (node) => ({ rust_feature: "macro_invocation" }),
  }],

  ["macro.definition", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.MACRO,
    context: (node) => ({ rust_feature: "macro_definition" }),
  }],

  // Module system specifics
  ["module.crate_ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    context: (node) => ({
      rust_feature: "crate_reference",
      module_ref_type: "crate"
    }),
  }],

  ["module.super_ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    context: (node) => ({
      rust_feature: "super_reference",
      module_ref_type: "super"
    }),
  }],

  ["module.self_ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    context: (node) => ({
      rust_feature: "self_reference",
      module_ref_type: "self"
    }),
  }],

  // Generic type parameters
  ["generic.type_param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    context: (node) => ({ rust_feature: "generic_type_parameter" }),
  }],

  ["generic.constraint", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.TYPE_CONSTRAINT,
    context: (node) => ({ rust_feature: "trait_bound" }),
  }],

  // Pattern matching
  ["pattern.match", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    context: (node) => ({
      rust_feature: "pattern_matching",
      pattern_type: "match_arm"
    }),
  }],

  ["pattern.destructure", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    context: (node) => ({
      rust_feature: "destructuring",
      pattern_type: "destructure"
    }),
  }],

  // ============================================================================
  // ADDITIONAL MAPPINGS - Fill coverage gaps
  // ============================================================================

  // Generic structs and enums
  ["def.struct.generic", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.CLASS,
    modifiers: () => ({ is_generic: true }),
  }],
  ["def.enum.generic", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.ENUM,
    modifiers: () => ({ is_generic: true }),
  }],

  // Mutable variables
  ["def.variable.mut", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    modifiers: () => ({ is_mutable: true }),
  }],
  ["def.variable.typed", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    modifiers: () => ({ has_type: true }),
  }],

  // Trait methods
  ["def.trait_method", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.METHOD,
    modifiers: () => ({ is_trait_method: true }),
  }],

  // Type parameters
  ["def.type_param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
  }],
  ["def.type_param.constrained", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    modifiers: () => ({ has_constraints: true }),
  }],

  // Self parameter variations
  ["def.param.self.ref", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.PARAMETER,
    modifiers: () => ({ is_self: true, is_reference: true }),
  }],

  // Struct/enum field definitions
  ["def.field", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.FIELD,
  }],

  // Definition contexts
  ["struct.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    context: (node) => ({ definition_context: "struct" }),
  }],
  ["enum.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.ENUM,
    context: (node) => ({ definition_context: "enum" }),
  }],
  ["trait.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.INTERFACE,
    context: (node) => ({ definition_context: "trait" }),
  }],
  ["const.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CONSTANT,
    context: (node) => ({ definition_context: "const" }),
  }],
  ["static.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.VARIABLE,
    context: (node) => ({ definition_context: "static" }),
  }],
  ["function.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.FUNCTION,
    context: (node) => ({ definition_context: "function" }),
  }],

  // Implementation contexts
  ["impl.type", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    context: (node) => ({ impl_context: "for_type" }),
  }],
  ["impl.for_type", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    context: (node) => ({ impl_context: "inherent" }),
  }],
  ["impl.for_type.trait", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    context: (node) => ({ impl_context: "trait_for_type" }),
  }],
  ["impl.trait_impl", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.INTERFACE,
    context: (node) => ({ impl_context: "trait_implementation" }),
  }],

  // Generic and type contexts
  ["struct.generic", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    modifiers: () => ({ is_generic: true }),
  }],
  ["type.generic", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.TYPE,
    modifiers: () => ({ is_generic: true }),
  }],
  ["type.args", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.TYPE_ARGUMENT,
  }],

  // Variable binding contexts
  ["variable.binding", {
    category: SemanticCategory.ASSIGNMENT,
    entity: SemanticEntity.VARIABLE,
    context: (node) => ({ binding_type: "let" }),
  }],
  ["variable.binding.mut", {
    category: SemanticCategory.ASSIGNMENT,
    entity: SemanticEntity.VARIABLE,
    context: (node) => ({ binding_type: "let_mut" }),
  }],
  ["variable.binding.typed", {
    category: SemanticCategory.ASSIGNMENT,
    entity: SemanticEntity.VARIABLE,
    context: (node) => ({ binding_type: "let_typed" }),
  }],

  // Constructor references
  ["ref.constructor.struct", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CLASS,
    modifiers: () => ({ is_constructor: true }),
  }],
  ["constructor.struct", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CLASS,
    context: (node) => ({ constructor_type: "struct" }),
  }],

  // Additional exports
  ["export.const", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.CONSTANT,
  }],
  ["export.enum", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.ENUM,
  }],
  ["export.const_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.CONSTANT,
  }],
  ["export.enum_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.ENUM,
  }],
  ["export.struct_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.CLASS,
  }],
  ["export.trait_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.INTERFACE,
  }],
  ["export.function_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.FUNCTION,
  }],

  // Scoped type references
  ["ref.type.scoped", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.TYPE,
    modifiers: () => ({ is_scoped: true }),
  }],
  ["ref.type.path", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    context: (node) => ({ path_segment: true }),
  }],

  // Simple imports
  ["import.simple", {
    category: SemanticCategory.IMPORT,
    entity: SemanticEntity.IMPORT,
    context: (node) => ({ import_style: "simple" }),
  }],

  // Additional missing patterns
  ["variant.definition", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.ENUM_MEMBER,
  }],
  ["trait_method.signature", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.METHOD,
    modifiers: () => ({ is_signature: true }),
  }],
  ["method.associated", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.METHOD,
    modifiers: () => ({ is_associated: true }),
  }],
  ["call.associated", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.METHOD,
    context: (node) => ({ call_type: "associated" }),
  }],
  ["first_param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.PARAMETER,
    context: (node) => ({ is_first_param: true }),
  }],
]);