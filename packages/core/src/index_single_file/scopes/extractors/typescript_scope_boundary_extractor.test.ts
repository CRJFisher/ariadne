import { describe, it, expect } from "vitest";
import { TypeScriptScopeBoundaryExtractor } from "./typescript_scope_boundary_extractor";
import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";

describe("TypeScriptScopeBoundaryExtractor", () => {
  const extractor = new TypeScriptScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

  // Helper to create mock nodes
  function createMockNode(
    type: string,
    fields: Record<string, Parser.SyntaxNode | null> = {},
    position = { row: 0, column: 0 },
    endPosition = { row: 0, column: 10 },
    parent: Parser.SyntaxNode | null = null
  ): Parser.SyntaxNode {
    return {
      type,
      text: type,
      startPosition: position,
      endPosition: endPosition,
      parent,
      childForFieldName: (name: string) => fields[name] || null,
      child: () => null,
      children: [],
      childCount: 0,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      hasChanges: () => false,
      hasError: () => false,
      isMissing: () => false,
      isNamed: () => true,
      toString: () => type,
      walk: () => ({} as any),
      descendantForIndex: () => null as any,
      descendantForPosition: () => null as any,
      namedDescendantForIndex: () => null as any,
      namedDescendantForPosition: () => null as any,
    } as unknown as Parser.SyntaxNode;
  }

  describe("TypeScript-specific class-like constructs", () => {
    it("should handle interface declarations", () => {
      const nameNode = createMockNode("identifier");
      const bodyNode = createMockNode("interface_body");
      const interfaceDecl = createMockNode("interface_declaration", {
        name: nameNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(interfaceDecl, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle interface_body nodes directly", () => {
      const nameNode = createMockNode("identifier");
      const parentInterface = createMockNode("interface_declaration", {
        name: nameNode,
      });
      const interfaceBody = createMockNode("interface_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parentInterface);

      const result = extractor.extract_boundaries(interfaceBody, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
    });

    it("should handle enum declarations", () => {
      const nameNode = createMockNode("identifier");
      const bodyNode = createMockNode("enum_body");
      const enumDecl = createMockNode("enum_declaration", {
        name: nameNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(enumDecl, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle enum_body nodes directly", () => {
      const nameNode = createMockNode("identifier");
      const parentEnum = createMockNode("enum_declaration", {
        name: nameNode,
      });
      const enumBody = createMockNode("enum_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parentEnum);

      const result = extractor.extract_boundaries(enumBody, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
    });

    it("should handle namespace declarations", () => {
      const nameNode = createMockNode("identifier");
      const bodyNode = createMockNode("namespace_body");
      const namespaceDecl = createMockNode("namespace_declaration", {
        name: nameNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(namespaceDecl, "module", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should delegate to base class for regular class declarations", () => {
      const nameNode = createMockNode("identifier");
      const bodyNode = createMockNode("class_body");
      const classDecl = createMockNode("class_declaration", {
        name: nameNode,
        body: bodyNode,
      });

      const result = extractor.extract_boundaries(classDecl, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle nodes without type (mock nodes)", () => {
      const mockNode = createMockNode("");
      // Remove the type property to simulate undefined
      delete (mockNode as any).type;

      const result = extractor.extract_boundaries(mockNode, "class", file_path);

      // Should fall back to base class handling
      expect(result.symbol_location).toEqual(result.scope_location);
    });
  });

  describe("Error handling for interface/enum body nodes", () => {
    it("should throw error for interface_body without interface parent", () => {
      const interfaceBody = createMockNode("interface_body");

      expect(() => {
        extractor.extract_boundaries(interfaceBody, "class", file_path);
      }).toThrow("interface_body node must have interface_declaration parent");
    });

    it("should throw error for enum_body without enum parent", () => {
      const enumBody = createMockNode("enum_body");

      expect(() => {
        extractor.extract_boundaries(enumBody, "class", file_path);
      }).toThrow("enum_body node must have enum_declaration parent");
    });

    it("should throw error for interface declaration without name", () => {
      const bodyNode = createMockNode("interface_body");
      const interfaceDecl = createMockNode("interface_declaration", {
        body: bodyNode,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(interfaceDecl, "class", file_path);
      }).toThrow("Interface declaration has no name field");
    });

    it("should throw error for enum declaration without name", () => {
      const bodyNode = createMockNode("enum_body");
      const enumDecl = createMockNode("enum_declaration", {
        body: bodyNode,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(enumDecl, "class", file_path);
      }).toThrow("Enum declaration has no name field");
    });

    it("should throw error for namespace declaration without name", () => {
      const bodyNode = createMockNode("namespace_body");
      const namespaceDecl = createMockNode("namespace_declaration", {
        body: bodyNode,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(namespaceDecl, "module", file_path);
      }).toThrow("Namespace declaration has no name field");
    });

    it("should throw error for namespace declaration without body", () => {
      const nameNode = createMockNode("identifier");
      const namespaceDecl = createMockNode("namespace_declaration", {
        name: nameNode,
        // No body field
      });

      expect(() => {
        extractor.extract_boundaries(namespaceDecl, "module", file_path);
      }).toThrow("Namespace declaration has no body field");
    });
  });

  describe("TypeScript method and function handling", () => {
    it("should handle TypeScript method signatures", () => {
      const nameNode = createMockNode("identifier");
      const paramsNode = createMockNode("formal_parameters");
      const methodSignature = createMockNode("method_signature", {
        name: nameNode,
        parameters: paramsNode,
        // No body for interface method signatures
      });

      const result = extractor.extract_boundaries(methodSignature, "method", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle TypeScript constructor signatures", () => {
      const paramsNode = createMockNode("formal_parameters");
      const constructorSignature = createMockNode("constructor_signature", {
        parameters: paramsNode,
        // No body for interface constructor signatures
      });

      const result = extractor.extract_boundaries(constructorSignature, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("Unsupported node types", () => {
    it("should throw error for unsupported TypeScript class-like node types", () => {
      const unsupportedNode = createMockNode("unsupported_type");

      expect(() => {
        extractor.extract_boundaries(unsupportedNode, "class", file_path);
      }).toThrow("Unsupported TypeScript class-like node type: unsupported_type");
    });
  });
});