import { describe, it, expect } from "vitest";
import { TypeScriptScopeBoundaryExtractor } from "./typescript_scope_boundary_extractor";
import type { ScopeBoundaries } from "../boundary_base";
import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";

describe("TypeScriptScopeBoundaryExtractor", () => {
  const extractor = new TypeScriptScopeBoundaryExtractor();
  const file_path = "test.ts" as FilePath;

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
      // eslint-disable-next-line @typescript-eslint/naming-convention
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
    } as Partial<Parser.SyntaxNode> as Parser.SyntaxNode;
  }

  describe("TypeScript class-like constructs", () => {
    it("scopes an interface declaration to its name and body", () => {
      const name_node = create_mock_node("type_identifier", {}, { row: 0, column: 10 }, { row: 0, column: 19 });
      const body_node = create_mock_node("interface_body", {}, { row: 0, column: 20 }, { row: 4, column: 1 });
      const interface_decl = create_mock_node("interface_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(interface_decl, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 11, end_line: 1, end_column: 19 },
        scope_location: { file_path, start_line: 1, start_column: 21, end_line: 5, end_column: 1 },
      };
      expect(result).toEqual(expected);
    });

    it("resolves an interface_body node through its parent declaration", () => {
      const name_node = create_mock_node("type_identifier", {}, { row: 0, column: 10 }, { row: 0, column: 19 });
      const parent_interface = create_mock_node("interface_declaration", { name: name_node });
      const interface_body = create_mock_node("interface_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_interface);

      const result = extractor.extract_boundaries(interface_body, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 11, end_line: 1, end_column: 19 },
        scope_location: { file_path, start_line: 2, start_column: 11, end_line: 4, end_column: 1 },
      };
      expect(result).toEqual(expected);
    });

    it("scopes an enum declaration to its name and body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 5 }, { row: 0, column: 10 });
      const body_node = create_mock_node("enum_body", {}, { row: 0, column: 11 }, { row: 3, column: 1 });
      const enum_decl = create_mock_node("enum_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(enum_decl, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 6, end_line: 1, end_column: 10 },
        scope_location: { file_path, start_line: 1, start_column: 12, end_line: 4, end_column: 1 },
      };
      expect(result).toEqual(expected);
    });

    it("resolves an enum_body node through its parent declaration", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 5 }, { row: 0, column: 10 });
      const parent_enum = create_mock_node("enum_declaration", { name: name_node });
      const enum_body = create_mock_node("enum_body", {}, { row: 1, column: 10 }, { row: 3, column: 1 }, parent_enum);

      const result = extractor.extract_boundaries(enum_body, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 6, end_line: 1, end_column: 10 },
        scope_location: { file_path, start_line: 2, start_column: 11, end_line: 4, end_column: 1 },
      };
      expect(result).toEqual(expected);
    });

    it("delegates a regular class declaration to the base extractor", () => {
      const name_node = create_mock_node("type_identifier", {}, { row: 0, column: 6 }, { row: 0, column: 9 });
      const body_node = create_mock_node("class_body", {}, { row: 0, column: 10 }, { row: 5, column: 1 });
      const class_decl = create_mock_node("class_declaration", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(class_decl, "class", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 7, end_line: 1, end_column: 9 },
        scope_location: { file_path, start_line: 1, start_column: 11, end_line: 6, end_column: 1 },
      };
      expect(result).toEqual(expected);
    });
  });

  describe("TypeScript namespace/module constructs", () => {
    it("scopes a namespace declaration to its name and body", () => {
      const name_node = create_mock_node("identifier", {}, { row: 0, column: 10 }, { row: 0, column: 15 });
      const body_node = create_mock_node("statement_block", {}, { row: 0, column: 16 }, { row: 5, column: 1 });
      const namespace_decl = create_mock_node("internal_module", {
        name: name_node,
        body: body_node,
      });

      const result = extractor.extract_boundaries(namespace_decl, "module", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 11, end_line: 1, end_column: 15 },
        scope_location: { file_path, start_line: 1, start_column: 17, end_line: 6, end_column: 1 },
      };
      expect(result).toEqual(expected);
    });

    it("maps the root program node to its own full location", () => {
      const program = create_mock_node("program", {}, { row: 0, column: 0 }, { row: 10, column: 0 });

      const result = extractor.extract_boundaries(program, "module", file_path);

      const location = { file_path, start_line: 1, start_column: 1, end_line: 11, end_column: 0 };
      const expected: ScopeBoundaries = {
        symbol_location: location,
        scope_location: location,
      };
      expect(result).toEqual(expected);
    });
  });

  describe("TypeScript method and constructor signatures", () => {
    it("scopes a body-less method signature to its parameters", () => {
      const name_node = create_mock_node("property_identifier", {}, { row: 0, column: 2 }, { row: 0, column: 8 });
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 8 }, { row: 0, column: 20 });
      const method_signature = create_mock_node("method_signature", {
        name: name_node,
        parameters: params_node,
      });

      const result = extractor.extract_boundaries(method_signature, "method", file_path);

      const expected: ScopeBoundaries = {
        symbol_location: { file_path, start_line: 1, start_column: 3, end_line: 1, end_column: 8 },
        scope_location: { file_path, start_line: 1, start_column: 9, end_line: 1, end_column: 20 },
      };
      expect(result).toEqual(expected);
    });

    it("scopes a body-less constructor signature to its parameters", () => {
      const params_node = create_mock_node("formal_parameters", {}, { row: 0, column: 11 }, { row: 0, column: 25 });
      const constructor_signature = create_mock_node("constructor_signature", {
        parameters: params_node,
      });

      const result = extractor.extract_boundaries(constructor_signature, "constructor", file_path);

      const params_location = { file_path, start_line: 1, start_column: 12, end_line: 1, end_column: 25 };
      const expected: ScopeBoundaries = {
        symbol_location: params_location,
        scope_location: params_location,
      };
      expect(result).toEqual(expected);
    });
  });

  describe("malformed node handling", () => {
    it("throws when an interface_body has no interface_declaration parent", () => {
      const interface_body = create_mock_node("interface_body");

      expect(() => {
        extractor.extract_boundaries(interface_body, "class", file_path);
      }).toThrow("interface_body node must have interface_declaration parent");
    });

    it("throws when an enum_body has no enum_declaration parent", () => {
      const enum_body = create_mock_node("enum_body");

      expect(() => {
        extractor.extract_boundaries(enum_body, "class", file_path);
      }).toThrow("enum_body node must have enum_declaration parent");
    });

    it("throws when an interface declaration has no name field", () => {
      const body_node = create_mock_node("interface_body");
      const interface_decl = create_mock_node("interface_declaration", { body: body_node });

      expect(() => {
        extractor.extract_boundaries(interface_decl, "class", file_path);
      }).toThrow("Interface declaration has no name field");
    });

    it("throws when an interface declaration has no body field", () => {
      const name_node = create_mock_node("type_identifier");
      const interface_decl = create_mock_node("interface_declaration", { name: name_node });

      expect(() => {
        extractor.extract_boundaries(interface_decl, "class", file_path);
      }).toThrow("Interface declaration has no body field");
    });

    it("throws when an enum declaration has no name field", () => {
      const body_node = create_mock_node("enum_body");
      const enum_decl = create_mock_node("enum_declaration", { body: body_node });

      expect(() => {
        extractor.extract_boundaries(enum_decl, "class", file_path);
      }).toThrow("Enum declaration has no name field");
    });

    it("throws when an enum declaration has no body field", () => {
      const name_node = create_mock_node("identifier");
      const enum_decl = create_mock_node("enum_declaration", { name: name_node });

      expect(() => {
        extractor.extract_boundaries(enum_decl, "class", file_path);
      }).toThrow("Enum declaration has no body field");
    });

    it("throws when a namespace declaration has no name field", () => {
      const body_node = create_mock_node("statement_block");
      const namespace_decl = create_mock_node("internal_module", { body: body_node });

      expect(() => {
        extractor.extract_boundaries(namespace_decl, "module", file_path);
      }).toThrow("Namespace declaration has no name field");
    });

    it("throws when a namespace declaration has no body field", () => {
      const name_node = create_mock_node("identifier");
      const namespace_decl = create_mock_node("internal_module", { name: name_node });

      expect(() => {
        extractor.extract_boundaries(namespace_decl, "module", file_path);
      }).toThrow("Namespace declaration has no body field");
    });

    it("throws for an unsupported TypeScript class-like node type", () => {
      const unsupported_node = create_mock_node("unsupported_type");

      expect(() => {
        extractor.extract_boundaries(unsupported_node, "class", file_path);
      }).toThrow("Unsupported TypeScript class-like node type: unsupported_type");
    });
  });
});
