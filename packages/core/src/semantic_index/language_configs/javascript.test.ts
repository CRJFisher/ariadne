/**
 * Comprehensive tests for JavaScript language configuration
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import type { SyntaxNode } from "tree-sitter";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "../capture_types";
import { JAVASCRIPT_CAPTURE_CONFIG } from "./javascript";

describe("JavaScript Language Configuration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
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

  describe("JAVASCRIPT_CAPTURE_CONFIG", () => {
    it("should export a valid LanguageCaptureConfig", () => {
      expect(JAVASCRIPT_CAPTURE_CONFIG).toBeDefined();
      expect(JAVASCRIPT_CAPTURE_CONFIG).toBeInstanceOf(Map);
      expect(JAVASCRIPT_CAPTURE_CONFIG.size).toBeGreaterThan(0);
    });

    it("should contain scope capture mappings", () => {
      const scopeMappings = [
        "scope.module",
        "scope.function",
        "scope.method",
        "scope.class",
        "scope.block"
      ];

      for (const mapping of scopeMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.SCOPE);
      }
    });

    it("should contain definition capture mappings", () => {
      const definitionMappings = [
        "def.function",
        "def.arrow",
        "def.variable",
        "def.class",
        "def.method",
        "def.constructor",
        "def.param",
        "def.field"
      ];

      for (const mapping of definitionMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.DEFINITION);
      }
    });

    it("should contain reference capture mappings", () => {
      const referenceMappings = [
        "ref.call",
        "ref.method_call",
        "ref.method_call.chained",
        "ref.method_call.deep",
        "ref.constructor",
        "ref.constructor.assigned",
        "ref.property",
        "ref.this",
        "ref.super"
      ];

      for (const mapping of referenceMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.REFERENCE);
      }
    });

    it("should contain import capture mappings", () => {
      const importMappings = [
        "import.source",
        "import.named",
        "import.named.source",
        "import.default",
        "import.namespace"
      ];

      for (const mapping of importMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.IMPORT);
      }
    });

    it("should contain export capture mappings", () => {
      const exportMappings = [
        "export.named",
        "export.named.source",
        "export.named.alias",
        "export.default",
        "export.default.function",
        "export.default.class",
        "export.declaration",
        "export.namespace.source",
        "export.namespace.alias",
        "export.reexport"
      ];

      for (const mapping of exportMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.EXPORT);
      }
    });

    it("should contain assignment capture mappings", () => {
      const assignmentMappings = [
        "assign.target",
        "assign.source"
      ];

      for (const mapping of assignmentMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.ASSIGNMENT);
      }
    });

    it("should contain return capture mappings", () => {
      const returnMappings = [
        "ref.return"
      ];

      for (const mapping of returnMappings) {
        expect(JAVASCRIPT_CAPTURE_CONFIG.has(mapping)).toBe(true);
        const config = JAVASCRIPT_CAPTURE_CONFIG.get(mapping);
        expect(config).toBeDefined();
        expect(config?.category).toBe(SemanticCategory.RETURN);
      }
    });
  });

  describe("Modifier Functions", () => {
    it("should handle arrow function modifiers", () => {
      const arrowConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.arrow");
      expect(arrowConfig?.modifiers).toBeDefined();
      expect(typeof arrowConfig?.modifiers).toBe("function");

      if (typeof arrowConfig?.modifiers === "function") {
        const modifiers = arrowConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_async).toBe(false);
      }
    });

    it("should handle method static modifiers", () => {
      const code = `
class TestClass {
  static method() {}
}`;
      const tree = getAstNode(code);
      const methodConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.method");

      expect(methodConfig?.modifiers).toBeDefined();
      if (typeof methodConfig?.modifiers === "function") {
        // Test with mock node that has static modifier
        const mockNode = {
          parent: {
            children: [{ type: "static" }]
          }
        } as any;

        const modifiers = methodConfig.modifiers(mockNode);
        expect(modifiers?.is_static).toBe(true);
      }
    });

    it("should handle field static modifiers", () => {
      const fieldConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.field");

      expect(fieldConfig?.modifiers).toBeDefined();
      if (typeof fieldConfig?.modifiers === "function") {
        // Test with mock node that has static modifier
        const mockNode = {
          parent: {
            children: [{ type: "static" }]
          }
        } as any;

        const modifiers = fieldConfig.modifiers(mockNode);
        expect(modifiers?.is_static).toBe(true);
      }
    });

    it("should handle default import modifiers", () => {
      const defaultConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.default");

      expect(defaultConfig?.modifiers).toBeDefined();
      if (typeof defaultConfig?.modifiers === "function") {
        const modifiers = defaultConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_default).toBe(true);
      }
    });

    it("should handle namespace import modifiers", () => {
      const namespaceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.namespace");

      expect(namespaceConfig?.modifiers).toBeDefined();
      if (typeof namespaceConfig?.modifiers === "function") {
        const modifiers = namespaceConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_namespace).toBe(true);
      }
    });

    it("should handle export default modifiers", () => {
      const exportDefaultConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.default");

      expect(exportDefaultConfig?.modifiers).toBeDefined();
      if (typeof exportDefaultConfig?.modifiers === "function") {
        const modifiers = exportDefaultConfig.modifiers({} as SyntaxNode);
        expect(modifiers?.is_default).toBe(true);
      }
    });
  });

  describe("Context Functions", () => {
    describe("Method Call Context", () => {
      it("should extract basic method call context", () => {
        const methodCallConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.method_call");

        expect(methodCallConfig?.context).toBeDefined();
        if (typeof methodCallConfig?.context === "function") {
          const mockNode = {
            parent: {
              childForFieldName: (field: string) => {
                if (field === "object") {
                  return { text: "obj" };
                }
                return null;
              }
            }
          } as any;

          const context = methodCallConfig.context(mockNode);
          expect(context?.receiver_node).toBeDefined();
        }
      });

      it("should extract chained method call context", () => {
        const chainedConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.method_call.chained");

        expect(chainedConfig?.context).toBeDefined();
        if (typeof chainedConfig?.context === "function") {
          // Test with mock chained call structure
          const mockNode = {
            parent: {
              childForFieldName: (field: string) => {
                if (field === "object") {
                  return {
                    type: "member_expression",
                    childForFieldName: (field: string) => {
                      if (field === "property") return { text: "prop" };
                      if (field === "object") return { text: "obj" };
                      return null;
                    }
                  };
                }
                return null;
              }
            }
          } as any;

          const context = chainedConfig.context(mockNode);
          expect(context?.property_chain).toBeDefined();
        }
      });
    });

    describe("Constructor Context", () => {
      it("should extract constructor assignment context", () => {
        const constructorConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.constructor");

        expect(constructorConfig?.context).toBeDefined();
        if (typeof constructorConfig?.context === "function") {
          const mockNode = {
            parent: {
              parent: {
                type: "variable_declarator",
                childForFieldName: (field: string) => {
                  if (field === "name") return { text: "instance" };
                  return null;
                }
              }
            }
          } as any;

          const context = constructorConfig.context(mockNode);
          expect(context?.construct_target).toBeDefined();
        }
      });

      it("should extract assigned constructor context", () => {
        const assignedConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.constructor.assigned");

        expect(assignedConfig?.context).toBeDefined();
        if (typeof assignedConfig?.context === "function") {
          const mockNode = {
            parent: {
              parent: {
                type: "variable_declarator",
                childForFieldName: (field: string) => {
                  if (field === "name") return { text: "instance" };
                  return null;
                }
              }
            }
          } as any;

          const context = assignedConfig.context(mockNode);
          expect(context?.construct_target).toBeDefined();
        }
      });
    });

    describe("Import Context", () => {
      it("should extract side-effect import context", () => {
        const importSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.source");

        expect(importSourceConfig?.context).toBeDefined();
        if (typeof importSourceConfig?.context === "function") {
          // Test side-effect import (no import clause)
          const mockNode = {
            text: "'side-effect-module'",
            parent: {
              namedChildren: []
            }
          } as any;

          const context = importSourceConfig.context(mockNode);
          expect(context?.source_module).toBe("side-effect-module");
          expect(context?.is_side_effect_import).toBe(true);
        }
      });

      it("should skip regular imports with import clause", () => {
        const importSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.source");

        if (typeof importSourceConfig?.context === "function") {
          // Test regular import (has import clause)
          const mockNode = {
            text: "'regular-module'",
            parent: {
              namedChildren: [{ type: "import_clause" }]
            }
          } as any;

          const context = importSourceConfig.context(mockNode);
          expect(context?.skip).toBe(true);
        }
      });

      it("should extract named import context", () => {
        const namedImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.named");

        expect(namedImportConfig?.context).toBeDefined();
        if (typeof namedImportConfig?.context === "function") {
          const mockNode = {
            parent: {
              parent: {
                parent: {
                  parent: {
                    type: "import_statement",
                    childForFieldName: (field: string) => {
                      if (field === "source") return { text: "'module'" };
                      return null;
                    }
                  }
                }
              }
            }
          } as any;

          const context = namedImportConfig.context(mockNode);
          expect(context?.source_module).toBe("module");
        }
      });

      it("should extract aliased import context", () => {
        const aliasedImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.named.source");

        expect(aliasedImportConfig?.context).toBeDefined();
        if (typeof aliasedImportConfig?.context === "function") {
          const mockNode = {
            parent: {
              childForFieldName: (field: string) => {
                if (field === "alias") return { text: "aliasName" };
                return null;
              },
              parent: {
                parent: {
                  type: "import_statement",
                  childForFieldName: (field: string) => {
                    if (field === "source") return { text: "'module'" };
                    return null;
                  }
                }
              }
            }
          } as any;

          const context = aliasedImportConfig.context(mockNode);
          expect(context?.source_module).toBe("module");
          expect(context?.import_alias).toBe("aliasName");
        }
      });

      it("should extract default import context", () => {
        const defaultImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.default");

        expect(defaultImportConfig?.context).toBeDefined();
        if (typeof defaultImportConfig?.context === "function") {
          const mockNode = {
            parent: {
              parent: {
                type: "import_statement",
                childForFieldName: (field: string) => {
                  if (field === "source") return { text: "'module'" };
                  return null;
                }
              }
            }
          } as any;

          const context = defaultImportConfig.context(mockNode);
          expect(context?.source_module).toBe("module");
        }
      });

      it("should extract namespace import context", () => {
        const namespaceImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.namespace");

        expect(namespaceImportConfig?.context).toBeDefined();
        if (typeof namespaceImportConfig?.context === "function") {
          const mockNode = {
            parent: {
              parent: {
                parent: {
                  type: "import_statement",
                  childForFieldName: (field: string) => {
                    if (field === "source") return { text: "'module'" };
                    return null;
                  }
                }
              }
            }
          } as any;

          const context = namespaceImportConfig.context(mockNode);
          expect(context?.source_module).toBe("module");
        }
      });
    });

    describe("Export Context", () => {
      it("should extract named export alias context", () => {
        const namedSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.named.source");

        expect(namedSourceConfig?.context).toBeDefined();
        if (typeof namedSourceConfig?.context === "function") {
          const mockNode = {
            parent: {
              childForFieldName: (field: string) => {
                if (field === "alias") return { text: "exportAlias" };
                return null;
              }
            }
          } as any;

          const context = namedSourceConfig.context(mockNode);
          expect(context?.export_alias).toBe("exportAlias");
        }
      });

      it("should extract namespace export context", () => {
        const namespaceSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.namespace.source");

        expect(namespaceSourceConfig?.context).toBeDefined();
        if (typeof namespaceSourceConfig?.context === "function") {
          const mockNode = {
            text: "'module'"
          } as any;

          const context = namespaceSourceConfig.context(mockNode);
          expect(context?.export_source).toBe("module");
          expect(context?.is_namespace_export).toBe(true);
        }
      });

      it("should extract reexport context", () => {
        const reexportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.reexport");

        expect(reexportConfig?.context).toBeDefined();
        if (typeof reexportConfig?.context === "function") {
          const mockNode = {
            text: "reexportedItem"
          } as any;

          const context = reexportConfig.context(mockNode);
          expect(context?.reexport_name).toBe("reexportedItem");
        }
      });

      it("should extract reexport source context", () => {
        const reexportSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.reexport.source");

        expect(reexportSourceConfig?.context).toBeDefined();
        if (typeof reexportSourceConfig?.context === "function") {
          const mockNode = {
            text: "'module'",
            parent: {
              childForFieldName: (field: string) => {
                if (field === "declaration") {
                  return {
                    children: [
                      {
                        type: "export_specifier",
                        childForFieldName: (field: string) => {
                          if (field === "name") return { text: "item" };
                          return null;
                        }
                      }
                    ]
                  };
                }
                return null;
              },
              children: []
            }
          } as any;

          const context = reexportSourceConfig.context(mockNode);
          expect(context?.export_source).toBe("module");
          expect(context?.is_reexport).toBe(true);
          expect(context?.reexport_names).toContain("item");
        }
      });
    });

    describe("Assignment Context", () => {
      it("should extract assignment target context", () => {
        const assignTargetConfig = JAVASCRIPT_CAPTURE_CONFIG.get("assign.target");

        expect(assignTargetConfig?.context).toBeDefined();
        if (typeof assignTargetConfig?.context === "function") {
          const mockNode = {
            parent: {
              childForFieldName: (field: string) => {
                if (field === "value") return { text: "sourceValue" };
                return null;
              }
            }
          } as any;

          const context = assignTargetConfig.context(mockNode);
          expect(context?.source_node).toBeDefined();
          expect(context?.target_node).toBe(mockNode);
        }
      });

      it("should extract assignment source context", () => {
        const assignSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("assign.source");

        expect(assignSourceConfig?.context).toBeDefined();
        if (typeof assignSourceConfig?.context === "function") {
          const mockNode = {
            parent: {
              childForFieldName: (field: string) => {
                if (field === "name") return { text: "targetVar" };
                return null;
              }
            }
          } as any;

          const context = assignSourceConfig.context(mockNode);
          expect(context?.target_node).toBeDefined();
          expect(context?.source_node).toBe(mockNode);
        }
      });
    });

    describe("Return Context", () => {
      it("should extract containing function context", () => {
        const returnConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.return");

        expect(returnConfig?.context).toBeDefined();
        if (typeof returnConfig?.context === "function") {
          const mockNode = {
            parent: {
              parent: {
                type: "function_declaration"
              }
            }
          } as any;

          const context = returnConfig.context(mockNode);
          expect(context?.containing_function_node).toBeDefined();
        }
      });
    });

    describe("Class Context", () => {
      it("should extract class extends context", () => {
        const classExtendsConfig = JAVASCRIPT_CAPTURE_CONFIG.get("class.extends");

        expect(classExtendsConfig?.context).toBeDefined();
        if (typeof classExtendsConfig?.context === "function") {
          const mockNode = {
            text: "BaseClass"
          } as any;

          const context = classExtendsConfig.context(mockNode);
          expect(context?.extends_class).toBe("BaseClass");
        }
      });
    });
  });

  describe("Integration with AST", () => {
    describe("Function Definitions", () => {
      it("should handle function declarations", () => {
        const code = `function testFunc() {}`;
        const tree = getAstNode(code);
        const functionConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.function");
        expect(functionConfig?.entity).toBe(SemanticEntity.FUNCTION);
      });

      it("should handle arrow functions", () => {
        const code = `const func = () => {}`;
        const tree = getAstNode(code);
        const arrowConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.arrow");
        expect(arrowConfig?.entity).toBe(SemanticEntity.FUNCTION);
      });
    });

    describe("Class Definitions", () => {
      it("should handle class declarations", () => {
        const code = `class TestClass {}`;
        const tree = getAstNode(code);
        const classConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.class");
        expect(classConfig?.entity).toBe(SemanticEntity.CLASS);
      });

      it("should handle method definitions", () => {
        const code = `
class TestClass {
  method() {}
}`;
        const tree = getAstNode(code);
        const methodConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.method");
        expect(methodConfig?.entity).toBe(SemanticEntity.METHOD);
      });

      it("should handle constructor definitions", () => {
        const code = `
class TestClass {
  constructor() {}
}`;
        const tree = getAstNode(code);
        const constructorConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.constructor");
        expect(constructorConfig?.entity).toBe(SemanticEntity.CONSTRUCTOR);
      });
    });

    describe("Import/Export Statements", () => {
      it("should handle named imports", () => {
        const code = `import { func } from 'module';`;
        const tree = getAstNode(code);
        const namedImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.named");
        expect(namedImportConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle default imports", () => {
        const code = `import defaultExport from 'module';`;
        const tree = getAstNode(code);
        const defaultImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.default");
        expect(defaultImportConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle namespace imports", () => {
        const code = `import * as namespace from 'module';`;
        const tree = getAstNode(code);
        const namespaceImportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.namespace");
        expect(namespaceImportConfig?.entity).toBe(SemanticEntity.MODULE);
      });

      it("should handle named exports", () => {
        const code = `export { func };`;
        const tree = getAstNode(code);
        const namedExportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.named");
        expect(namedExportConfig?.entity).toBe(SemanticEntity.VARIABLE);
      });

      it("should handle default exports", () => {
        const code = `export default function() {}`;
        const tree = getAstNode(code);
        const defaultExportConfig = JAVASCRIPT_CAPTURE_CONFIG.get("export.default.function");
        expect(defaultExportConfig?.entity).toBe(SemanticEntity.FUNCTION);
      });
    });

    describe("References", () => {
      it("should handle function calls", () => {
        const code = `func();`;
        const tree = getAstNode(code);
        const callConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.call");
        expect(callConfig?.entity).toBe(SemanticEntity.CALL);
      });

      it("should handle method calls", () => {
        const code = `obj.method();`;
        const tree = getAstNode(code);
        const methodCallConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.method_call");
        expect(methodCallConfig?.entity).toBe(SemanticEntity.CALL);
      });

      it("should handle property access", () => {
        const code = `obj.property`;
        const tree = getAstNode(code);
        const propertyConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.property");
        expect(propertyConfig?.entity).toBe(SemanticEntity.MEMBER_ACCESS);
      });

      it("should handle this references", () => {
        const code = `this.property`;
        const tree = getAstNode(code);
        const thisConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.this");
        expect(thisConfig?.entity).toBe(SemanticEntity.THIS);
      });

      it("should handle super references", () => {
        const code = `super.method()`;
        const tree = getAstNode(code);
        const superConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.super");
        expect(superConfig?.entity).toBe(SemanticEntity.SUPER);
      });
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle empty capture mappings gracefully", () => {
      // Test that all mappings have required properties
      for (const [key, mapping] of Array.from(JAVASCRIPT_CAPTURE_CONFIG.entries())) {
        expect(mapping.category).toBeDefined();
        expect(mapping.entity).toBeDefined();
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it("should handle null/undefined nodes in modifier functions", () => {
      const methodConfig = JAVASCRIPT_CAPTURE_CONFIG.get("def.method");
      if (typeof methodConfig?.modifiers === "function") {
        // These should throw since the functions access .parent without null checks
        expect(() => {
          methodConfig.modifiers(null as any);
        }).toThrow();

        expect(() => {
          methodConfig.modifiers(undefined as any);
        }).toThrow();

        // Empty objects should work (but may still access .parent)
        expect(() => {
          methodConfig.modifiers({} as any);
        }).not.toThrow();
      }
    });

    it("should handle null/undefined nodes in context functions", () => {
      const methodCallConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.method_call");
      if (typeof methodCallConfig?.context === "function") {
        // These should throw since the functions access .parent without null checks
        expect(() => {
          methodCallConfig.context(null as any);
        }).toThrow();

        expect(() => {
          methodCallConfig.context(undefined as any);
        }).toThrow();

        // But empty objects should work
        const result = methodCallConfig.context({} as any);
        expect(result).toBeDefined();
      }
    });

    it("should handle malformed AST structures", () => {
      const importConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.named");
      if (typeof importConfig?.context === "function") {
        // Test with deeply nested null references
        const mockNode = {
          parent: {
            parent: null
          }
        } as any;

        expect(() => {
          importConfig.context(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle missing childForFieldName methods", () => {
      const assignConfig = JAVASCRIPT_CAPTURE_CONFIG.get("assign.target");
      if (typeof assignConfig?.context === "function") {
        const mockNode = {
          parent: {
            // Missing childForFieldName method
          }
        } as any;

        expect(() => {
          assignConfig.context(mockNode);
        }).not.toThrow();
      }
    });

    it("should handle missing text properties", () => {
      const importSourceConfig = JAVASCRIPT_CAPTURE_CONFIG.get("import.source");
      if (typeof importSourceConfig?.context === "function") {
        const mockNode = {
          // Missing text property
          parent: {
            namedChildren: []
          }
        } as any;

        // This should throw since the function tries to slice undefined text
        expect(() => {
          importSourceConfig.context(mockNode);
        }).toThrow();
      }
    });

    it("should handle complex chained property access", () => {
      const deepConfig = JAVASCRIPT_CAPTURE_CONFIG.get("ref.method_call.deep");
      if (typeof deepConfig?.context === "function") {
        // Test with complex nested structure
        const createNestedNode = (depth: number): any => {
          if (depth === 0) {
            return { text: "base" };
          }
          return {
            type: "member_expression",
            childForFieldName: (field: string) => {
              if (field === "property") return { text: `prop${depth}` };
              if (field === "object") return createNestedNode(depth - 1);
              return null;
            }
          };
        };

        const mockNode = {
          parent: {
            childForFieldName: (field: string) => {
              if (field === "object") return createNestedNode(5);
              return null;
            }
          }
        } as any;

        const context = deepConfig.context(mockNode);
        expect(context?.property_chain).toBeDefined();
        expect(Array.isArray(context?.property_chain)).toBe(true);
      }
    });
  });
});