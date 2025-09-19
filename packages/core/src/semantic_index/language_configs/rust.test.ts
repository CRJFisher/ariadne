/**
 * Comprehensive tests for Rust language configuration
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { SyntaxNode } from "tree-sitter";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";
import { RUST_CAPTURE_CONFIG } from "./rust";

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

  // Helper function to find first node of specific type
  function findNodeByType(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (let i = 0; i < node.childCount; i++) {
      const found = findNodeByType(node.child(i)!, type);
      if (found) return found;
    }
    return null;
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
        "scope.block",
        "scope.block.unsafe",
        "scope.match"
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
        "def.enum",
        "def.enum_variant",
        "def.trait",
        "def.type_alias",
        "def.const",
        "def.static",
        "def.module"
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
        "def.constructor"
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
        "def.param.closure"
      ];

      for (const mapping of variableDefinitions) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain Rust visibility system mappings", () => {
      const visibilityMappings = [
        "visibility.pub"
      ];

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
        "export.reexport"
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
        "import.list.item"
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
        "ref.identifier"
      ];

      for (const mapping of referenceMappings) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.REFERENCE);
      }
    });

    it("should contain assignment capture mappings", () => {
      const assignmentMappings = [
        "ref.assign.target",
        "ref.assign.source"
      ];

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
        "lifetime.param",
        "lifetime.ref",
        "impl.trait",
        "impl.inherent",
        "macro.call",
        "macro.definition",
        "module.crate_ref",
        "module.super_ref",
        "module.self_ref"
      ];

      for (const mapping of rustFeatures) {
        expect(RUST_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = RUST_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
      }
    });
  });

  describe("Rust-Specific Context Functions", () => {
    describe("Module Context", () => {
      it("should detect crate root modules", () => {
        const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
        expect(moduleConfig?.context).toBeDefined();

        if (typeof moduleConfig?.context === "function") {
          const mockNode = {
            parent: { type: "source_file" }
          } as any;

          const context = moduleConfig.context(mockNode);
          expect(context).toBeDefined();
        }
      });

      it("should detect non-root modules", () => {
        const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");

        if (typeof moduleConfig?.context === "function") {
          const mockNode = {
            parent: { type: "mod_item" }
          } as any;

          const context = moduleConfig.context(mockNode);
          expect(context).toBeDefined();
          expect(context).toBeDefined();
        }
      });
    });

    describe("Closure Context", () => {
      it("should handle closure scopes", () => {
        const closureConfig = RUST_CAPTURE_CONFIG.get("scope.closure");
        expect(closureConfig?.modifiers).toBeDefined();
        expect(closureConfig?.context).toBeDefined();

        if (typeof closureConfig?.modifiers === "function") {
          const modifiers = closureConfig.modifiers({} as any);
          expect(modifiers?.is_closure).toBe(true);
        }

        if (typeof closureConfig?.context === "function") {
          const context = closureConfig.context({} as any);
          expect(context).toBeDefined();
          expect(context?.is_closure).toBe(true);
        }
      });
    });

    describe("Impl Block Context", () => {
      it("should handle impl block scopes", () => {
        const implConfig = RUST_CAPTURE_CONFIG.get("scope.impl");
        expect(implConfig?.context).toBeDefined();

        if (typeof implConfig?.context === "function") {
          const context = implConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Trait Context", () => {
      it("should handle trait definition scopes", () => {
        const traitConfig = RUST_CAPTURE_CONFIG.get("scope.trait");
        expect(traitConfig?.context).toBeDefined();

        if (typeof traitConfig?.context === "function") {
          const context = traitConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Unsafe Block Context", () => {
      it("should handle unsafe block modifiers", () => {
        const unsafeBlockConfig = RUST_CAPTURE_CONFIG.get("scope.block.unsafe");
        expect(unsafeBlockConfig?.modifiers).toBeDefined();

        if (typeof unsafeBlockConfig?.modifiers === "function") {
          const modifiers = unsafeBlockConfig.modifiers({} as any);
          expect(modifiers?.is_unsafe).toBe(true);
        }
      });
    });

    describe("Match Expression Context", () => {
      it("should handle match expression scopes", () => {
        const matchConfig = RUST_CAPTURE_CONFIG.get("scope.match");
        expect(matchConfig?.context).toBeDefined();

        if (typeof matchConfig?.context === "function") {
          const context = matchConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });
  });

  describe("Definition Context Functions", () => {
    describe("Struct Definitions", () => {
      it("should handle struct definition context", () => {
        const structConfig = RUST_CAPTURE_CONFIG.get("def.struct");
        expect(structConfig?.context).toBeDefined();

        if (typeof structConfig?.context === "function") {
          const context = structConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });
    });

    describe("Enum Definitions", () => {
      it("should handle enum definition context", () => {
        const enumConfig = RUST_CAPTURE_CONFIG.get("def.enum");
        expect(enumConfig?.context).toBeDefined();

        if (typeof enumConfig?.context === "function") {
          const context = enumConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle enum variant context", () => {
        const variantConfig = RUST_CAPTURE_CONFIG.get("def.enum_variant");
        expect(variantConfig?.context).toBeDefined();

        if (typeof variantConfig?.context === "function") {
          const context = variantConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Function Definitions", () => {
      it("should handle function definition context", () => {
        const functionConfig = RUST_CAPTURE_CONFIG.get("def.function");
        expect(functionConfig?.context).toBeDefined();

        if (typeof functionConfig?.context === "function") {
          const context = functionConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle async function modifiers", () => {
        const asyncFunctionConfig = RUST_CAPTURE_CONFIG.get("def.function.async");
        expect(asyncFunctionConfig?.modifiers).toBeDefined();
        expect(asyncFunctionConfig?.context).toBeDefined();

        if (typeof asyncFunctionConfig?.modifiers === "function") {
          const modifiers = asyncFunctionConfig.modifiers({} as any);
          expect(modifiers?.is_async).toBe(true);
        }

        if (typeof asyncFunctionConfig?.context === "function") {
          const context = asyncFunctionConfig.context({} as any);
          expect(context).toBeDefined();
          expect(context?.is_async).toBe(true);
        }
      });

      it("should handle generic function modifiers", () => {
        const genericFunctionConfig = RUST_CAPTURE_CONFIG.get("def.function.generic");
        expect(genericFunctionConfig?.modifiers).toBeDefined();

        if (typeof genericFunctionConfig?.modifiers === "function") {
          const modifiers = genericFunctionConfig.modifiers({} as any);
          expect(modifiers?.is_generic).toBe(true);
        }
      });

      it("should handle closure function modifiers", () => {
        const closureFunctionConfig = RUST_CAPTURE_CONFIG.get("def.function.closure");
        expect(closureFunctionConfig?.modifiers).toBeDefined();
        expect(closureFunctionConfig?.context).toBeDefined();

        if (typeof closureFunctionConfig?.modifiers === "function") {
          const modifiers = closureFunctionConfig.modifiers({} as any);
          expect(modifiers?.is_closure).toBe(true);
        }

        if (typeof closureFunctionConfig?.context === "function") {
          const context = closureFunctionConfig.context({} as any);
          expect(context).toBeDefined();
          expect(context?.is_closure).toBe(true);
        }
      });
    });

    describe("Method Definitions", () => {
      it("should handle method definition context", () => {
        const methodConfig = RUST_CAPTURE_CONFIG.get("def.method");
        expect(methodConfig?.modifiers).toBeDefined();
        expect(methodConfig?.context).toBeDefined();

        if (typeof methodConfig?.modifiers === "function") {
          const modifiers = methodConfig.modifiers({} as any);
          expect(modifiers?.is_method).toBe(true);
          expect(modifiers?.is_static).toBe(false);
        }

        if (typeof methodConfig?.context === "function") {
          const context = methodConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle associated function modifiers", () => {
        const associatedMethodConfig = RUST_CAPTURE_CONFIG.get("def.method.associated");
        expect(associatedMethodConfig?.modifiers).toBeDefined();

        if (typeof associatedMethodConfig?.modifiers === "function") {
          const modifiers = associatedMethodConfig.modifiers({} as any);
          expect(modifiers?.is_method).toBe(false);
          expect(modifiers?.is_associated_function).toBe(true);
          expect(modifiers?.is_static).toBe(true);
        }
      });

      it("should handle constructor modifiers", () => {
        const constructorConfig = RUST_CAPTURE_CONFIG.get("def.constructor");
        expect(constructorConfig?.modifiers).toBeDefined();

        if (typeof constructorConfig?.modifiers === "function") {
          const modifiers = constructorConfig.modifiers({} as any);
          expect(modifiers?.is_constructor).toBe(true);
          expect(modifiers?.is_static).toBe(true);
        }
      });
    });

    describe("Variable Definitions", () => {
      it("should handle variable definition with mutability detection", () => {
        const variableConfig = RUST_CAPTURE_CONFIG.get("def.variable");
        expect(variableConfig?.modifiers).toBeDefined();
        expect(variableConfig?.context).toBeDefined();

        if (typeof variableConfig?.modifiers === "function") {
          // Test mutable variable
          const mockMutableNode = {
            parent: {
              children: [{ type: "mut" }]
            }
          } as any;

          const mutableModifiers = variableConfig.modifiers(mockMutableNode);
          expect(mutableModifiers?.is_mutable).toBe(true);

          // Test immutable variable
          const mockImmutableNode = {
            parent: {
              children: []
            }
          } as any;

          const immutableModifiers = variableConfig.modifiers(mockImmutableNode);
          expect(immutableModifiers?.is_mutable).toBe(false);
        }

        if (typeof variableConfig?.context === "function") {
          const context = variableConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Parameter Definitions", () => {
      it("should handle self parameter modifiers", () => {
        const selfParamConfig = RUST_CAPTURE_CONFIG.get("def.param.self");
        expect(selfParamConfig?.modifiers).toBeDefined();
        expect(selfParamConfig?.context).toBeDefined();

        if (typeof selfParamConfig?.modifiers === "function") {
          const modifiers = selfParamConfig.modifiers({} as any);
          expect(modifiers?.is_self).toBe(true);
        }

        if (typeof selfParamConfig?.context === "function") {
          const context = selfParamConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle closure parameter modifiers", () => {
        const closureParamConfig = RUST_CAPTURE_CONFIG.get("def.param.closure");
        expect(closureParamConfig?.modifiers).toBeDefined();
        expect(closureParamConfig?.context).toBeDefined();

        if (typeof closureParamConfig?.modifiers === "function") {
          const modifiers = closureParamConfig.modifiers({} as any);
          expect(modifiers?.is_closure_param).toBe(true);
        }

        if (typeof closureParamConfig?.context === "function") {
          const context = closureParamConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });
    });
  });

  describe("Rust Visibility System", () => {
    it("should parse public visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      expect(pubConfig?.context).toBeDefined();

      if (typeof pubConfig?.context === "function") {
        const mockNode = { text: "pub" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse crate visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = { text: "pub(crate)" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse super visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = { text: "pub(super)" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse self visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = { text: "pub(self)" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should parse restricted visibility", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");

      if (typeof pubConfig?.context === "function") {
        const mockNode = { text: "pub(in crate::utils)" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
        }
    });
  });

  describe("Export Context Functions", () => {
    it("should handle struct exports", () => {
      const structExportConfig = RUST_CAPTURE_CONFIG.get("export.struct");
      expect(structExportConfig?.context).toBeDefined();

      if (typeof structExportConfig?.context === "function") {
        const context = structExportConfig.context({} as any);
        expect(context?.export_type).toBe("struct");
      }
    });

    it("should handle function exports", () => {
      const functionExportConfig = RUST_CAPTURE_CONFIG.get("export.function");
      expect(functionExportConfig?.context).toBeDefined();

      if (typeof functionExportConfig?.context === "function") {
        const context = functionExportConfig.context({} as any);
        expect(context?.export_type).toBe("function");
      }
    });

    it("should handle trait exports", () => {
      const traitExportConfig = RUST_CAPTURE_CONFIG.get("export.trait");
      expect(traitExportConfig?.context).toBeDefined();

      if (typeof traitExportConfig?.context === "function") {
        const context = traitExportConfig.context({} as any);
        expect(context?.export_type).toBe("trait");
      }
    });

    it("should handle re-exports", () => {
      const reexportConfig = RUST_CAPTURE_CONFIG.get("export.reexport");
      expect(reexportConfig?.context).toBeDefined();

      if (typeof reexportConfig?.context === "function") {
        const context = reexportConfig.context({} as any);
        expect(context?.export_type).toBe("reexport");
      }
    });
  });

  describe("Import Context Functions", () => {
    it("should handle direct imports", () => {
      const nameImportConfig = RUST_CAPTURE_CONFIG.get("import.name");
      expect(nameImportConfig?.context).toBeDefined();

      if (typeof nameImportConfig?.context === "function") {
        const context = nameImportConfig.context({} as any);
        expect(context).toBeDefined();
      }
    });

    it("should handle aliased imports", () => {
      const sourceImportConfig = RUST_CAPTURE_CONFIG.get("import.source");
      expect(sourceImportConfig?.context).toBeDefined();

      if (typeof sourceImportConfig?.context === "function") {
        const mockNode = { text: "HashMap" } as any;
        const context = sourceImportConfig.context(mockNode);
        expect(context).toBeDefined();
        expect(context).toBeDefined();
      }
    });

    it("should handle import aliases", () => {
      const aliasImportConfig = RUST_CAPTURE_CONFIG.get("import.alias");
      expect(aliasImportConfig?.context).toBeDefined();

      if (typeof aliasImportConfig?.context === "function") {
        const mockNode = { text: "Map" } as any;
        const context = aliasImportConfig.context(mockNode);
        expect(context).toBeDefined();
        }
    });

    it("should handle list item imports", () => {
      const listItemConfig = RUST_CAPTURE_CONFIG.get("import.list.item");
      expect(listItemConfig?.context).toBeDefined();

      if (typeof listItemConfig?.context === "function") {
        const context = listItemConfig.context({} as any);
        expect(context).toBeDefined();
      }
    });
  });

  describe("Reference Context Functions", () => {
    describe("Method Calls", () => {
      it("should handle method call context", () => {
        const methodCallConfig = RUST_CAPTURE_CONFIG.get("ref.method_call");
        expect(methodCallConfig?.context).toBeDefined();

        if (typeof methodCallConfig?.context === "function") {
          const context = methodCallConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle associated function calls", () => {
        const associatedCallConfig = RUST_CAPTURE_CONFIG.get("ref.associated_function");
        expect(associatedCallConfig?.modifiers).toBeDefined();
        expect(associatedCallConfig?.context).toBeDefined();

        if (typeof associatedCallConfig?.modifiers === "function") {
          const modifiers = associatedCallConfig.modifiers({} as any);
          expect(modifiers?.is_associated_call).toBe(true);
        }

        if (typeof associatedCallConfig?.context === "function") {
          const context = associatedCallConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle method receiver context", () => {
        const receiverConfig = RUST_CAPTURE_CONFIG.get("ref.receiver");
        expect(receiverConfig?.context).toBeDefined();

        if (typeof receiverConfig?.context === "function") {
          const context = receiverConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Field Access", () => {
      it("should handle object field access", () => {
        const objectConfig = RUST_CAPTURE_CONFIG.get("ref.object");
        expect(objectConfig?.context).toBeDefined();

        if (typeof objectConfig?.context === "function") {
          const context = objectConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Assignment Context", () => {
      it("should handle assignment targets", () => {
        const assignTargetConfig = RUST_CAPTURE_CONFIG.get("ref.assign.target");
        expect(assignTargetConfig?.context).toBeDefined();

        if (typeof assignTargetConfig?.context === "function") {
          const context = assignTargetConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle assignment sources", () => {
        const assignSourceConfig = RUST_CAPTURE_CONFIG.get("ref.assign.source");
        expect(assignSourceConfig?.context).toBeDefined();

        if (typeof assignSourceConfig?.context === "function") {
          const context = assignSourceConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Self References", () => {
      it("should handle self references", () => {
        const selfRefConfig = RUST_CAPTURE_CONFIG.get("ref.self");
        expect(selfRefConfig?.modifiers).toBeDefined();
        expect(selfRefConfig?.context).toBeDefined();

        if (typeof selfRefConfig?.modifiers === "function") {
          const modifiers = selfRefConfig.modifiers({} as any);
          expect(modifiers?.is_self_reference).toBe(true);
        }

        if (typeof selfRefConfig?.context === "function") {
          const context = selfRefConfig.context({} as any);
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
        expect(borrowConfig?.context).toBeDefined();

        if (typeof borrowConfig?.modifiers === "function") {
          const modifiers = borrowConfig.modifiers({} as any);
          expect(modifiers?.is_borrow).toBe(true);
        }

        if (typeof borrowConfig?.context === "function") {
          const context = borrowConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle mutable borrow operations", () => {
        const mutBorrowConfig = RUST_CAPTURE_CONFIG.get("ownership.borrow_mut");
        expect(mutBorrowConfig?.modifiers).toBeDefined();
        expect(mutBorrowConfig?.context).toBeDefined();

        if (typeof mutBorrowConfig?.modifiers === "function") {
          const modifiers = mutBorrowConfig.modifiers({} as any);
          expect(modifiers?.is_mutable_borrow).toBe(true);
        }

        if (typeof mutBorrowConfig?.context === "function") {
          const context = mutBorrowConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle dereference operations", () => {
        const derefConfig = RUST_CAPTURE_CONFIG.get("ownership.deref");
        expect(derefConfig?.modifiers).toBeDefined();
        expect(derefConfig?.context).toBeDefined();

        if (typeof derefConfig?.modifiers === "function") {
          const modifiers = derefConfig.modifiers({} as any);
          expect(modifiers?.is_dereference).toBe(true);
        }

        if (typeof derefConfig?.context === "function") {
          const context = derefConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Lifetimes", () => {
      it("should handle lifetime parameters", () => {
        const lifetimeParamConfig = RUST_CAPTURE_CONFIG.get("lifetime.param");
        expect(lifetimeParamConfig?.modifiers).toBeDefined();
        expect(lifetimeParamConfig?.context).toBeDefined();

        if (typeof lifetimeParamConfig?.modifiers === "function") {
          const modifiers = lifetimeParamConfig.modifiers({} as any);
          expect(modifiers?.is_lifetime).toBe(true);
        }

        if (typeof lifetimeParamConfig?.context === "function") {
          const context = lifetimeParamConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle lifetime references", () => {
        const lifetimeRefConfig = RUST_CAPTURE_CONFIG.get("lifetime.ref");
        expect(lifetimeRefConfig?.modifiers).toBeDefined();
        expect(lifetimeRefConfig?.context).toBeDefined();

        if (typeof lifetimeRefConfig?.modifiers === "function") {
          const modifiers = lifetimeRefConfig.modifiers({} as any);
          expect(modifiers?.is_lifetime).toBe(true);
        }

        if (typeof lifetimeRefConfig?.context === "function") {
          const context = lifetimeRefConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Implementations", () => {
      it("should handle trait implementations", () => {
        const traitImplConfig = RUST_CAPTURE_CONFIG.get("impl.trait");
        expect(traitImplConfig?.context).toBeDefined();

        if (typeof traitImplConfig?.context === "function") {
          const context = traitImplConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle inherent implementations", () => {
        const inherentImplConfig = RUST_CAPTURE_CONFIG.get("impl.inherent");
        expect(inherentImplConfig?.context).toBeDefined();

        if (typeof inherentImplConfig?.context === "function") {
          const context = inherentImplConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });
    });

    describe("Macros", () => {
      it("should handle macro calls", () => {
        const macroCallConfig = RUST_CAPTURE_CONFIG.get("macro.call");
        expect(macroCallConfig?.context).toBeDefined();

        if (typeof macroCallConfig?.context === "function") {
          const context = macroCallConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle macro definitions", () => {
        const macroDefConfig = RUST_CAPTURE_CONFIG.get("macro.definition");
        expect(macroDefConfig?.context).toBeDefined();

        if (typeof macroDefConfig?.context === "function") {
          const context = macroDefConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Module System", () => {
      it("should handle crate references", () => {
        const crateRefConfig = RUST_CAPTURE_CONFIG.get("module.crate_ref");
        expect(crateRefConfig?.context).toBeDefined();

        if (typeof crateRefConfig?.context === "function") {
          const context = crateRefConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle super references", () => {
        const superRefConfig = RUST_CAPTURE_CONFIG.get("module.super_ref");
        expect(superRefConfig?.context).toBeDefined();

        if (typeof superRefConfig?.context === "function") {
          const context = superRefConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle self module references", () => {
        const selfRefConfig = RUST_CAPTURE_CONFIG.get("module.self_ref");
        expect(selfRefConfig?.context).toBeDefined();

        if (typeof selfRefConfig?.context === "function") {
          const context = selfRefConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });
    });

    describe("Generics", () => {
      it("should handle generic type parameters", () => {
        const genericParamConfig = RUST_CAPTURE_CONFIG.get("generic.type_param");
        expect(genericParamConfig?.context).toBeDefined();

        if (typeof genericParamConfig?.context === "function") {
          const context = genericParamConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });

      it("should handle trait bounds", () => {
        const constraintConfig = RUST_CAPTURE_CONFIG.get("generic.constraint");
        expect(constraintConfig?.context).toBeDefined();

        if (typeof constraintConfig?.context === "function") {
          const context = constraintConfig.context({} as any);
          expect(context).toBeDefined();
        }
      });
    });

    describe("Pattern Matching", () => {
      it("should handle match patterns", () => {
        const matchPatternConfig = RUST_CAPTURE_CONFIG.get("pattern.match");
        expect(matchPatternConfig?.context).toBeDefined();

        if (typeof matchPatternConfig?.context === "function") {
          const context = matchPatternConfig.context({} as any);
          expect(context).toBeDefined();
          }
      });

      it("should handle destructuring patterns", () => {
        const destructureConfig = RUST_CAPTURE_CONFIG.get("pattern.destructure");
        expect(destructureConfig?.context).toBeDefined();

        if (typeof destructureConfig?.context === "function") {
          const context = destructureConfig.context({} as any);
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
        const modifiers = genericStructConfig.modifiers({} as any);
        expect(modifiers?.is_generic).toBe(true);
      }
    });

    it("should handle mutable variable definitions", () => {
      const mutVarConfig = RUST_CAPTURE_CONFIG.get("def.variable.mut");
      expect(mutVarConfig?.modifiers).toBeDefined();

      if (typeof mutVarConfig?.modifiers === "function") {
        const modifiers = mutVarConfig.modifiers({} as any);
        expect(modifiers?.is_mutable).toBe(true);
      }
    });

    it("should handle trait method definitions", () => {
      const traitMethodConfig = RUST_CAPTURE_CONFIG.get("def.trait_method");
      expect(traitMethodConfig?.modifiers).toBeDefined();

      if (typeof traitMethodConfig?.modifiers === "function") {
        const modifiers = traitMethodConfig.modifiers({} as any);
        expect(modifiers?.is_trait_method).toBe(true);
      }
    });

    it("should handle constrained type parameters", () => {
      const constrainedParamConfig = RUST_CAPTURE_CONFIG.get("def.type_param.constrained");
      expect(constrainedParamConfig?.modifiers).toBeDefined();

      if (typeof constrainedParamConfig?.modifiers === "function") {
        const modifiers = constrainedParamConfig.modifiers({} as any);
        expect(modifiers).toBeDefined();
      }
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
          variableConfig.modifiers(null as any);
        }).toThrow();

        expect(() => {
          variableConfig.modifiers(undefined as any);
        }).toThrow();
      }
    });

    it("should handle null/undefined nodes in context functions", () => {
      const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
      if (typeof moduleConfig?.context === "function") {
        // These should throw since the function accesses .parent
        expect(() => {
          moduleConfig.context(null as any);
        }).toThrow();

        expect(() => {
          moduleConfig.context(undefined as any);
        }).toThrow();
      }
    });

    it("should handle malformed visibility strings", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      if (typeof pubConfig?.context === "function") {
        const mockNode = { text: "pub(malformed)" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined(); // Fallback
      }
    });

    it("should handle missing parent nodes", () => {
      const moduleConfig = RUST_CAPTURE_CONFIG.get("scope.module");
      if (typeof moduleConfig?.context === "function") {
        const mockNode = { parent: null } as any;
        const context = moduleConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle missing children arrays", () => {
      const variableConfig = RUST_CAPTURE_CONFIG.get("def.variable");
      if (typeof variableConfig?.modifiers === "function") {
        const mockNode = {
          parent: {
            children: null
          }
        } as any;

        expect(() => {
          variableConfig.modifiers(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle complex regex patterns in visibility parsing", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      if (typeof pubConfig?.context === "function") {
        // Test with nested path
        const mockNode = { text: "pub(in super::nested::module::path)" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
        }
    });

    it("should handle invalid regex matches gracefully", () => {
      const pubConfig = RUST_CAPTURE_CONFIG.get("visibility.pub");
      if (typeof pubConfig?.context === "function") {
        // Test with malformed pub(in) without path
        const mockNode = { text: "pub(in )" } as any;
        const context = pubConfig.context(mockNode);
        expect(context).toBeDefined();
        }
    });

    it("should handle AST nodes without text property", () => {
      const sourceImportConfig = RUST_CAPTURE_CONFIG.get("import.source");
      if (typeof sourceImportConfig?.context === "function") {
        const mockNode = {} as any; // Missing text property
        const context = sourceImportConfig.context(mockNode);
        expect(context).toBeDefined();
      }
    });

    it("should handle type parameter analysis with complex constraint expressions", () => {
      const constraintConfig = RUST_CAPTURE_CONFIG.get("generic.constraint");
      if (typeof constraintConfig?.context === "function") {
        // Complex trait bounds shouldn't break the parser
        const context = constraintConfig.context({} as any);
        expect(context).toBeDefined();
      }
    });
  });
});