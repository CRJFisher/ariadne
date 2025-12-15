import { describe, it, expect } from "vitest";
import { TypeScriptScopeBoundaryExtractor } from "./typescript_scope_boundary_extractor";
import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";

describe("TypeScriptScopeBoundaryExtractor", () => {
  const extractor = new TypeScriptScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

  // Helper to create mock nodes
  function create_mock_node(
    type: string,
    fields: Record<string, Parser.SyntaxNode | null> = {},
    position = { row: 0, column: 0 },
    end_position = { row: 0, column: 10 },
    parent: Parser.SyntaxNode | null = null
  ): Parser.SyntaxNode {
    return {
      type,
      text: type,
      startPosition: position,
      endPosition: end_position,
      parent,
      childForFieldName: (name: string) => fields[name] || null,
      child: () => null,
      children: [],
      childCount: 0,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      has_changes: () => false,
      has_error: () => false,
      is_missing: () => false,
      is_named: () => true,
      to_string: () => type,
      walk: () => ({} as any),
      descendant_for_index: () => null as any,
      descendant_for_position: () => null as any,
      named_descendant_for_index: () => null as any,
      named_descendant_for_position: () => null as any,
    } as unknown as Parser.SyntaxNode;
  }

  describe("TypeScript-specific class-like constructs", () => {
    it("should handle interface declarations", () => {
      const name_node = create_mock_node("identifier");
      const body_node = create_mock_node("interface_body");
      const interface_decl = create_mock_node("interface_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(interface_decl, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle interface_body nodes directly", () => {
      const name_node = create_mock_node("identifier");
      const parent_interface = create_mock_node("interface_declaration", {
        name: name_node,
      });
      const interface_body = create_mock_node("interface_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_interface);

      const result = extractor.extract_boundaries(interface_body, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
    });

    it("should handle enum declarations", () => {
      const name_node = create_mock_node("identifier");
      const body_node = create_mock_node("enum_body");
      const enum_decl = create_mock_node("enum_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(enum_decl, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle enum_body nodes directly", () => {
      const name_node = create_mock_node("identifier");
      const parent_enum = create_mock_node("enum_declaration", {
        name: name_node,
      });
      const enum_body = create_mock_node("enum_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_enum);

      const result = extractor.extract_boundaries(enum_body, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(2);
    });

    it("should handle namespace declarations", () => {
      const name_node = create_mock_node("identifier");
      const body_node = create_mock_node("namespace_body");
      const namespace_decl = create_mock_node("namespace_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(namespace_decl, "module", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should delegate to base class for regular class declarations", () => {
      const name_node = create_mock_node("identifier");
      const body_node = create_mock_node("class_body");
      const class_decl = create_mock_node("class_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(class_decl, "class", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle nodes without type (mock nodes)", () => {
      const mock_node = create_mock_node("");
      // Remove the type property to simulate undefined
      delete (mock_node as any).type;

      const result = extractor.extract_boundaries(mock_node, "class", file_path);

      // Should fall back to base class handling
      expect(result.symbol_location).toEqual(result.scope_location);
    });
  });

  describe("Error handling for interface/enum body nodes", () => {
    it("should throw error for interface_body without interface parent", () => {
      const interface_body = create_mock_node("interface_body");

      expect(() => {
        extractor.extract_boundaries(interface_body, "class", file_path);
      }).toThrow("interface_body node must have interface_declaration parent");
    });

    it("should throw error for enum_body without enum parent", () => {
      const enum_body = create_mock_node("enum_body");

      expect(() => {
        extractor.extract_boundaries(enum_body, "class", file_path);
      }).toThrow("enum_body node must have enum_declaration parent");
    });

    it("should throw error for interface declaration without name", () => {
      const body_node = create_mock_node("interface_body");
      const interface_decl = create_mock_node("interface_declaration", {
        body: body_node,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(interface_decl, "class", file_path);
      }).toThrow("Interface declaration has no name field");
    });

    it("should throw error for enum declaration without name", () => {
      const body_node = create_mock_node("enum_body");
      const enum_decl = create_mock_node("enum_declaration", {
        body: body_node,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(enum_decl, "class", file_path);
      }).toThrow("Enum declaration has no name field");
    });

    it("should throw error for namespace declaration without name", () => {
      const body_node = create_mock_node("namespace_body");
      const namespace_decl = create_mock_node("namespace_declaration", {
        body: body_node,
        // No name field
      });

      expect(() => {
        extractor.extract_boundaries(namespace_decl, "module", file_path);
      }).toThrow("Namespace declaration has no name field");
    });

    it("should throw error for namespace declaration without body", () => {
      const name_node = create_mock_node("identifier");
      const namespace_decl = create_mock_node("namespace_declaration", {
        name: name_node,
        // No body field
      });

      expect(() => {
        extractor.extract_boundaries(namespace_decl, "module", file_path);
      }).toThrow("Namespace declaration has no body field");
    });
  });

  describe("TypeScript method and function handling", () => {
    it("should handle TypeScript method signatures", () => {
      const name_node = create_mock_node("identifier");
      const params_node = create_mock_node("formal_parameters");
      const method_signature = create_mock_node("method_signature", {
        name: name_node,
        parameters: params_node,
        // No body for interface method signatures
      });

      const result = extractor.extract_boundaries(method_signature, "method", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });

    it("should handle TypeScript constructor signatures", () => {
      const params_node = create_mock_node("formal_parameters");
      const constructor_signature = create_mock_node("constructor_signature", {
        parameters: params_node,
        // No body for interface constructor signatures
      });

      const result = extractor.extract_boundaries(constructor_signature, "constructor", file_path);

      expect(result.symbol_location.start_line).toBe(1);
      expect(result.scope_location.start_line).toBe(1);
    });
  });

  describe("Unsupported node types", () => {
    it("should throw error for unsupported TypeScript class-like node types", () => {
      const unsupported_node = create_mock_node("unsupported_type");

      expect(() => {
        extractor.extract_boundaries(unsupported_node, "class", file_path);
      }).toThrow("Unsupported TypeScript class-like node type: unsupported_type");
    });
  });
});