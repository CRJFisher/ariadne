/**
 * Tests for Reference Builder System
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ReferenceBuilder,
  process_references,
} from "./reference_builder";
import type { ProcessingContext, CaptureNode } from "../semantic_index";
import { SemanticCategory, SemanticEntity } from "../semantic_index";
import type {
  Location,
  ScopeId,
  TypeInfo,
  SymbolName,
  SymbolId,
} from "@ariadnejs/types";
import { module_scope } from "@ariadnejs/types";
import type { MetadataExtractors } from "../query_code_tree/language_configs/metadata_types";

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
      expect(references[0].type).toBe("read");
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
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("function");
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
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("method");
      expect(references[0].member_access).toBeDefined();
      expect(references[0].member_access?.access_type).toBe("method");
      // object_type requires extractors to be populated
      // This will be available once language-specific extractors are implemented
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
      expect(references[0].type).toBe("construct");
      expect(references[0].call_type).toBe("constructor");
    });

    it("should process type references", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "MyType" as SymbolName,
          type_id: "type:MyType:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].type).toBe("type");
      expect(references[0].type_info?.type_name).toBe("MyType");
    });

    it("should process type references with generics", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "Array" as SymbolName,
          type_id: "type:Array:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
        extract_type_arguments: vi.fn((node) => ["string"]),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].type).toBe("type");
      expect(references[0].type_info?.type_name).toBe("Array<string>");
    });

    it("should process property access", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "Array" as SymbolName,
          type_id: "type:Array:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
        extract_is_optional_chain: vi.fn((node) => true),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].type).toBe("member_access");
      expect(references[0].member_access).toBeDefined();
      expect(references[0].member_access?.access_type).toBe("property");
      expect(references[0].member_access?.is_optional_chain).toBe(true);
    });

    it("should process assignments with type flow", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "number" as SymbolName,
          type_id: "type:number:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].type).toBe("assignment");
      expect(references[0].assignment_type).toBeDefined();
      expect(references[0].assignment_type?.type_name).toBe("number");
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
      expect(references[0].type).toBe("return");
      // return_type metadata requires extractors, so it will be undefined without them
      // This will be populated once language-specific extractors are implemented
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
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("super");
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
    it("should call extract_type_from_annotation for type references", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "string" as SymbolName,
          type_id: "type:string:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "string",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mockExtractors.extract_type_from_annotation).toHaveBeenCalledWith(
        capture.node,
        TEST_FILE_PATH
      );
      expect(references[0].type_info).toEqual({
        type_name: "string",
        type_id: "type:string:test.ts:1:0",
        certainty: "declared",
      });
    });

    it("should call extract_call_receiver for method calls", () => {
      const receiverLocation = create_test_location(5, 10);
      const mockExtractors = create_mock_extractors({
        extract_call_receiver: vi.fn((node, file_path) => receiverLocation),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "getValue",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mockExtractors.extract_call_receiver).toHaveBeenCalledWith(
        capture.node,
        TEST_FILE_PATH
      );
      expect(references[0].context?.receiver_location).toEqual(
        receiverLocation
      );
    });

    it("should call extract_property_chain for member access", () => {
      const propertyChain: SymbolName[] = [
        "obj",
        "nested",
        "value",
      ] as SymbolName[];
      const mockExtractors = create_mock_extractors({
        extract_property_chain: vi.fn((node) => propertyChain),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "value",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mockExtractors.extract_property_chain).toHaveBeenCalledWith(
        capture.node
      );
      expect(references[0].context?.property_chain).toEqual(propertyChain);
    });

    it("should call extract_construct_target for constructor calls", () => {
      const targetLocation = create_test_location(3, 6);
      const mockExtractors = create_mock_extractors({
        extract_construct_target: vi.fn((node, file_path) => targetLocation),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: "constructor",
        symbol_name: "MyClass",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mockExtractors.extract_construct_target).toHaveBeenCalledWith(
        capture.node,
        TEST_FILE_PATH
      );
      expect(references[0].context?.construct_target).toEqual(targetLocation);
    });

    it("should call extract_type_arguments for generic types", () => {
      const typeArgs = ["string", "number"];
      const mockExtractors = create_mock_extractors({
        extract_type_arguments: vi.fn((node) => typeArgs),
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "Map" as SymbolName,
          type_id: "type:Map:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.TYPE,
        symbol_name: "Map",
      });

      builder.process(capture);
      const references = builder.references;

      expect(mockExtractors.extract_type_arguments).toHaveBeenCalledWith(
        capture.node
      );
      expect(references[0].type_info?.type_name).toBe("Map<string, number>");
    });

    it("should handle multiple extractor calls for complex references", () => {
      const receiverLocation = create_test_location(1, 0);
      const propertyChain: SymbolName[] = ["obj", "method"] as SymbolName[];
      const typeInfo: TypeInfo = {
        type_name: "MyClass" as SymbolName,
        type_id: "type:MyClass:test.ts:1:0" as SymbolId,
        certainty: "inferred" as const,
      };

      const mockExtractors = create_mock_extractors({
        extract_call_receiver: vi.fn((node, file_path) => receiverLocation),
        extract_property_chain: vi.fn((node) => propertyChain),
        extract_type_from_annotation: vi.fn((node, file_path) => typeInfo),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.METHOD,
        symbol_name: "method",
      });

      builder.process(capture);
      const references = builder.references;

      // Verify all relevant extractors were called
      expect(mockExtractors.extract_call_receiver).toHaveBeenCalled();
      expect(mockExtractors.extract_property_chain).toHaveBeenCalled();
      expect(mockExtractors.extract_type_from_annotation).toHaveBeenCalled();

      // Verify the reference has all the extracted metadata
      expect(references[0].context?.receiver_location).toEqual(
        receiverLocation
      );
      expect(references[0].context?.property_chain).toEqual(propertyChain);
      expect(references[0].member_access?.object_type).toEqual(typeInfo);
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
      expect(references[0].type).toBe("call");
      expect(references[0].call_type).toBe("method");
      expect(references[0].context).toBeUndefined(); // No context without extractors
      expect(references[0].type_info).toBeUndefined(); // No type info without extractors
    });

    it("should handle extractors returning undefined", () => {
      // All extractors return undefined
      const mockExtractors = create_mock_extractors();

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].context).toBeUndefined(); // No context when extractors return undefined
      expect(references[0].type_info).toBeUndefined(); // No type info when extractors return undefined
    });

    it("should populate member_access for property references with extractors", () => {
      const typeInfo: TypeInfo = {
        type_name: "Array" as SymbolName,
        type_id: "type:Array:test.ts:1:0" as SymbolId,
        certainty: "declared" as const,
      };

      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => typeInfo),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "length",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].member_access).toBeDefined();
      expect(references[0].member_access?.access_type).toBe("property");
      expect(references[0].member_access?.object_type).toEqual(typeInfo);
    });

    it("should populate assignment_type for assignments with extractors", () => {
      const typeInfo: TypeInfo = {
        type_name: "number" as SymbolName,
        type_id: "type:number:test.ts:1:0" as SymbolId,
        certainty: "declared" as const,
      };

      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => typeInfo),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.ASSIGNMENT,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "result",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].assignment_type).toBeDefined();
      expect(references[0].assignment_type).toEqual(typeInfo);
    });

    it("should populate return_type for return references with extractors", () => {
      const typeInfo: TypeInfo = {
        type_name: "Promise" as SymbolName,
        type_id: "type:Promise:test.ts:1:0" as SymbolId,
        certainty: "inferred" as const,
      };

      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => typeInfo),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: "return",
        entity: "value",
        symbol_name: "result",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].return_type).toEqual(typeInfo);
    });

    it("should not add empty context object when all extractors return undefined", () => {
      const mockExtractors = create_mock_extractors();

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.VARIABLE,
        symbol_name: "myVar",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].context).toBeUndefined();
    });

    it("should add context only when extractors return data", () => {
      const propertyChain: SymbolName[] = ["obj", "prop"] as SymbolName[];
      const mockExtractors = create_mock_extractors({
        extract_property_chain: vi.fn((node) => propertyChain),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
        TEST_FILE_PATH
      );
      const capture = create_test_capture({
        category: SemanticCategory.REFERENCE,
        entity: SemanticEntity.PROPERTY,
        symbol_name: "prop",
      });

      builder.process(capture);
      const references = builder.references;

      expect(references[0].context).toBeDefined();
      expect(references[0].context?.property_chain).toEqual(propertyChain);
      expect(references[0].context?.receiver_location).toBeUndefined();
    });
  });

  describe("complex scenarios", () => {
    it("should handle method call with property chain", () => {
      const propertyChain: SymbolName[] = [
        "person",
        "address",
        "toString",
      ] as SymbolName[];

      const mockExtractors = create_mock_extractors({
        extract_property_chain: vi.fn((node) => propertyChain),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].context?.property_chain).toEqual([
        "person",
        "address",
        "toString",
      ]);
    });

    it("should handle type references", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "string" as SymbolName,
          type_id: "type:string:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].type_info?.type_name).toBe("string");
    });

    it("should handle assignments", () => {
      const mockExtractors = create_mock_extractors({
        extract_type_from_annotation: vi.fn((node, file_path) => ({
          type_name: "string" as SymbolName,
          type_id: "type:string:test.ts:1:0" as SymbolId,
          certainty: "declared" as const,
        })),
      });

      const builder = new ReferenceBuilder(
        context,
        mockExtractors,
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
      expect(references[0].type).toBe("assignment");
      expect(references[0].assignment_type?.type_name).toBe("string");
    });
  });
});
