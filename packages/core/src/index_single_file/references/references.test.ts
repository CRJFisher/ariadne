/**
 * Tests for Reference Builder System
 */

import { describe, it, expect, beforeEach, vi, test } from "vitest";
import {
  ReferenceBuilder,
  process_references,
} from "./references";
import type { ProcessingContext, CaptureNode } from "../index_single_file";
import { SemanticCategory, SemanticEntity } from "../index_single_file";
import type {
  Location,
  ScopeId,
  TypeInfo,
  SymbolName,
  SymbolId,
} from "@ariadnejs/types";
import { module_scope } from "@ariadnejs/types";
import type { MetadataExtractors, ReceiverInfo } from "../query_code_tree/metadata_extractors";

// ============================================================================
// Mock Metadata Extractors
// ============================================================================

/**
 * Create mock metadata extractors for testing
 */
function create_mock_extractors(
  overrides: Partial<MetadataExtractors> = {}
): MetadataExtractors {
  return {
    extract_type_from_annotation: vi.fn((node, file_path) => undefined),
    extract_call_receiver: vi.fn((node, file_path) => undefined),
    extract_property_chain: vi.fn((node) => undefined),
    extract_assignment_parts: vi.fn((node, file_path) => ({
      source: undefined,
      target: undefined,
    })),
    extract_construct_target: vi.fn((node, file_path) => undefined),
    extract_type_arguments: vi.fn((node) => undefined),
    extract_is_optional_chain: vi.fn((node) => false),
    is_method_call: vi.fn((node) => false),
    extract_call_name: vi.fn((node) => undefined),
    extract_receiver_info: vi.fn((node, file_path) => undefined),
    ...overrides,
  };
}

// ============================================================================
// Test Utilities
// ============================================================================

function create_test_location(
  start_line: number = 1,
  column: number = 0,
  file_path: string = "test.ts"
): Location {
  return {
    file_path: file_path as any, // Cast for test simplicity
    start_line: start_line,
    start_column: column,
    end_line: start_line,
    end_column: column + 10,
  };
}

function create_test_context(): ProcessingContext {
  const location = create_test_location();
  const root_scope_id = module_scope(location);

  return {
    captures: [], // Empty captures array for test context
    scopes: new Map(),
    scope_depths: new Map(),
    root_scope_id,
    get_scope_id: (loc: Location) => root_scope_id,
    get_child_scope_with_symbol_name: (scope_id: ScopeId, name: SymbolName) => root_scope_id,
  };
}

function create_test_capture(
  overrides: {
    category?: any;
    entity?: any;
    symbol_name?: string;
    node_location?: Location;
    [key: string]: any;
  } = {}
): CaptureNode {
  const location = overrides.node_location || create_test_location();
  const symbol_name = overrides.symbol_name || "testVar";

  // Map old category to new name format
  let category_str = "reference";
  if (overrides.category !== undefined) {
    // Handle both enum values and direct strings
    if (typeof overrides.category === "string") {
      category_str = overrides.category;
    } else {
      switch (overrides.category) {
        case SemanticCategory.REFERENCE:
          category_str = "reference";
          break;
        case SemanticCategory.DEFINITION:
          category_str = "definition";
          break;
        case SemanticCategory.ASSIGNMENT:
          category_str = "assignment";
          break;
        case SemanticCategory.SCOPE:
          category_str = "scope";
          break;
        case SemanticCategory.IMPORT:
          category_str = "import";
          break;
        case SemanticCategory.EXPORT:
          category_str = "export";
          break;
      }
    }
  }

  // Map old entity to new name format - entity is already a string in the enum
  const entity_str = overrides.entity || "variable";

  const mock_node = {
    text: symbol_name,
    startPosition: {
      row: location.start_line - 1,
      column: location.start_column,
    },
    endPosition: { row: location.end_line - 1, column: location.end_column },
  };

  return {
    category: category_str as any,
    entity: entity_str as any,
    name: `${category_str}.${entity_str}`,
    node: mock_node as any,
    text: symbol_name as any,
    location: location,
  };
}

// ============================================================================
// Tests
// ============================================================================

// Tests updated to work with new ReferenceBuilder signature that accepts
// metadata extractors and file_path parameters
describe("ReferenceBuilder", () => {
  let context: ProcessingContext;
  let builder: ReferenceBuilder;
  const TEST_FILE_PATH = "test.ts" as any;

  beforeEach(() => {
    context = create_test_context();
    // Pass undefined for extractors (no language-specific extractors in tests yet)
    builder = new ReferenceBuilder(context, undefined, TEST_FILE_PATH);
  });

  describe("process", () => {
    it("should ignore non-reference captures", () => {
      const capture = create_test_capture({
        category: SemanticCategory.DEFINITION,
        entity: SemanticEntity.FUNCTION,
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(0);
    });

    it("should process variable references", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "myVar" as any,
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("myVar");
      expect(references[0].kind).toBe("variable_reference");
      if (references[0].kind === "variable_reference") {
        expect(references[0].access_type).toBe("read");
      }
    });

    it("should process function calls", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        symbol_name: "doSomething",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("doSomething");
      expect(references[0].kind).toBe("function_call");
    });

    it("should process method calls with object context", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getValue",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("getValue");
      // Without extractors providing receiver_info, method calls fall back to function calls
      expect(references[0].kind).toBe("function_call");
    });

    it("should process constructor calls", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: "constructor", // Use "constructor" entity to trigger constructor detection
        symbol_name: "MyClass",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("MyClass");
      expect(references[0].kind).toBe("constructor_call");
      if (references[0].kind === "constructor_call") {
        // Without extractors, construct_target will be undefined (standalone call)
        expect(references[0].construct_target).toBeUndefined();
      }
    });

    it("should process type references", () => {
      const mock_extractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "MyType" as SymbolName,
          type_id: "type:MyType:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "MyType",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("MyType");
      expect(references[0].kind).toBe("type_reference");
      if (references[0].kind === "type_reference") {
        expect(references[0].type_context).toBe("annotation");
      }
    });

    it("should process type references with generics", () => {
      const mock_extractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "Array" as SymbolName,
          type_id: "type:Array:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
        extract_type_arguments: vi.fn((node) => ["string"]),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "Array",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("Array");
      expect(references[0].kind).toBe("type_reference");
      // Generic type info extraction is not yet implemented in factories
      // This will be added in future tasks
    });

    it("should process property access", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(),
        property_chain: ["arr" as SymbolName, "length" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_is_optional_chain: vi.fn((node) => true),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "length",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("length");
      expect(references[0].kind).toBe("property_access");
      if (references[0].kind === "property_access") {
        expect(references[0].access_type).toBe("property");
        expect(references[0].is_optional_chain).toBe(true);
      }
    });

    it("should process assignments with type flow", () => {
      const mock_extractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "number" as SymbolName,
          type_id: "type:number:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "result",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("result");
      expect(references[0].kind).toBe("assignment");
      if (references[0].kind === "assignment") {
        expect(references[0].target_location).toBeDefined();
      }
    });

    it("should process return references", () => {
      const capture = create_test_capture({
        category: "return", // Return category
        entity: "value", // Any entity works with return category
        symbol_name: "value",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("value");
      // Return references are currently mapped to variable_reference
      expect(references[0].kind).toBe("variable_reference");
    });

    it("should handle super calls", () => {
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.SUPER,
        symbol_name: "super",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("super");
      expect(references[0].kind).toBe("self_reference_call");
      if (references[0].kind === "self_reference_call") {
        expect(references[0].keyword).toBe("super");
      }
    });

    it("should chain multiple references", () => {
      const capture1 = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "var1",
      });

      const capture2 = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.CALL,
        symbol_name: "func1",
      });

      const capture3 = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "Type1",
      });

      builder.process(capture1).process(capture2).process(capture3);
      const references = builder.references;

      expect(references).toHaveLength(3);
      expect(references[0].name).toBe("var1");
      expect(references[1].name).toBe("func1");
      expect(references[2].name).toBe("Type1");
    });
  });

  describe("self-reference call detection", () => {
    test("creates SelfReferenceCall for this.method() with ReceiverInfo", () => {
      const mock_location = create_test_location(10, 5);
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(10, 5),
        property_chain: ["this" as SymbolName, "build_class" as SymbolName],
        is_self_reference: true,
        self_keyword: "this",
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "build_class" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "build_class",
        node_location: mock_location,
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      const ref = references[0];

      // Check discriminated union type
      expect(ref.kind).toBe("self_reference_call");

      // Use type narrowing to access SelfReferenceCall-specific fields
      if (ref.kind === "self_reference_call") {
        expect(ref.keyword).toBe("this");
        expect(ref.property_chain).toEqual(["this", "build_class"]);
        expect(ref.name).toBe("build_class");
      }
    });

    test("creates SelfReferenceCall for self.method() in Python", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(5, 2),
        property_chain: ["self" as SymbolName, "process_data" as SymbolName],
        is_self_reference: true,
        self_keyword: "self",
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "process_data" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "process_data",
      });

      builder.process(capture);
      const ref = builder.references[0];

      expect(ref.kind).toBe("self_reference_call");
      if (ref.kind === "self_reference_call") {
        expect(ref.keyword).toBe("self");
        expect(ref.property_chain).toEqual(["self", "process_data"]);
      }
    });

    test("creates SelfReferenceCall for super.method()", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(8, 4),
        property_chain: ["super" as SymbolName, "init" as SymbolName],
        is_self_reference: true,
        self_keyword: "super",
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "init" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "init",
      });

      builder.process(capture);
      const ref = builder.references[0];

      expect(ref.kind).toBe("self_reference_call");
      if (ref.kind === "self_reference_call") {
        expect(ref.keyword).toBe("super");
      }
    });

    test("creates SelfReferenceCall for cls.method() in Python", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(12, 8),
        property_chain: ["cls" as SymbolName, "class_method" as SymbolName],
        is_self_reference: true,
        self_keyword: "cls",
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "class_method" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "class_method",
      });

      builder.process(capture);
      const ref = builder.references[0];

      expect(ref.kind).toBe("self_reference_call");
      if (ref.kind === "self_reference_call") {
        expect(ref.keyword).toBe("cls");
      }
    });

    test("creates MethodCallReference for regular obj.method() calls", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(15, 0),
        property_chain: ["user" as SymbolName, "getName" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "getName" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getName",
      });

      builder.process(capture);
      const ref = builder.references[0];

      // Regular method call should NOT be self_reference_call
      expect(ref.kind).toBe("method_call");
      if (ref.kind === "method_call") {
        expect(ref.property_chain).toEqual(["user", "getName"]);
        expect(ref.receiver_location).toEqual(receiver_info.receiver_location);
      }
    });

    test("creates FunctionCallReference when no receiver info available", () => {
      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => undefined),
        extract_call_name: vi.fn((node) => "standalone_function" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "standalone_function",
      });

      builder.process(capture);
      const ref = builder.references[0];

      // No receiver info → fallback to function call
      expect(ref.kind).toBe("function_call");
    });
  });

  describe("process_references pipeline", () => {
    it("should filter and process only reference captures", () => {
      const captures: CaptureNode[] = [
        create_test_capture({
          category: SemanticCategory.DEFINITION,
          entity: SemanticEntity.FUNCTION,
          symbol_name: "ignored",
        }),
        create_test_capture({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          symbol_name: "included1",
        }),
        create_test_capture({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.CALL,
          symbol_name: "included2",
        }),
        create_test_capture({
          category: SemanticCategory.SCOPE,
          entity: SemanticEntity.BLOCK,
          symbol_name: "ignored2",
        }),
      ];

      // Update context with captures
      const test_context = { ...context, captures };
      const references = process_references(
        test_context,
        undefined,
        TEST_FILE_PATH
      );

      expect(references).toHaveLength(2);
      expect(references[0].name).toBe("included1");
      expect(references[1].name).toBe("included2");
    });

    it("should preserve scope context", () => {
      const custom_scope_id = "function:test.ts:10:0:20:0:myFunc" as ScopeId;

      const captures = [
        create_test_capture({
          category: SemanticCategory.REFERENCE,
          entity: SemanticEntity.VARIABLE,
          symbol_name: "myVar",
        }),
      ];

      const custom_context: ProcessingContext = {
        ...context,
        captures,
        get_scope_id: (loc: Location) => custom_scope_id,
      };

      const references = process_references(
        custom_context,
        undefined,
        TEST_FILE_PATH
      );

      expect(references).toHaveLength(1);
      expect(references[0].scope_id).toBe(custom_scope_id);
    });
  });

  describe("metadata extractors integration", () => {
    it("should call extract_receiver_info for method calls", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(5, 10),
        property_chain: ["obj" as SymbolName, "getValue" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "getValue" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getValue",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mock_extractors.extract_receiver_info).toHaveBeenCalledWith(
        capture.node,
        TEST_FILE_PATH
      );
      expect(references[0].kind).toBe("method_call");
      if (references[0].kind === "method_call") {
        expect(references[0].receiver_location).toEqual(receiver_info.receiver_location);
      }
    });

    it("should call extract_receiver_info for property access", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(3, 0),
        property_chain: ["obj" as SymbolName, "nested" as SymbolName, "value" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_is_optional_chain: vi.fn((node) => false),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "value",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mock_extractors.extract_receiver_info).toHaveBeenCalledWith(
        capture.node,
        TEST_FILE_PATH
      );
      expect(references[0].kind).toBe("property_access");
      if (references[0].kind === "property_access") {
        expect(references[0].property_chain).toEqual(receiver_info.property_chain);
      }
    });

    it("should call extract_construct_target for constructor calls", () => {
      const target_location = create_test_location(3, 6);
      const mock_extractors = create_mock_extractors({
        extract_construct_target: vi.fn((node, file_path) => target_location),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: "constructor",
        symbol_name: "MyClass",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mock_extractors.extract_construct_target).toHaveBeenCalledWith(
        capture.node,
        TEST_FILE_PATH
      );
      expect(references[0].kind).toBe("constructor_call");
      if (references[0].kind === "constructor_call") {
        expect(references[0].construct_target).toEqual(target_location);
      }
    });

    it("should handle complex method calls with receiver info", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(1, 0),
        property_chain: ["obj" as SymbolName, "method" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "method" as SymbolName),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "method",
      });

      builder.process(capture);
      const references = builder.references;

      // Verify extractor was called
      expect(mock_extractors.extract_receiver_info).toHaveBeenCalled();

      // Verify the reference has extracted metadata
      expect(references[0].kind).toBe("method_call");
      if (references[0].kind === "method_call") {
        expect(references[0].receiver_location).toEqual(receiver_info.receiver_location);
        expect(references[0].property_chain).toEqual(receiver_info.property_chain);
      }
    });

    it("should handle undefined extractors gracefully", () => {
      // Test with no extractors (undefined)
      const builder = new ReferenceBuilder(context, undefined, TEST_FILE_PATH);
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getValue",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("getValue");
      // Without extractors, method calls fallback to function calls
      expect(references[0].kind).toBe("function_call");
    });

    it("should handle extractors returning undefined", () => {
      // All extractors return undefined
      const mock_extractors = create_mock_extractors();

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getValue",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe("getValue");
      expect(references[0].type_info).toBeUndefined(); // No type info when extractors return undefined
    });

    it("should populate property_chain for property access with receiver info", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(),
        property_chain: ["arr" as SymbolName, "length" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_is_optional_chain: vi.fn((node) => false),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "length",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].kind).toBe("property_access");
      if (references[0].kind === "property_access") {
        expect(references[0].access_type).toBe("property");
        expect(references[0].property_chain).toEqual(receiver_info.property_chain);
      }
    });

    it("should create variable references when no extractors provide data", () => {
      const mock_extractors = create_mock_extractors();

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "myVar",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].kind).toBe("variable_reference");
    });

    it("should populate property chain when receiver info available", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(),
        property_chain: ["obj" as SymbolName, "prop" as SymbolName],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_is_optional_chain: vi.fn((node) => false),
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "prop",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].kind).toBe("property_access");
      if (references[0].kind === "property_access") {
        expect(references[0].property_chain).toEqual(receiver_info.property_chain);
        expect(references[0].receiver_location).toEqual(receiver_info.receiver_location);
      }
    });
  });

  describe("complex scenarios", () => {
    it("should handle method call with property chain", () => {
      const receiver_info: ReceiverInfo = {
        receiver_location: create_test_location(),
        property_chain: [
          "person" as SymbolName,
          "address" as SymbolName,
          "toString" as SymbolName,
        ],
        is_self_reference: false,
      };

      const mock_extractors = create_mock_extractors({
        extract_receiver_info: vi.fn((node, file_path) => receiver_info),
        extract_call_name: vi.fn((node) => "toString" as SymbolName) as any,
      });

      const builder = new ReferenceBuilder(
        context,
        mock_extractors,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "toString",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].kind).toBe("method_call");
      if (references[0].kind === "method_call") {
        expect(references[0].property_chain).toEqual([
          "person",
          "address",
          "toString",
        ]);
      }
    });

    it("should handle type references", () => {
      const builder = new ReferenceBuilder(
        context,
        undefined,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "string",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].kind).toBe("type_reference");
    });

    it("should handle assignments", () => {
      const builder = new ReferenceBuilder(
        context,
        undefined,
        TEST_FILE_PATH
      );

      const capture = create_test_capture({
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "value",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references).toHaveLength(1);
      expect(references[0].kind).toBe("assignment");
    });
  });
});
