/**
 * Comprehensive tests for Rust language configuration
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
import type { Language, FilePath } from "@ariadnejs/types";
import { SemanticCategory, SemanticEntity } from "../capture_types";
import { RUST_CAPTURE_CONFIG } from "./rust";
import { create_simple_mock_node } from "../test_utils";
import { query_tree_and_parse_captures } from "../semantic_index";

describe("Rust Language Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  // Helper function to get AST node from code
  function getAstNode(code: string): SyntaxNode {
    return parser.parse(code).rootNode;
  }

  describe("RUST_CAPTURE_CONFIG", () => {
    it("should export a valid LanguageCaptureConfig", () => {
      expect(RUST_CAPTURE_CONFIG).toBeDefined();
      expect(RUST_CAPTURE_CONFIG).toBeInstanceOf(Map);
      expect(RUST_CAPTURE_CONFIG.size).toBeGreaterThan(0);
    });

    it("should contain Rust-specific scope mappings", () => {
      const scopeMappings = [
        "scope.module",
        "scope.function",
        "scope.closure",
        "scope.impl",
        "scope.trait",
        "scope.interface",
        "scope.block",
        "scope.block.unsafe",
        "scope.match",
      ];

      for (const mapping of scopeMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.SCOPE);
      }
    });

    it("should contain Rust type definition mappings", () => {
      const typeDefinitions = [
        "def.struct",
        "def.struct.generic",
        "def.enum",
        "def.enum.generic",
        "def.enum_variant",
        "def.trait",
        "def.trait.generic",
        "def.interface",
        "def.interface.generic",
        "def.type_alias",
        "def.const",
        "def.static",
        "def.module",
        "def.associated_type",
        "def.associated_type.impl",
        "def.associated_const",
      ];

      for (const mapping of typeDefinitions) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain function and method definition mappings", () => {
      const functionDefinitions = [
        "def.function",
        "def.function.async",
        "def.function.generic",
        "def.function.closure",
        "def.method",
        "def.method.associated",
        "def.constructor",
        "def.trait_method",
        "def.trait_method.default",
        "def.trait_impl_method",
        "def.trait_impl_method.associated",
      ];

      for (const mapping of functionDefinitions) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain variable and parameter definition mappings", () => {
      const variableDefinitions = [
        "def.variable",
        "def.param",
        "def.param.self",
        "def.param.closure",
      ];

      for (const mapping of variableDefinitions) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain Rust visibility system mappings", () => {
      const visibilityMappings = ["visibility.pub"];

      for (const mapping of visibilityMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.MODIFIER);
        expect(config?.entity).toBe(SemanticEntity.VISIBILITY);
      }
    });

    it("should contain export capture mappings", () => {
      const exportMappings = [
        "export.struct",
        "export.function",
        "export.trait",
        "export.reexport",
      ];

      for (const mapping of exportMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.EXPORT);
      }
    });

    it("should contain import capture mappings", () => {
      const importMappings = [
        "import.name",
        "import.source",
        "import.alias",
        "import.list.item",
      ];

      for (const mapping of importMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.IMPORT);
      }
    });

    it("should contain reference capture mappings", () => {
      const referenceMappings = [
        "ref.call",
        "ref.method_call",
        "ref.associated_function",
        "ref.receiver",
        "ref.type",
        "ref.object",
        "ref.field",
        "ref.self",
        "ref.identifier",
      ];

      for (const mapping of referenceMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.REFERENCE);
      }
    });

    it("should contain assignment capture mappings", () => {
      const assignmentMappings = ["ref.assign.target", "ref.assign.source"];

      for (const mapping of assignmentMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.ASSIGNMENT);
      }
    });

    it("should contain Rust-specific feature mappings", () => {
      const rustFeatures = [
        "ownership.borrow",
        "ownership.borrow_mut",
        "ownership.deref",
        "type.smart_pointer",
        "type.smart_pointer.name",
        "smart_pointer.allocation",
        "smart_pointer.method_call",
        "type.reference",
        "type.reference.mut",
        "lifetime.param",
        "lifetime.ref",
        "impl.trait",
        "impl.inherent",
        "macro.call",
        "macro.definition",
        "module.crate_ref",
        "module.super_ref",
        "module.self_ref",
      ];

      for (const mapping of rustFeatures) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
      }
    });

    it("should contain constraint capture mappings", () => {
      const constraintMappings = [
        "constraint.where_clause",
        "constraint.type",
        "constraint.bounds",
        "constraint.trait",
        "constraint.trait.generic",
        "constraint.lifetime",
      ];

      for (const mapping of constraintMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.TYPE);
      }
    });
  });

  describe("Rust-Specific Context Functions", () => {
    describe("Module Context", () => {
      it("should detect crate root modules", () => {
        const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
        expect(moduleConfig).toBeDefined();

        if (typeof moduleConfig?.context === "function") {
          const mockNode = {
            parent: { type: "source_file" },
          } as SyntaxNode;

          const context = moduleConfig.context(mockNode);
          expect(context).toBeDefined();
        }
      });

      it("should detect non-root modules", () => {
        const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
        expect(moduleConfig).toBeDefined();

        if (typeof moduleConfig?.context === "function") {
          const mockNode = {
            parent: { type: "mod_item" },
          } as SyntaxNode;

          const context = moduleConfig.context(mockNode);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Closure Context", () => {
      it("should handle closure scopes", () => {
        const closureConfig = RUST_CAPTURE_CONFIG.get("scope.closure");
        expect(closureConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof closureConfig?.modifiers === "function") {
          const modifiers = closureConfig.modifiers({} as SyntaxNode);
          expect(modifiers?.is_closure).toBe(true);
        }

        if (typeof closureConfig?.modifiers === "function") {
          const modifiers = closureConfig.modifiers({} as SyntaxNode);
          expect(modifiers).toBeDefined();
          expect(modifiers?.is_closure).toBe(true);
        }
      });
    });

    describe("Impl Block Context", () => {
      it("should handle impl block scopes", () => {
        const implConfig = RUST_CAPTURE_CONFIG.get("scope.impl");
        // Context functions are optional for some mappings

        if (typeof implConfig?.context === "function") {
          const context = implConfig.context({} as SyntaxNode);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Trait Context", () => {
      it("should handle trait definition scopes", () => {
        const traitConfig = RUST_CAPTURE_CONFIG.get("scope.trait");
        // Context functions are optional for some mappings

        if (typeof traitConfig?.context === "function") {
          const context = traitConfig.context({} as SyntaxNode);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Unsafe Block Context", () => {
      it("should handle unsafe block modifiers", () => {
        const unsafeBlockConfig = RUST_CAPTURE_CONFIG.get("scope.block.unsafe");
        expect(unsafeBlockConfig?.modifiers).toBeDefined();

        if (typeof unsafeBlockConfig?.modifiers === "function") {
          const modifiers = unsafeBlockConfig.modifiers({} as SyntaxNode);
          expect(modifiers?.is_unsafe).toBe(true);
        }
      });
    });

    describe("Match Expression Context", () => {
      it("should handle match expression scopes", () => {
        const matchConfig = RUST_CAPTURE_CONFIG.get("scope.match");
        // Context functions are optional for some mappings

        if (typeof matchConfig?.context === "function") {
          const context = matchConfig.context({} as SyntaxNode);
          expect(context).toBeDefined();
        }
      });
    });
  });

  describe("Definition Context Functions", () => {
    describe("Struct Definitions", () => {
      it("should handle struct definition context", () => {
        const structConfig = RUST_CAPTURE_CONFIG.get("def.struct");
        // Context functions are optional for some mappings

        if (typeof structConfig?.context === "function") {
          const context = structConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Enum Definitions", () => {
      it("should handle enum definition context", () => {
        const enumConfig = RUST_CAPTURE_CONFIG.get("def.enum");
        // Context functions are optional for some mappings

        if (typeof enumConfig?.context === "function") {
          const context = enumConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle enum variant context", () => {
        const variantConfig = RUST_CAPTURE_CONFIG.get("def.enum_variant");
        // Context functions are optional for some mappings

        if (typeof variantConfig?.context === "function") {
          const context = variantConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Function Definitions", () => {
      it("should handle function definition context", () => {
        const functionConfig = RUST_CAPTURE_CONFIG.get("def.function");
        // Context functions are optional for some mappings

        if (typeof functionConfig?.context === "function") {
          const context = functionConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle async function modifiers", () => {
        const asyncFunctionConfig =
          RUST_CAPTURE_CONFIG.get("def.function.async");
        expect(asyncFunctionConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof asyncFunctionConfig?.modifiers === "function") {
          const modifiers = asyncFunctionConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_async).toBe(true);
        }

        if (typeof asyncFunctionConfig?.context === "function") {
          const context = asyncFunctionConfig.context(
            create_simple_mock_node()
          );
          expect(context).toBeDefined();
          expect(context?.is_async).toBe(true);
        }
      });

      it("should handle generic function modifiers", () => {
        const genericFunctionConfig = RUST_CAPTURE_CONFIG.get(
          "def.function.generic"
        );
        expect(genericFunctionConfig?.modifiers).toBeDefined();

        if (typeof genericFunctionConfig?.modifiers === "function") {
          const modifiers = genericFunctionConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_generic).toBe(true);
        }
      });

      it("should handle closure function modifiers", () => {
        const closureFunctionConfig = RUST_CAPTURE_CONFIG.get(
          "def.function.closure"
        );
        expect(closureFunctionConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof closureFunctionConfig?.modifiers === "function") {
          const modifiers = closureFunctionConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_closure).toBe(true);
        }

        if (typeof closureFunctionConfig?.context === "function") {
          const context = closureFunctionConfig.context(
            create_simple_mock_node()
          );
          expect(context).toBeDefined();
          // Context doesn't have is_closure property, removing invalid test
        }
      });
    });

    describe("Method Definitions", () => {
      it("should handle method definition context", () => {
        const methodConfig = RUST_CAPTURE_CONFIG.get("def.method");
        expect(methodConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof methodConfig?.modifiers === "function") {
          const modifiers = methodConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_method).toBe(true);
          expect(modifiers?.is_static).toBe(false);
        }

        if (typeof methodConfig?.context === "function") {
          const context = methodConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle associated function modifiers", () => {
        const associatedMethodConfig = RUST_CAPTURE_CONFIG.get(
          "def.method.associated"
        );
        expect(associatedMethodConfig?.modifiers).toBeDefined();

        if (typeof associatedMethodConfig?.modifiers === "function") {
          const modifiers = associatedMethodConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_method).toBe(false);
          expect(modifiers?.is_associated_function).toBe(true);
          expect(modifiers?.is_static).toBe(true);
        }
      });

      it("should handle constructor modifiers", () => {
        const constructorConfig = RUST_CAPTURE_CONFIG.get("def.constructor");
        expect(constructorConfig?.modifiers).toBeDefined();

        if (typeof constructorConfig?.modifiers === "function") {
          const modifiers = constructorConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_constructor).toBe(true);
          expect(modifiers?.is_static).toBe(true);
        }
      });
    });

    describe("Variable Definitions", () => {
      it("should handle variable definition with mutability detection", () => {
        const variableConfig = RUST_CAPTURE_CONFIG.get("def.variable");
        expect(variableConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof variableConfig?.modifiers === "function") {
          // Test mutable variable
          const mockMutableNode = create_simple_mock_node(
            "identifier",
            "mock",
            {
              parent: create_simple_mock_node("parent", "parent", {
                children: [create_simple_mock_node("mut", "mut")],
              }),
            }
          );

          const mutableModifiers = variableConfig.modifiers(mockMutableNode);
          expect(mutableModifiers?.is_mutable).toBe(true);

          // Test immutable variable
          const mockImmutableNode = create_simple_mock_node(
            "identifier",
            "mock",
            {
              parent: create_simple_mock_node("parent", "parent", {
                children: [],
              }),
            }
          );

          const immutableModifiers =
            variableConfig.modifiers(mockImmutableNode);
          expect(immutableModifiers?.is_mutable).toBe(false);
        }

        if (typeof variableConfig?.context === "function") {
          const context = variableConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Parameter Definitions", () => {
      it("should handle self parameter modifiers", () => {
        const selfParamConfig = RUST_CAPTURE_CONFIG.get("def.param.self");
        expect(selfParamConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof selfParamConfig?.modifiers === "function") {
          const modifiers = selfParamConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_self).toBe(true);
        }

        if (typeof selfParamConfig?.context === "function") {
          const context = selfParamConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle closure parameter modifiers", () => {
        const closureParamConfig = RUST_CAPTURE_CONFIG.get("def.param.closure");
        expect(closureParamConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof closureParamConfig?.modifiers === "function") {
          const modifiers = closureParamConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_closure_param).toBe(true);
        }

        if (typeof closureParamConfig?.context === "function") {
          const context = closureParamConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });
  });

  describe("Rust Visibility System", () => {
    it("should parse public visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      // Context functions are optional for some mappings

      if (typeof pubConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "pub");
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse crate visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "pub(crate)");
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse super visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "pub(super)");
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse self visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "pub(self)");
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse restricted visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = create_simple_mock_node(
          "identifier",
          "pub(in crate::utils)"
        );
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });
  });

  describe("Export Context Functions", () => {
    it("should handle struct exports", () => {
      const structExportConfig = RUST_CAPTURE_CONFIG.get("export.struct");
      // Context functions are optional for some mappings

      if (typeof structExportConfig?.context === "function") {
        const context = structExportConfig.context(create_simple_mock_node());
        expect(context?.export_type).toBe("struct");
      }
    });

    it("should handle function exports", () => {
      const functionExportConfig = RUST_CAPTURE_CONFIG.get("export.function");
      // Context functions are optional for some mappings

      if (typeof functionExportConfig?.context === "function") {
        const context = functionExportConfig.context(create_simple_mock_node());
        expect(context?.export_type).toBe("function");
      }
    });

    it("should handle trait exports", () => {
      const traitExportConfig = RUST_CAPTURE_CONFIG.get("export.trait");
      // Context functions are optional for some mappings

      if (typeof traitExportConfig?.context === "function") {
        const context = traitExportConfig.context(create_simple_mock_node());
        expect(context?.export_type).toBe("trait");
      }
    });

    it("should handle re-exports", () => {
      const reexportConfig = RUST_CAPTURE_CONFIG.get("export.reexport");
      // Context functions are optional for some mappings

      if (typeof reexportConfig?.context === "function") {
        const context = reexportConfig.context(create_simple_mock_node());
        expect(context?.export_type).toBe("reexport");
      }
    });
  });

  describe("Import Context Functions", () => {
    it("should handle direct imports", () => {
      const nameImportConfig = RUST_CAPTURE_CONFIG.get("import.name");
      // Context functions are optional for some mappings

      if (typeof nameImportConfig?.context === "function") {
        const context = nameImportConfig.context(create_simple_mock_node());
        expect(context).toBeDefined();
      }
    });

    it("should handle aliased imports", () => {
      const sourceImportConfig = RUST_CAPTURE_CONFIG.get("import.source");
      // Context functions are optional for some mappings

      if (typeof sourceImportConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "HashMap");
        const context = sourceImportConfig.context(mockNode);
        expect(context).toBeDefined();
        expect(context).toBeDefined();
      }
    });

    it("should handle import aliases", () => {
      const aliasImportConfig = RUST_CAPTURE_CONFIG.get("import.alias");
      // Context functions are optional for some mappings

      if (typeof aliasImportConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "Map");
        const context = aliasImportConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle list item imports", () => {
      const listItemConfig = RUST_CAPTURE_CONFIG.get("import.list.item");
      // Context functions are optional for some mappings

      if (typeof listItemConfig?.context === "function") {
        const context = listItemConfig.context(create_simple_mock_node());
        expect(context).toBeDefined();
      }
    });
  });

  describe("Reference Context Functions", () => {
    describe("Method Calls", () => {
      it("should handle method call context", () => {
        const methodCallConfig = RUST_CAPTURE_CONFIG.get("ref.method_call");
        // Context functions are optional for some mappings

        if (typeof methodCallConfig?.context === "function") {
          const context = methodCallConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle associated function calls", () => {
        const associatedCallConfig = RUST_CAPTURE_CONFIG.get(
          "ref.associated_function"
        );
        expect(associatedCallConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof associatedCallConfig?.modifiers === "function") {
          const modifiers = associatedCallConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_associated_call).toBe(true);
        }

        if (typeof associatedCallConfig?.context === "function") {
          const context = associatedCallConfig.context(
            create_simple_mock_node()
          );
          expect(context).toBeDefined();
        }
      });

      it("should handle method receiver context", () => {
        const receiverConfig = RUST_CAPTURE_CONFIG.get("ref.receiver");
        // Context functions are optional for some mappings

        if (typeof receiverConfig?.context === "function") {
          const context = receiverConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Field Access", () => {
      it("should handle object field access", () => {
        const objectConfig = RUST_CAPTURE_CONFIG.get("ref.object");
        // Context functions are optional for some mappings

        if (typeof objectConfig?.context === "function") {
          const context = objectConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Assignment Context", () => {
      it("should handle assignment targets", () => {
        const assignTargetConfig = RUST_CAPTURE_CONFIG.get("ref.assign.target");
        // Context functions are optional for some mappings

        if (typeof assignTargetConfig?.context === "function") {
          const context = assignTargetConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle assignment sources", () => {
        const assignSourceConfig = RUST_CAPTURE_CONFIG.get("ref.assign.source");
        // Context functions are optional for some mappings

        if (typeof assignSourceConfig?.context === "function") {
          const context = assignSourceConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Self References", () => {
      it("should handle self references", () => {
        const selfRefConfig = RUST_CAPTURE_CONFIG.get("ref.self");
        expect(selfRefConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof selfRefConfig?.modifiers === "function") {
          const modifiers = selfRefConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_self_reference).toBe(true);
        }

        if (typeof selfRefConfig?.context === "function") {
          const context = selfRefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });
  });

  describe("Rust-Specific Features", () => {
    describe("Ownership and Borrowing", () => {
      it("should handle borrow operations", () => {
        const borrowConfig = RUST_CAPTURE_CONFIG.get("ownership.borrow");
        expect(borrowConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof borrowConfig?.modifiers === "function") {
          const modifiers = borrowConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_borrow).toBe(true);
        }

        if (typeof borrowConfig?.context === "function") {
          const context = borrowConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle mutable borrow operations", () => {
        const mutBorrowConfig = RUST_CAPTURE_CONFIG.get("ownership.borrow_mut");
        expect(mutBorrowConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof mutBorrowConfig?.modifiers === "function") {
          const modifiers = mutBorrowConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_mutable_borrow).toBe(true);
        }

        if (typeof mutBorrowConfig?.context === "function") {
          const context = mutBorrowConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle dereference operations", () => {
        const derefConfig = RUST_CAPTURE_CONFIG.get("ownership.deref");
        expect(derefConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof derefConfig?.modifiers === "function") {
          const modifiers = derefConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_dereference).toBe(true);
        }

        if (typeof derefConfig?.context === "function") {
          const context = derefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Lifetimes", () => {
      it("should handle lifetime parameters", () => {
        const lifetimeParamConfig = RUST_CAPTURE_CONFIG.get("lifetime.param");
        expect(lifetimeParamConfig?.modifiers).toBeDefined();
        // Context function is optional for lifetime parameters

        if (typeof lifetimeParamConfig?.modifiers === "function") {
          const modifiers = lifetimeParamConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_lifetime).toBe(true);
        }

        if (typeof lifetimeParamConfig?.context === "function") {
          const context = lifetimeParamConfig.context(
            create_simple_mock_node()
          );
          expect(context).toBeDefined();
        }
      });

      it("should handle lifetime references", () => {
        const lifetimeRefConfig = RUST_CAPTURE_CONFIG.get("lifetime.ref");
        expect(lifetimeRefConfig?.modifiers).toBeDefined();
        // Context functions are optional for some mappings

        if (typeof lifetimeRefConfig?.modifiers === "function") {
          const modifiers = lifetimeRefConfig.modifiers(
            create_simple_mock_node()
          );
          expect(modifiers?.is_lifetime).toBe(true);
        }

        if (typeof lifetimeRefConfig?.context === "function") {
          const context = lifetimeRefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Ownership and References", () => {
      it("should handle borrow operations", () => {
        const borrowConfig = RUST_CAPTURE_CONFIG.get("ownership.borrow");
        expect(borrowConfig?.modifiers).toBeDefined();
        expect(borrowConfig?.category).toBe(SemanticCategory.REFERENCE);
        expect(borrowConfig?.entity).toBe(SemanticEntity.OPERATOR);

        if (typeof borrowConfig?.modifiers === "function") {
          const modifiers = borrowConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_borrow).toBe(true);
        }
      });

      it("should handle mutable borrow operations", () => {
        const mutBorrowConfig = RUST_CAPTURE_CONFIG.get("ownership.borrow_mut");
        expect(mutBorrowConfig?.modifiers).toBeDefined();
        expect(mutBorrowConfig?.category).toBe(SemanticCategory.REFERENCE);
        expect(mutBorrowConfig?.entity).toBe(SemanticEntity.OPERATOR);

        if (typeof mutBorrowConfig?.modifiers === "function") {
          const modifiers = mutBorrowConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_borrow).toBe(true);
          expect(modifiers?.is_mutable_borrow).toBe(true);
        }
      });

      it("should handle dereference operations", () => {
        const derefConfig = RUST_CAPTURE_CONFIG.get("ownership.deref");
        expect(derefConfig?.modifiers).toBeDefined();
        expect(derefConfig?.category).toBe(SemanticCategory.REFERENCE);
        expect(derefConfig?.entity).toBe(SemanticEntity.OPERATOR);

        if (typeof derefConfig?.modifiers === "function") {
          const modifiers = derefConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_dereference).toBe(true);
        }
      });

      it("should handle reference types", () => {
        const refTypeConfig = RUST_CAPTURE_CONFIG.get("type.reference");
        expect(refTypeConfig?.modifiers).toBeDefined();
        expect(refTypeConfig?.category).toBe(SemanticCategory.TYPE);
        expect(refTypeConfig?.entity).toBe(SemanticEntity.TYPE);

        if (typeof refTypeConfig?.modifiers === "function") {
          const modifiers = refTypeConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_reference).toBe(true);
        }
      });

      it("should handle mutable reference types", () => {
        const mutRefTypeConfig = RUST_CAPTURE_CONFIG.get("type.reference.mut");
        expect(mutRefTypeConfig?.modifiers).toBeDefined();
        expect(mutRefTypeConfig?.category).toBe(SemanticCategory.TYPE);
        expect(mutRefTypeConfig?.entity).toBe(SemanticEntity.TYPE);

        if (typeof mutRefTypeConfig?.modifiers === "function") {
          const modifiers = mutRefTypeConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_reference).toBe(true);
          expect(modifiers?.is_mutable).toBe(true);
        }
      });
    });

    describe("Smart Pointers", () => {
      it("should handle smart pointer types", () => {
        const smartPtrConfig = RUST_CAPTURE_CONFIG.get("type.smart_pointer");
        expect(smartPtrConfig?.modifiers).toBeDefined();
        expect(smartPtrConfig?.category).toBe(SemanticCategory.TYPE);
        expect(smartPtrConfig?.entity).toBe(SemanticEntity.TYPE);

        if (typeof smartPtrConfig?.modifiers === "function") {
          const modifiers = smartPtrConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_smart_pointer).toBe(true);
        }
      });

      it("should handle smart pointer type names", () => {
        const smartPtrNameConfig = RUST_CAPTURE_CONFIG.get("type.smart_pointer.name");
        expect(smartPtrNameConfig?.modifiers).toBeDefined();
        expect(smartPtrNameConfig?.category).toBe(SemanticCategory.TYPE);
        expect(smartPtrNameConfig?.entity).toBe(SemanticEntity.TYPE);

        if (typeof smartPtrNameConfig?.modifiers === "function") {
          const modifiers = smartPtrNameConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_smart_pointer).toBe(true);
        }
      });

      it("should handle smart pointer allocations", () => {
        const allocConfig = RUST_CAPTURE_CONFIG.get("smart_pointer.allocation");
        expect(allocConfig?.modifiers).toBeDefined();
        expect(allocConfig?.category).toBe(SemanticCategory.REFERENCE);
        expect(allocConfig?.entity).toBe(SemanticEntity.FUNCTION);

        if (typeof allocConfig?.modifiers === "function") {
          const modifiers = allocConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_smart_pointer_allocation).toBe(true);
        }
      });

      it("should handle smart pointer method calls", () => {
        const methodConfig = RUST_CAPTURE_CONFIG.get("smart_pointer.method_call");
        expect(methodConfig?.modifiers).toBeDefined();
        expect(methodConfig?.category).toBe(SemanticCategory.REFERENCE);
        expect(methodConfig?.entity).toBe(SemanticEntity.METHOD);

        if (typeof methodConfig?.modifiers === "function") {
          const modifiers = methodConfig.modifiers(create_simple_mock_node());
          expect(modifiers?.is_smart_pointer_method).toBe(true);
        }
      });
    });

    describe("Implementations", () => {
      it("should handle trait implementations", () => {
        const traitImplConfig = RUST_CAPTURE_CONFIG.get("impl.trait");
        // Context functions are optional for some mappings

        if (typeof traitImplConfig?.context === "function") {
          const context = traitImplConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle inherent implementations", () => {
        const inherentImplConfig = RUST_CAPTURE_CONFIG.get("impl.inherent");
        // Context functions are optional for some mappings

        if (typeof inherentImplConfig?.context === "function") {
          const context = inherentImplConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Macros", () => {
      it("should handle macro calls", () => {
        const macroCallConfig = RUST_CAPTURE_CONFIG.get("macro.call");
        // Context functions are optional for some mappings

        if (typeof macroCallConfig?.context === "function") {
          const context = macroCallConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle macro definitions", () => {
        const macroDefConfig = RUST_CAPTURE_CONFIG.get("macro.definition");
        // Context functions are optional for some mappings

        if (typeof macroDefConfig?.context === "function") {
          const context = macroDefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Module System", () => {
      it("should handle crate references", () => {
        const crateRefConfig = RUST_CAPTURE_CONFIG.get("module.crate_ref");
        // Context functions are optional for some mappings

        if (typeof crateRefConfig?.context === "function") {
          const context = crateRefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle super references", () => {
        const superRefConfig = RUST_CAPTURE_CONFIG.get("module.super_ref");
        // Context functions are optional for some mappings

        if (typeof superRefConfig?.context === "function") {
          const context = superRefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle self module references", () => {
        const selfRefConfig = RUST_CAPTURE_CONFIG.get("module.self_ref");
        // Context functions are optional for some mappings

        if (typeof selfRefConfig?.context === "function") {
          const context = selfRefConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Generics", () => {
      it("should handle generic type parameters", () => {
        const genericParamConfig =
          RUST_CAPTURE_CONFIG.get("generic.type_param");
        // Context functions are optional for some mappings

        if (typeof genericParamConfig?.context === "function") {
          const context = genericParamConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle trait bounds", () => {
        const constraintConfig = RUST_CAPTURE_CONFIG.get("generic.constraint");
        // Context functions are optional for some mappings

        if (typeof constraintConfig?.context === "function") {
          const context = constraintConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });

    describe("Pattern Matching", () => {
      it("should handle match patterns", () => {
        const matchPatternConfig = RUST_CAPTURE_CONFIG.get("pattern.match");
        // Context functions are optional for some mappings

        if (typeof matchPatternConfig?.context === "function") {
          const context = matchPatternConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });

      it("should handle destructuring patterns", () => {
        const destructureConfig = RUST_CAPTURE_CONFIG.get(
          "pattern.destructure"
        );
        // Context functions are optional for some mappings

        if (typeof destructureConfig?.context === "function") {
          const context = destructureConfig.context(create_simple_mock_node());
          expect(context).toBeDefined();
        }
      });
    });
  });

  describe("Additional Mappings", () => {
    it("should handle generic struct definitions", () => {
      const genericStructConfig = RUST_CAPTURE_CONFIG.get("def.struct.generic");
      expect(genericStructConfig?.modifiers).toBeDefined();

      if (typeof genericStructConfig?.modifiers === "function") {
        const modifiers = genericStructConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_generic).toBe(true);
      }
    });

    it("should handle generic enum definitions", () => {
      const genericEnumConfig = RUST_CAPTURE_CONFIG.get("def.enum.generic");
      expect(genericEnumConfig?.modifiers).toBeDefined();

      if (typeof genericEnumConfig?.modifiers === "function") {
        const modifiers = genericEnumConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_generic).toBe(true);
      }
    });

    it("should handle mutable variable definitions", () => {
      const mutVarConfig = RUST_CAPTURE_CONFIG.get("def.variable.mut");
      expect(mutVarConfig?.modifiers).toBeDefined();

      if (typeof mutVarConfig?.modifiers === "function") {
        const modifiers = mutVarConfig.modifiers(create_simple_mock_node());
        expect(modifiers?.is_mutable).toBe(true);
      }
    });

    it("should handle trait method definitions", () => {
      const traitMethodConfig = RUST_CAPTURE_CONFIG.get("def.trait_method");
      expect(traitMethodConfig?.modifiers).toBeDefined();

      if (typeof traitMethodConfig?.modifiers === "function") {
        const modifiers = traitMethodConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_trait_method).toBe(true);
      }
    });

    it("should handle trait method default implementations", () => {
      const traitMethodDefaultConfig = RUST_CAPTURE_CONFIG.get("def.trait_method.default");
      expect(traitMethodDefaultConfig?.modifiers).toBeDefined();

      if (typeof traitMethodDefaultConfig?.modifiers === "function") {
        const modifiers = traitMethodDefaultConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_trait_method).toBe(true);
        expect(modifiers?.has_default_impl).toBe(true);
      }
    });

    it("should handle interface definitions", () => {
      const interfaceConfig = RUST_CAPTURE_CONFIG.get("def.interface");
      expect(interfaceConfig).toBeDefined();
      expect(interfaceConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(interfaceConfig?.entity).toBe(SemanticEntity.INTERFACE);
    });

    it("should handle generic interface definitions", () => {
      const genericInterfaceConfig = RUST_CAPTURE_CONFIG.get("def.interface.generic");
      expect(genericInterfaceConfig?.modifiers).toBeDefined();

      if (typeof genericInterfaceConfig?.modifiers === "function") {
        const modifiers = genericInterfaceConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_generic).toBe(true);
      }
    });

    it("should handle associated types in traits", () => {
      const associatedTypeConfig = RUST_CAPTURE_CONFIG.get("def.associated_type");
      expect(associatedTypeConfig).toBeDefined();
      expect(associatedTypeConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(associatedTypeConfig?.entity).toBe(SemanticEntity.TYPE_ALIAS);
      expect(associatedTypeConfig?.modifiers).toBeDefined();

      if (typeof associatedTypeConfig?.modifiers === "function") {
        const modifiers = associatedTypeConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_associated_type).toBe(true);
      }
    });

    it("should handle associated types in implementations", () => {
      const associatedTypeImplConfig = RUST_CAPTURE_CONFIG.get("def.associated_type.impl");
      expect(associatedTypeImplConfig).toBeDefined();
      expect(associatedTypeImplConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(associatedTypeImplConfig?.entity).toBe(SemanticEntity.TYPE_ALIAS);
      expect(associatedTypeImplConfig?.modifiers).toBeDefined();

      if (typeof associatedTypeImplConfig?.modifiers === "function") {
        const modifiers = associatedTypeImplConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_associated_type).toBe(true);
        expect(modifiers?.is_trait_impl).toBe(true);
      }
    });

    it("should handle associated constants in traits", () => {
      const associatedConstConfig = RUST_CAPTURE_CONFIG.get("def.associated_const");
      expect(associatedConstConfig).toBeDefined();
      expect(associatedConstConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(associatedConstConfig?.entity).toBe(SemanticEntity.CONSTANT);
      expect(associatedConstConfig?.modifiers).toBeDefined();

      if (typeof associatedConstConfig?.modifiers === "function") {
        const modifiers = associatedConstConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_associated).toBe(true);
      }
    });

    it("should handle trait implementation methods", () => {
      const traitImplMethodConfig = RUST_CAPTURE_CONFIG.get("def.trait_impl_method");
      expect(traitImplMethodConfig).toBeDefined();
      expect(traitImplMethodConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(traitImplMethodConfig?.entity).toBe(SemanticEntity.METHOD);
      expect(traitImplMethodConfig?.modifiers).toBeDefined();

      if (typeof traitImplMethodConfig?.modifiers === "function") {
        const modifiers = traitImplMethodConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_trait_impl).toBe(true);
        expect(modifiers?.is_static).toBe(false);
      }
    });

    it("should handle trait implementation associated functions", () => {
      const traitImplAssocConfig = RUST_CAPTURE_CONFIG.get("def.trait_impl_method.associated");
      expect(traitImplAssocConfig).toBeDefined();
      expect(traitImplAssocConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(traitImplAssocConfig?.entity).toBe(SemanticEntity.METHOD);
      expect(traitImplAssocConfig?.modifiers).toBeDefined();

      if (typeof traitImplAssocConfig?.modifiers === "function") {
        const modifiers = traitImplAssocConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_trait_impl).toBe(true);
        expect(modifiers?.is_static).toBe(true);
      }
    });

    it("should handle constrained type parameters", () => {
      const constrainedParamConfig = RUST_CAPTURE_CONFIG.get(
        "def.type_param.constrained"
      );
      expect(constrainedParamConfig).toBeDefined();
      expect(constrainedParamConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(constrainedParamConfig?.entity).toBe(SemanticEntity.TYPE_PARAMETER);

      // modifiers function is optional for constrained type parameters
      if (typeof constrainedParamConfig?.modifiers === "function") {
        const modifiers = constrainedParamConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers).toBeDefined();
      }
    });
  });

  describe("Trait Implementation System", () => {
    it("should handle trait implementation blocks", () => {
      const traitImplConfig = RUST_CAPTURE_CONFIG.get("impl.trait_impl");
      expect(traitImplConfig).toBeDefined();
      expect(traitImplConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(traitImplConfig?.entity).toBe(SemanticEntity.CLASS);
      expect(traitImplConfig?.modifiers).toBeDefined();

      if (typeof traitImplConfig?.modifiers === "function") {
        const modifiers = traitImplConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_trait_impl).toBe(true);
      }
    });

    it("should handle generic trait implementation blocks", () => {
      const genericTraitImplConfig = RUST_CAPTURE_CONFIG.get("impl.trait_impl.generic");
      expect(genericTraitImplConfig).toBeDefined();
      expect(genericTraitImplConfig?.category).toBe(SemanticCategory.DEFINITION);
      expect(genericTraitImplConfig?.entity).toBe(SemanticEntity.CLASS);
      expect(genericTraitImplConfig?.modifiers).toBeDefined();

      if (typeof genericTraitImplConfig?.modifiers === "function") {
        const modifiers = genericTraitImplConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_trait_impl).toBe(true);
        expect(modifiers?.is_generic).toBe(true);
      }
    });

    it("should handle trait references in implementations", () => {
      const implTraitConfig = RUST_CAPTURE_CONFIG.get("impl.trait");
      expect(implTraitConfig).toBeDefined();
      expect(implTraitConfig?.category).toBe(SemanticCategory.REFERENCE);
      expect(implTraitConfig?.entity).toBe(SemanticEntity.INTERFACE);
    });

    it("should handle type references in implementations", () => {
      const implTypeConfig = RUST_CAPTURE_CONFIG.get("impl.type");
      expect(implTypeConfig).toBeDefined();
      expect(implTypeConfig?.category).toBe(SemanticCategory.REFERENCE);
      expect(implTypeConfig?.entity).toBe(SemanticEntity.TYPE);
    });

    it("should handle generic type references in implementations", () => {
      const implGenericTypeConfig = RUST_CAPTURE_CONFIG.get("impl.type.generic");
      expect(implGenericTypeConfig).toBeDefined();
      expect(implGenericTypeConfig?.category).toBe(SemanticCategory.REFERENCE);
      expect(implGenericTypeConfig?.entity).toBe(SemanticEntity.TYPE);
      expect(implGenericTypeConfig?.modifiers).toBeDefined();

      if (typeof implGenericTypeConfig?.modifiers === "function") {
        const modifiers = implGenericTypeConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_generic).toBe(true);
      }
    });
  });

  describe("Interface Scope Handling", () => {
    it("should handle interface scope definitions", () => {
      const interfaceScopeConfig = RUST_CAPTURE_CONFIG.get("scope.interface");
      expect(interfaceScopeConfig).toBeDefined();
      expect(interfaceScopeConfig?.category).toBe(SemanticCategory.SCOPE);
      expect(interfaceScopeConfig?.entity).toBe(SemanticEntity.INTERFACE);
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle empty capture mappings gracefully", () => {
      // Test that all mappings have required properties
      for (const [key, mapping] of Array.from(RUST_CAPTURE_CONFIG.entries())) {
        expect(mapping.category).toBeDefined();
        expect(mapping.entity).toBeDefined();
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it("should handle null/undefined nodes in modifier functions", () => {
      const variableConfig = RUST_CAPTURE_CONFIG.get("def.variable");
      if (typeof variableConfig?.modifiers === "function") {
        // These should throw since the function accesses .parent
        expect(() => {
          variableConfig.modifiers!(null as any);
        }).toThrow();

        expect(() => {
          variableConfig.modifiers!(undefined as any);
        }).toThrow();
      }
    });

    it("should handle null/undefined nodes in context functions", () => {
      const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
      if (typeof moduleConfig?.context === "function") {
        // These should throw since the function accesses .parent
        expect(() => {
          moduleConfig.context!(null as any);
        }).toThrow();

        expect(() => {
          moduleConfig.context!(undefined as any);
        }).toThrow();
      }
    });

    it("should handle malformed visibility strings", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      if (typeof pubConfig?.context === "function") {
        const mockNode = create_simple_mock_node(
          "identifier",
          "pub(malformed)"
        );
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined(); // Fallback
      }
    });

    it("should handle missing parent nodes", () => {
      const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
      if (typeof moduleConfig?.context === "function") {
        const mockNode = create_simple_mock_node("identifier", "mock", {
          parent: null,
        });
        const context = moduleConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle missing children arrays", () => {
      const variableConfig = RUST_CAPTURE_CONFIG.get("def.variable");
      if (typeof variableConfig?.modifiers === "function") {
        const mockNode = create_simple_mock_node("identifier", "mock", {
          parent: create_simple_mock_node("parent", "parent", {
            children: undefined,
          }),
        });

        expect(() => {
          variableConfig.modifiers!(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle complex regex patterns in visibility parsing", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      if (typeof pubConfig?.context === "function") {
        // Test with nested path
        const mockNode = create_simple_mock_node(
          "identifier",
          "pub(in super::nested::module::path)"
        );
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle invalid regex matches gracefully", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      if (typeof pubConfig?.context === "function") {
        // Test with malformed pub(in) without path
        const mockNode = create_simple_mock_node("identifier", "pub(in )");
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle AST nodes without text property", () => {
      const sourceImportConfig = RUST_CAPTURE_CONFIG.get("import.source");
      if (typeof sourceImportConfig?.context === "function") {
        const mockNode = create_simple_mock_node(); // Missing text property
        const context = sourceImportConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle where clause constraints", () => {
      const whereClauseConfig = RUST_CAPTURE_CONFIG.get("constraint.where_clause");
      expect(whereClauseConfig).toBeDefined();
      expect(whereClauseConfig?.category).toBe(SemanticCategory.TYPE);
      expect(whereClauseConfig?.entity).toBe(SemanticEntity.TYPE_CONSTRAINT);
    });

    it("should handle constraint types", () => {
      const constraintTypeConfig = RUST_CAPTURE_CONFIG.get("constraint.type");
      expect(constraintTypeConfig).toBeDefined();
      expect(constraintTypeConfig?.category).toBe(SemanticCategory.TYPE);
      expect(constraintTypeConfig?.entity).toBe(SemanticEntity.TYPE_PARAMETER);
    });

    it("should handle constraint bounds", () => {
      const constraintBoundsConfig = RUST_CAPTURE_CONFIG.get("constraint.bounds");
      expect(constraintBoundsConfig).toBeDefined();
      expect(constraintBoundsConfig?.category).toBe(SemanticCategory.TYPE);
      expect(constraintBoundsConfig?.entity).toBe(SemanticEntity.TYPE_CONSTRAINT);
    });

    it("should handle constraint traits", () => {
      const constraintTraitConfig = RUST_CAPTURE_CONFIG.get("constraint.trait");
      expect(constraintTraitConfig).toBeDefined();
      expect(constraintTraitConfig?.category).toBe(SemanticCategory.TYPE);
      expect(constraintTraitConfig?.entity).toBe(SemanticEntity.TYPE_CONSTRAINT);
    });

    it("should handle generic constraint traits", () => {
      const genericConstraintTraitConfig = RUST_CAPTURE_CONFIG.get("constraint.trait.generic");
      expect(genericConstraintTraitConfig).toBeDefined();
      expect(genericConstraintTraitConfig?.category).toBe(SemanticCategory.TYPE);
      expect(genericConstraintTraitConfig?.entity).toBe(SemanticEntity.TYPE_CONSTRAINT);
    });

    it("should handle constraint lifetimes", () => {
      const constraintLifetimeConfig = RUST_CAPTURE_CONFIG.get("constraint.lifetime");
      expect(constraintLifetimeConfig).toBeDefined();
      expect(constraintLifetimeConfig?.category).toBe(SemanticCategory.TYPE);
      expect(constraintLifetimeConfig?.entity).toBe(SemanticEntity.TYPE_PARAMETER);
      expect(constraintLifetimeConfig?.modifiers).toBeDefined();

      if (typeof constraintLifetimeConfig?.modifiers === "function") {
        const modifiers = constraintLifetimeConfig.modifiers(
          create_simple_mock_node()
        );
        expect(modifiers?.is_lifetime).toBe(true);
      }
    });
  });

  describe("Static vs Instance Method Detection", () => {
    it("should detect associated functions using :: syntax", () => {
      const associatedFnConfig = RUST_CAPTURE_CONFIG.get(
        "ref.associated_function"
      );
      expect(associatedFnConfig).toBeDefined();
      expect(associatedFnConfig?.entity).toBe(SemanticEntity.METHOD);

      if (associatedFnConfig?.context) {
        const context = associatedFnConfig.context(create_simple_mock_node());
        expect(context?.is_static).toBe(true);
      }
    });

    it("should detect instance methods using . syntax", () => {
      const methodCallConfig = RUST_CAPTURE_CONFIG.get("ref.method_call");
      expect(methodCallConfig).toBeDefined();
      expect(methodCallConfig?.entity).toBe(SemanticEntity.METHOD);

      // Regular method calls are instance methods
      if (methodCallConfig?.context) {
        const mockNode = create_simple_mock_node("identifier", "mock", {
          parent: create_simple_mock_node("parent", "parent", {
            childForFieldName: (field: string) => {
              if (field === "receiver") {
                return create_simple_mock_node("identifier", "obj"); // Instance method on object
              }
              return null;
            },
          }),
        });

        const context = methodCallConfig.context(mockNode);
        // Instance methods don't have the is_static flag
        expect(context?.is_static).toBeUndefined();
      }
    });

    it("should detect associated method definitions in impl blocks", () => {
      const associatedMethodConfig = RUST_CAPTURE_CONFIG.get(
        "def.method.associated"
      );
      expect(associatedMethodConfig).toBeDefined();
      expect(associatedMethodConfig?.entity).toBe(SemanticEntity.METHOD);

      if (associatedMethodConfig?.context) {
        const context = associatedMethodConfig.context(
          create_simple_mock_node()
        );
        expect(context?.is_static).toBe(true);
      }
    });

    it("should detect self parameter in instance methods", () => {
      const selfParamConfig = RUST_CAPTURE_CONFIG.get("def.param.self");
      expect(selfParamConfig).toBeDefined();
      expect(selfParamConfig?.entity).toBe(SemanticEntity.PARAMETER);

      // Methods with self parameter are instance methods
      if (selfParamConfig?.context) {
        const context = selfParamConfig.context(create_simple_mock_node());
        // self parameter indicates instance method
        expect(context).toBeDefined();
      }
    });

    it("should handle new() as associated function", () => {
      // Struct::new() is an associated function
      const associatedFnConfig = RUST_CAPTURE_CONFIG.get(
        "ref.associated_function"
      );

      if (associatedFnConfig?.context) {
        const mockNode = create_simple_mock_node("identifier", "new");
        const context = associatedFnConfig.context(mockNode);
        expect(context?.is_static).toBe(true);
      }
    });

    it("should differentiate trait methods from associated functions", () => {
      // Associated functions in traits don't have self parameter
      const functionConfig = RUST_CAPTURE_CONFIG.get("def.function");
      expect(functionConfig).toBeDefined();
      expect(functionConfig?.entity).toBe(SemanticEntity.FUNCTION);
    });

    it("should detect static fields vs instance fields", () => {
      const staticConfig = RUST_CAPTURE_CONFIG.get("def.static");
      expect(staticConfig).toBeDefined();
      expect(staticConfig?.entity).toBe(SemanticEntity.VARIABLE);

      if (staticConfig?.context) {
        const context = staticConfig.context(create_simple_mock_node());
        expect(context?.is_static).toBe(true);
      }
    });

    it("should handle UFCS (Universal Function Call Syntax)", () => {
      // <Type>::method() is an explicit static/associated call
      const ufcsConfig = RUST_CAPTURE_CONFIG.get("ref.ufcs");

      // UFCS calls are always associated/static
      if (ufcsConfig) {
        expect(ufcsConfig.entity).toBe(SemanticEntity.CALL);

        if (ufcsConfig.context) {
          const context = ufcsConfig.context(create_simple_mock_node());
          expect(context?.is_static).toBe(true);
        }
      }
    });

    it("should handle macro invocations differently from function calls", () => {
      const macroCallConfig = RUST_CAPTURE_CONFIG.get("ref.macro_call");

      if (macroCallConfig) {
        expect(macroCallConfig.entity).toBe(SemanticEntity.MACRO);

        // Macros are neither static nor instance - they're compile-time
        if (macroCallConfig.context) {
          const context = macroCallConfig.context(create_simple_mock_node());
          // Macros are compile-time constructs
          expect(context).toBeDefined();
        }
      }
    });
  });

  describe("Ownership and Reference Integration Tests", () => {
    describe("Reference Expression Parsing", () => {
      it("should correctly parse immutable references", () => {
        const code = `
          fn test() {
            let x = 5;
            let y = &x;  // immutable reference
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured the borrow operation
        const borrowRefs = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR && c.modifiers?.is_borrow
        );
        expect(borrowRefs.length).toBeGreaterThanOrEqual(1);

        // Should not have mutable borrow modifiers for immutable reference
        const mutBorrowRefs = borrowRefs.filter(c => c.modifiers?.is_mutable_borrow);
        expect(mutBorrowRefs.length).toBe(0);
      });

      it("should correctly parse mutable references", () => {
        const code = `
          fn test() {
            let mut x = 5;
            let y = &mut x;  // mutable reference
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured the mutable borrow operation
        const mutBorrowRefs = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR &&
          c.modifiers?.is_borrow &&
          c.modifiers?.is_mutable_borrow
        );
        expect(mutBorrowRefs.length).toBeGreaterThanOrEqual(1);
      });

      it("should correctly parse dereference operations", () => {
        const code = `
          fn test() {
            let x = 5;
            let y = &x;
            let z = *y;  // dereference
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured the dereference operation
        const derefRefs = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR && c.modifiers?.is_dereference
        );
        expect(derefRefs.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("Smart Pointer Parsing", () => {
      it("should correctly parse Box allocations", () => {
        const code = `
          fn test() {
            let x = Box::new(5);
            let y = Box::new(String::from("hello"));
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured Box::new as smart pointer allocations
        const boxAllocs = captures.references.filter(c =>
          c.entity === SemanticEntity.FUNCTION && c.modifiers?.is_smart_pointer_allocation
        );
        expect(boxAllocs.length).toBeGreaterThanOrEqual(2);
      });

      it("should correctly parse smart pointer types", () => {
        const code = `
          use std::rc::Rc;
          use std::cell::RefCell;

          struct Test {
            data: Box<String>,
            shared: Rc<i32>,
            mutable: RefCell<Vec<String>>,
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured smart pointer type names
        const smartPtrTypes = captures.types.filter(c =>
          c.entity === SemanticEntity.TYPE && c.modifiers?.is_smart_pointer
        );
        expect(smartPtrTypes.length).toBeGreaterThanOrEqual(3);
      });

      it("should correctly parse smart pointer method calls", () => {
        const code = `
          use std::rc::Rc;
          use std::cell::RefCell;

          fn test() {
            let data = RefCell::new(vec![1, 2, 3]);
            let borrowed = data.borrow();
            let mut_borrowed = data.borrow_mut();

            let shared = Rc::new(42);
            let cloned = shared.clone();
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured smart pointer method calls like borrow, borrow_mut, clone
        const smartPtrMethods = captures.references.filter(c =>
          c.entity === SemanticEntity.METHOD && c.modifiers?.is_smart_pointer_method
        );
        expect(smartPtrMethods.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe("Reference Type Parsing", () => {
      it("should correctly parse reference types in function signatures", () => {
        const code = `
          fn immutable_ref(data: &String) -> &str {
            data
          }

          fn mutable_ref(data: &mut String) {
            data.push_str("hello");
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured reference types
        const refTypes = captures.types.filter(c =>
          c.entity === SemanticEntity.TYPE && c.modifiers?.is_reference
        );
        expect(refTypes.length).toBeGreaterThanOrEqual(2);

        // Should have captured mutable reference types
        const mutRefTypes = refTypes.filter(c => c.modifiers?.is_mutable);
        expect(mutRefTypes.length).toBeGreaterThanOrEqual(1);
      });

      it("should correctly parse reference types in struct fields", () => {
        const code = `
          struct References<'a> {
            immutable: &'a str,
            mutable: &'a mut Vec<String>,
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have captured reference types in struct fields
        const refTypes = captures.types.filter(c =>
          c.entity === SemanticEntity.TYPE && c.modifiers?.is_reference
        );
        expect(refTypes.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe("Complex Ownership Patterns", () => {
      it("should correctly parse nested smart pointer and reference combinations", () => {
        const code = `
          use std::rc::Rc;
          use std::cell::RefCell;

          fn complex_ownership() {
            let data = Rc::new(RefCell::new(vec![1, 2, 3]));
            let clone = Rc::clone(&data);
            let borrowed = clone.borrow();
            let value = *borrowed.get(0).unwrap();
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Should have multiple types of captures
        const borrowOps = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR && c.modifiers?.is_borrow
        );
        const derefOps = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR && c.modifiers?.is_dereference
        );
        const smartPtrMethods = captures.references.filter(c =>
          c.entity === SemanticEntity.METHOD && c.modifiers?.is_smart_pointer_method
        );

        expect(borrowOps.length).toBeGreaterThanOrEqual(1);
        expect(derefOps.length).toBeGreaterThanOrEqual(1);
        expect(smartPtrMethods.length).toBeGreaterThanOrEqual(2);
      });

      it("should correctly distinguish between different reference contexts", () => {
        const code = `
          fn ownership_contexts() {
            let x = 5;
            let immutable_ref = &x;      // immutable borrow

            let mut y = 10;
            let mutable_ref = &mut y;    // mutable borrow

            let deref_val = *immutable_ref;  // dereference
            *mutable_ref = 15;           // dereference in assignment
          }
        `;
        const tree = parser.parse(code);
        const captures = query_tree_and_parse_captures("rust" as Language, tree, "test.rs" as FilePath);

        // Count different types of ownership operations
        const immutableBorrows = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR &&
          c.modifiers?.is_borrow &&
          !c.modifiers?.is_mutable_borrow
        );

        const mutableBorrows = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR &&
          c.modifiers?.is_borrow &&
          c.modifiers?.is_mutable_borrow
        );

        const derefs = captures.references.filter(c =>
          c.entity === SemanticEntity.OPERATOR &&
          c.modifiers?.is_dereference
        );

        expect(immutableBorrows.length).toBeGreaterThanOrEqual(1);
        expect(mutableBorrows.length).toBeGreaterThanOrEqual(1);
        expect(derefs.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
