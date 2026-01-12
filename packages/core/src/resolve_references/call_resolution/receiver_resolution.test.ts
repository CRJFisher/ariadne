/**
 * Unit Tests for Receiver Resolution Module
 *
 * Tests the core functions for resolving receiver expressions:
 * - extract_receiver: Normalizes self-reference and method calls
 * - resolve_receiver_type: Two-phase resolution (base + chain)
 * - find_containing_class_scope: Scope tree walking utility
 *
 * These unit tests focus on individual function behavior.
 * For full integration tests, see method.test.ts and self_reference.integration.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  extract_receiver,
  resolve_receiver_type,
  find_containing_class_scope,
  type ReceiverExpression,
  type ResolutionContext,
} from "./receiver_resolution";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ResolutionRegistry } from "../resolve_references";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  SelfReferenceCall,
  MethodCallReference,
  MethodDefinition,
  ClassDefinition,
  PropertyDefinition,
} from "@ariadnejs/types";
import {
  class_symbol,
  method_symbol,
  property_symbol,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const METHOD_SCOPE_ID = "scope:test.ts:MyClass.process:2:2" as ScopeId;
const NESTED_SCOPE_ID = "scope:test.ts:MyClass.process.inner:3:4" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("extract_receiver", () => {
  describe("SelfReferenceCall extraction", () => {
    it("should extract this.method() with no property chain", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "process" as SymbolName,
        keyword: "this",
        property_chain: ["this", "process"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should extract this.property.method() with property chain", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "query" as SymbolName,
        keyword: "this",
        property_chain: ["this", "db", "query"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should extract self.method() for Python", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "process" as SymbolName,
        keyword: "self",
        property_chain: ["self", "process"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "self" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should extract super.method()", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "process" as SymbolName,
        keyword: "super",
        property_chain: ["super", "process"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "super" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should extract cls.method() for Python classmethods", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "create" as SymbolName,
        keyword: "cls",
        property_chain: ["cls", "create"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "cls" },
        chain: [],
        method_name: "create" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should handle deep property chains", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "execute" as SymbolName,
        keyword: "this",
        property_chain: ["this", "config", "database", "connection", "execute"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: [
          "config" as SymbolName,
          "database" as SymbolName,
          "connection" as SymbolName,
        ],
        method_name: "execute" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });
  });

  describe("MethodCallReference extraction", () => {
    it("should extract obj.method() with identifier base", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "process" as SymbolName,
        property_chain: ["obj", "process"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "obj" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should extract obj.field.method() with property chain", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["service", "db", "query"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "service" as SymbolName },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should detect 'this' in method_call and treat as keyword", () => {
      // This is the critical fix for this.property.method() indexed as method_call
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["this", "db", "query"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should detect 'self' in method_call and treat as keyword", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["self", "db", "query"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "self" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should detect 'super' in method_call and treat as keyword", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["super", "db", "query"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "super" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should detect 'cls' in method_call and treat as keyword", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "create" as SymbolName,
        property_chain: ["cls", "factory", "create"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "cls" },
        chain: ["factory" as SymbolName],
        method_name: "create" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("should NOT treat regular identifiers as keywords", () => {
      // Variable named 'thisService' should be treated as identifier
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "process" as SymbolName,
        property_chain: ["thisService", "process"],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "thisService" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });
  });
});

describe("find_containing_class_scope", () => {
  let scopes: ScopeRegistry;

  beforeEach(() => {
    scopes = new ScopeRegistry();
  });

  it("should find class scope when directly inside class", () => {
    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [CLASS_SCOPE_ID],
    });
    scope_map.set(CLASS_SCOPE_ID, {
      id: CLASS_SCOPE_ID,
      type: "class",
      location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 50, end_column: 0 },
      parent_id: FILE_SCOPE_ID,
      child_ids: [METHOD_SCOPE_ID],
    });
    scope_map.set(METHOD_SCOPE_ID, {
      id: METHOD_SCOPE_ID,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 2, start_column: 2, end_line: 10, end_column: 2 },
      parent_id: CLASS_SCOPE_ID,
      child_ids: [],
    });
    scopes.update_file(TEST_FILE, scope_map);

    const result = find_containing_class_scope(METHOD_SCOPE_ID, scopes);

    expect(result).toBe(CLASS_SCOPE_ID);
  });

  it("should find class scope from nested block scope", () => {
    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [CLASS_SCOPE_ID],
    });
    scope_map.set(CLASS_SCOPE_ID, {
      id: CLASS_SCOPE_ID,
      type: "class",
      location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 50, end_column: 0 },
      parent_id: FILE_SCOPE_ID,
      child_ids: [METHOD_SCOPE_ID],
    });
    scope_map.set(METHOD_SCOPE_ID, {
      id: METHOD_SCOPE_ID,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 2, start_column: 2, end_line: 20, end_column: 2 },
      parent_id: CLASS_SCOPE_ID,
      child_ids: [NESTED_SCOPE_ID],
    });
    scope_map.set(NESTED_SCOPE_ID, {
      id: NESTED_SCOPE_ID,
      type: "block",
      location: { file_path: TEST_FILE, start_line: 3, start_column: 4, end_line: 10, end_column: 4 },
      parent_id: METHOD_SCOPE_ID,
      child_ids: [],
    });
    scopes.update_file(TEST_FILE, scope_map);

    const result = find_containing_class_scope(NESTED_SCOPE_ID, scopes);

    expect(result).toBe(CLASS_SCOPE_ID);
  });

  it("should return null when not in a class", () => {
    const scope_map = new Map();
    const func_scope_id = "scope:test.ts:standalone:1:0" as ScopeId;
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [func_scope_id],
    });
    scope_map.set(func_scope_id, {
      id: func_scope_id,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
      parent_id: FILE_SCOPE_ID,
      child_ids: [],
    });
    scopes.update_file(TEST_FILE, scope_map);

    const result = find_containing_class_scope(func_scope_id, scopes);

    expect(result).toBeNull();
  });

  it("should return null for file scope", () => {
    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [],
    });
    scopes.update_file(TEST_FILE, scope_map);

    const result = find_containing_class_scope(FILE_SCOPE_ID, scopes);

    expect(result).toBeNull();
  });

  it("should return null for unknown scope", () => {
    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [],
    });
    scopes.update_file(TEST_FILE, scope_map);

    const unknown_scope = "scope:test.ts:unknown:99:99" as ScopeId;
    const result = find_containing_class_scope(unknown_scope, scopes);

    expect(result).toBeNull();
  });
});

describe("resolve_receiver_type", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;
  let context: ResolutionContext;

  // Helper symbols
  let my_class_id: SymbolId;
  let method_id: SymbolId;
  let property_id: SymbolId;
  let database_class_id: SymbolId;

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    resolutions = new ResolutionRegistry();
    context = { scopes, definitions, types, resolutions };

    // Create test symbols
    my_class_id = class_symbol("MyClass", TEST_FILE, MOCK_LOCATION);
    method_id = method_symbol("process", MOCK_LOCATION);
    property_id = property_symbol("db", "MyClass", TEST_FILE, MOCK_LOCATION);
    database_class_id = class_symbol("Database", TEST_FILE, {
      ...MOCK_LOCATION,
      start_line: 20,
    });
  });

  function setup_class_scopes(): void {
    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [CLASS_SCOPE_ID],
    });
    scope_map.set(CLASS_SCOPE_ID, {
      id: CLASS_SCOPE_ID,
      type: "class",
      location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 50, end_column: 0 },
      parent_id: FILE_SCOPE_ID,
      child_ids: [METHOD_SCOPE_ID],
    });
    scope_map.set(METHOD_SCOPE_ID, {
      id: METHOD_SCOPE_ID,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 2, start_column: 2, end_line: 10, end_column: 2 },
      parent_id: CLASS_SCOPE_ID,
      child_ids: [],
    });
    scopes.update_file(TEST_FILE, scope_map);
  }

  function setup_class_definitions(): void {
    const method_def: MethodDefinition = {
      kind: "method",
      symbol_id: method_id,
      name: "process" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 3 },
      parameters: [],
      body_scope_id: METHOD_SCOPE_ID,
      decorators: [],
    };

    const property_def: PropertyDefinition = {
      kind: "property",
      symbol_id: property_id,
      name: "db" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      type: "Database" as SymbolName,
    };

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: my_class_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 1 },
      is_exported: false,
      extends: [],
      methods: [method_def],
      properties: [property_def],
      decorators: [],
      constructor: [],
    };

    const database_def: ClassDefinition = {
      kind: "class",
      symbol_id: database_class_id,
      name: "Database" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 20 },
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructor: [],
    };

    definitions.update_file(TEST_FILE, [class_def, method_def, property_def, database_def]);
  }

  describe("keyword base resolution", () => {
    it("should resolve this.method() to containing class", () => {
      setup_class_scopes();
      setup_class_definitions();

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBe(my_class_id);
    });

    it("should return null for this outside of class", () => {
      // Setup scope without class
      const func_scope_id = "scope:test.ts:standalone:1:0" as ScopeId;
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [func_scope_id],
      });
      scope_map.set(func_scope_id, {
        id: func_scope_id,
        type: "function",
        location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
        parent_id: FILE_SCOPE_ID,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: func_scope_id,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBeNull();
    });
  });

  describe("property chain walking", () => {
    it("should resolve this.property.method() via type annotation", () => {
      setup_class_scopes();
      setup_class_definitions();

      // Set up resolution for "Database" type name
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Database" as SymbolName, database_class_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(CLASS_SCOPE_ID, scope_resolutions);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBe(database_class_id);
    });

    it("should resolve this.property.method() via TypeRegistry", () => {
      setup_class_scopes();
      setup_class_definitions();

      // Set up type via TypeRegistry instead of annotation resolution
      types["symbol_types"] = new Map();
      types["symbol_types"].set(property_id, database_class_id);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBe(database_class_id);
    });

    it("should return null if property not found", () => {
      setup_class_scopes();
      setup_class_definitions();

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["nonexistent" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBeNull();
    });

    it("should return null if property type cannot be resolved", () => {
      setup_class_scopes();

      // Create property without type annotation and no TypeRegistry entry
      const property_no_type: PropertyDefinition = {
        kind: "property",
        symbol_id: property_id,
        name: "db" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        // No type annotation
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: my_class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
        extends: [],
        methods: [
          {
            kind: "method",
            symbol_id: method_id,
            name: "process" as SymbolName,
            defining_scope_id: CLASS_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 3 },
            parameters: [],
            body_scope_id: METHOD_SCOPE_ID,
            decorators: [],
          },
        ],
        properties: [property_no_type],
        decorators: [],
        constructor: [],
      };

      definitions.update_file(TEST_FILE, [class_def, property_no_type]);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBeNull();
    });
  });

  describe("identifier base resolution", () => {
    it("should resolve obj.method() via scope resolution and type lookup", () => {
      const var_id = "variable:test.ts:5:15:5:18:obj" as SymbolId;

      // Setup scope with variable
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      // Setup definitions
      definitions.update_file(TEST_FILE, [
        {
          kind: "variable",
          symbol_id: var_id,
          name: "obj" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          is_exported: false,
        },
        {
          kind: "class",
          symbol_id: my_class_id,
          name: "MyClass" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: { ...MOCK_LOCATION, start_line: 1 },
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        },
      ]);

      // Setup resolution for 'obj' identifier
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, var_id);
      resolutions["resolutions_by_scope"] = new Map();
      resolutions["resolutions_by_scope"].set(FILE_SCOPE_ID, scope_resolutions);

      // Setup type for variable
      types["symbol_types"] = new Map();
      types["symbol_types"].set(var_id, my_class_id);

      const receiver: ReceiverExpression = {
        base: { type: "identifier", value: "obj" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBe(my_class_id);
    });

    it("should return null if identifier cannot be resolved", () => {
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [],
      });
      scopes.update_file(TEST_FILE, scope_map);

      const receiver: ReceiverExpression = {
        base: { type: "identifier", value: "unknown" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context);

      expect(result).toBeNull();
    });
  });
});
