/**
 * Rust capture mapping configuration
 *
 * Handles Rust's unique module system, ownership semantics, and type system
 */

import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig} from "../capture_types";

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
      modifiers: () => ({ is_closure: true  })},
  ],
  [
    "scope.impl",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.CLASS,
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
      modifiers: () => ({ is_unsafe: true  })},
  ],
  [
    "scope.match",
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

  // Enum definitions
  [
    "def.enum",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM,
    },
  ],
  [
    "def.enum_variant",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.ENUM_MEMBER,
    },
  ],

  // Function definitions
  [
    "def.function",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "def.function.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_async: true  })},
  ],
  [
    "def.function.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      },
  ],
  [
    "def.function.closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true  })},
  ],

  // Method definitions (within impl blocks)
  [
    "def.method",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_static: false })},
  ],

  // Associated functions (no self parameter - like static methods)
  [
    "def.method.associated",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_static: true })},
  ],

  // Constructor methods (new, default, etc.)
  [
    "def.constructor",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_static: true })},
  ],

  // Trait definitions
  [
    "def.trait",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.INTERFACE,
    },
  ],

  // Type aliases
  [
    "def.type_alias",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.TYPE_ALIAS,
    },
  ],

  // Constants and statics
  [
    "def.const",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CONSTANT,
    },
  ],
  [
    "def.static",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_static: true  })},
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
      }
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
    },
  ],
  [
    "def.param.self",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      },
  ],
  [
    "def.param.closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
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
      }
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
    "export.function",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.FUNCTION,
    },
  ],
  [
    "export.trait",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.INTERFACE,
    },
  ],
  [
    "export.reexport",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
    },
  ],

  // pub use patterns
  [
    "export.pub_use",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
      context: (node) => {
        // This captures the whole use_declaration node
        const context: any = {};

        // Find visibility modifier
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && child.type === 'visibility_modifier') {
            const visText = child.text;
            if (visText === 'pub') {
              context.visibility_level = 'public';
            } else if (visText === 'pub(crate)') {
              context.visibility_level = 'crate';
            } else if (visText === 'pub(super)') {
              context.visibility_level = 'super';
            } else if (visText.startsWith('pub(in ')) {
              context.visibility_level = 'restricted';
              context.visibility_path = visText.slice(7, -1); // Extract path from pub(in path)
            } else if (visText === 'pub(self)') {
              context.visibility_level = 'self';
            }
            break;
          }
        }

        return context;
      }
    },
  ],
  [
    "export.pub_use.alias",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
    },
  ],
  [
    "export.pub_use.source",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
    },
  ],
  [
    "export.pub_use.path",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
    },
  ],
  [
    "export.pub_use.name",
    {
      category: SemanticCategory.EXPORT,
      entity: SemanticEntity.IMPORT,
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
    },
  ],
  [
    "import.source",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
    },
  ],
  [
    "import.alias",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
    },
  ],
  [
    "import.list.item",
    {
      category: SemanticCategory.IMPORT,
      entity: SemanticEntity.IMPORT,
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
    },
  ],
  [
    "ref.associated_function",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      },
  ],
  [
    "ref.receiver",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
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
    },
  ],
  [
    "ref.assign.source",
    {
      category: SemanticCategory.ASSIGNMENT,
      entity: SemanticEntity.VARIABLE,
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
    },
  ],

  ["ownership.borrow_mut", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.OPERATOR,
    modifiers: () => ({ is_mutable_borrow: true  })},
  ],

  ["ownership.deref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.OPERATOR,
    },
  ],

  // Lifetimes
  ["lifetime.param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],

  ["lifetime.ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],

  // Traits and impls
  ["impl.trait", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.INTERFACE,
    },
  ],

  ["impl.inherent", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    },
  ],

  // Macros
  ["macro.call", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MACRO,
    },
  ],

  ["macro.definition", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.MACRO,
    },
  ],

  // Module system specifics
  ["module.crate_ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    },
  ],

  ["module.super_ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    },
  ],

  ["module.self_ref", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    },
  ],

  // Generic type parameters
  ["generic.type_param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],

  ["generic.constraint", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.TYPE_CONSTRAINT,
    },
  ],

  // Pattern matching
  ["pattern.match", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    },
  ],

  ["pattern.destructure", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    },
  ],

  // ============================================================================
  // ADDITIONAL MAPPINGS - Fill coverage gaps
  // ============================================================================

  // Generic structs and enums
  ["def.struct.generic", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["def.enum.generic", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.ENUM,
    },
  ],

  // Mutable variables
  ["def.variable.mut", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    modifiers: () => ({ is_mutable: true  })},
  ],
  ["def.variable.typed", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.VARIABLE,
    },
  ],

  // Trait methods
  ["def.trait_method", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.METHOD,
    },
  ],

  // Type parameters
  ["def.type_param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],
  ["def.type_param.constrained", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.TYPE_PARAMETER,
    },
  ],

  // Self parameter variations
  ["def.param.self.ref", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.PARAMETER,
    },
  ],

  // Struct/enum field definitions
  ["def.field", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.FIELD,
    },
  ],

  // Definition contexts
  ["struct.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["enum.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.ENUM,
    },
  ],
  ["trait.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.INTERFACE,
    },
  ],
  ["const.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CONSTANT,
    },
  ],
  ["static.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.VARIABLE,
    },
  ],
  ["function.definition", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.FUNCTION,
    },
  ],

  // Implementation contexts
  ["impl.type", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["impl.for_type", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["impl.for_type.trait", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["impl.trait_impl", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.INTERFACE,
    },
  ],

  // Generic and type contexts
  ["struct.generic", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["type.generic", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.TYPE,
    },
  ],
  ["type.args", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.TYPE_ARGUMENT,
    },
  ],

  // Variable binding contexts
  ["variable.binding", {
    category: SemanticCategory.ASSIGNMENT,
    entity: SemanticEntity.VARIABLE,
    },
  ],
  ["variable.binding.mut", {
    category: SemanticCategory.ASSIGNMENT,
    entity: SemanticEntity.VARIABLE,
    },
  ],
  ["variable.binding.typed", {
    category: SemanticCategory.ASSIGNMENT,
    entity: SemanticEntity.VARIABLE,
    },
  ],

  // Constructor references
  ["ref.constructor.struct", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["constructor.struct", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.CLASS,
    },
  ],

  // Additional exports
  ["export.const", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.CONSTANT,
    },
  ],
  ["export.enum", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.ENUM,
    },
  ],
  ["export.const_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.CONSTANT,
    },
  ],
  ["export.enum_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.ENUM,
    },
  ],
  ["export.struct_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.CLASS,
    },
  ],
  ["export.trait_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.INTERFACE,
    },
  ],
  ["export.function_item", {
    category: SemanticCategory.EXPORT,
    entity: SemanticEntity.FUNCTION,
    },
  ],

  // Scoped type references
  ["ref.type.scoped", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.TYPE,
    },
  ],
  ["ref.type.path", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.MODULE,
    },
  ],

  // Simple imports
  ["import.simple", {
    category: SemanticCategory.IMPORT,
    entity: SemanticEntity.IMPORT,
    },
  ],

  // Additional missing patterns
  ["variant.definition", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.ENUM_MEMBER,
    },
  ],
  ["trait_method.signature", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.METHOD,
    },
  ],
  ["method.associated", {
    category: SemanticCategory.TYPE,
    entity: SemanticEntity.METHOD,
    },
  ],
  ["call.associated", {
    category: SemanticCategory.REFERENCE,
    entity: SemanticEntity.METHOD,
    },
  ],
  ["first_param", {
    category: SemanticCategory.DEFINITION,
    entity: SemanticEntity.PARAMETER,
    },
  ],

  // ============================================================================
  // STATIC VS INSTANCE METHOD DETECTION
  // ============================================================================
  [
    "class.ref",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      context: () => ({
        is_static: true,
      }),
    },
  ],
  [
    "method.static",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: () => ({
        is_static: true,
      }),
    },
  ],
  [
    "instance.ref",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      context: () => ({
        is_static: false,
      }),
    },
  ],
  [
    "method.instance",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: () => ({
        is_static: false,
      }),
    },
  ],
  [
    "static_method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => {
        const scopedId = node.childForFieldName?.("function");
        const receiver = scopedId?.childForFieldName?.("path");
        return {
          receiver_node: receiver || undefined,
          is_call: true,
          is_static: true,
          is_associated_function: true,
        };
      },
    },
  ],
  [
    "instance_method_call",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      context: (node) => {
        const fieldExpr = node.childForFieldName?.("function");
        const receiver = fieldExpr?.childForFieldName?.("value");
        return {
          receiver_node: receiver || undefined,
          is_call: true,
          is_static: false,
        };
      },
    },
  ],
]);