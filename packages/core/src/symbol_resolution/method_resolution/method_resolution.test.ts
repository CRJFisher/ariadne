/**
 * Tests for method resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  Location,
  LocationKey,
  SymbolId,
  TypeId,
  FilePath,
  SymbolName,
  SymbolDefinition,
} from "@ariadnejs/types";
import { location_key, class_symbol, method_symbol, variable_symbol, defined_type_id, TypeCategory } from "@ariadnejs/types";
import { resolve_method_calls } from "./method_resolver";
import { get_type_methods, resolve_method_on_type, find_symbol_definition } from "./type_lookup";
import { determine_if_static_call, get_method_kind } from "./static_resolution";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { MemberAccessReference } from "../../semantic_index/references/member_access_references/member_access_references";
import type { LocalConstructorCall } from "../../semantic_index/references/type_flow_references/type_flow_references";
import type { ImportResolutionMap, FunctionResolutionMap, TypeResolutionMap } from "../types";

describe("method_resolution", () => {
  let indices: Map<FilePath, SemanticIndex>;
  let imports: ImportResolutionMap;
  let functions: FunctionResolutionMap;
  let types: TypeResolutionMap;

  beforeEach(() => {
    indices = new Map();
    imports = { imports: new Map() };
    functions = {
      function_calls: new Map(),
      calls_to_function: new Map()
    };
    types = {
      symbol_types: new Map(),
      reference_types: new Map(),
      type_members: new Map(),
      constructors: new Map()
    };
  });

  describe("basic method resolution", () => {
    it("should resolve instance method calls", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const method_sym = method_symbol("getValue", "MyClass", test_location);
      const instance_sym = variable_symbol("instance", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      // Setup type resolution
      types.symbol_types.set(class_sym, class_type);
      types.symbol_types.set(instance_sym, class_type);
      types.type_members.set(class_type, new Map([
        ["getValue" as SymbolName, method_sym]
      ]));

      // Setup member access
      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        member_name: "getValue" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "method",
        object: {
          location: { file_path, line: 10, column: 1, end_line: 10, end_column: 8 }
        },
        is_optional_chain: false
      };

      // Setup semantic index
      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([
          [class_sym, {
            kind: "class",
            name: "MyClass" as SymbolName,
            location: { file_path, line: 1, column: 1, end_line: 5, end_column: 1 }
          } as SymbolDefinition],
          [method_sym, {
            kind: "method",
            name: "getValue" as SymbolName,
            location: { file_path, line: 2, column: 3, end_line: 2, end_column: 20 }
          } as SymbolDefinition],
          [instance_sym, {
            kind: "variable",
            name: "instance" as SymbolName,
            location: { file_path, line: 10, column: 1, end_line: 10, end_column: 8 }
          } as SymbolDefinition]
        ]),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: []
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([
            ["MyClass" as SymbolName, class_sym],
            ["getValue" as SymbolName, method_sym],
            ["instance" as SymbolName, instance_sym]
          ])]
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);

      // Resolve method calls
      const result = resolve_method_calls(indices, imports, functions, types);

      // Verify resolution
      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBe(method_sym);
      expect(result.resolution_details.get(location_key_val)).toMatchObject({
        resolved_method: method_sym,
        receiver_type: class_type,
        method_kind: "instance",
        resolution_path: "direct"
      });
    });

    it("should resolve static method calls", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const static_meth = method_symbol("createDefault", "MyClass", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      // Setup type resolution
      types.symbol_types.set(class_sym, class_type);
      types.type_members.set(class_type, new Map([
        ["createDefault" as SymbolName, static_meth]
      ]));

      // Setup member access
      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 20 },
        member_name: "createDefault" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "method",
        object: {
          location: { file_path, line: 10, column: 1, end_line: 10, end_column: 7 }
        },
        is_optional_chain: false
      } as MemberAccessReference;

      // Setup semantic index
      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([
          [class_sym, {
            kind: "class",
            name: "MyClass" as SymbolName,
            location: { file_path, line: 1, column: 1, end_line: 5, end_column: 1 }
          } as SymbolDefinition],
          [static_meth, {
            kind: "method",
            name: "createDefault" as SymbolName,
            modifiers: ["static"],
            location: { file_path, line: 2, column: 3, end_line: 2, end_column: 25 }
          } as SymbolDefinition]
        ]),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: []
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([
            ["MyClass" as SymbolName, class_sym],
            ["createDefault" as SymbolName, static_meth]
          ])]
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);

      // Resolve method calls
      const result = resolve_method_calls(indices, imports, functions, types);

      // Verify resolution
      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBe(static_meth);
      expect(result.resolution_details.get(location_key_val)).toMatchObject({
        resolved_method: static_meth,
        receiver_type: class_type,
        method_kind: "static",
        resolution_path: "direct"
      });
    });

    it("should resolve constructor calls", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const constructor_sym = method_symbol("constructor", "MyClass", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      // Setup type resolution
      types.symbol_types.set(class_sym, class_type);
      types.type_members.set(class_type, new Map([
        ["constructor" as SymbolName, constructor_sym]
      ]));
      types.constructors.set(class_type, constructor_sym);

      // Setup constructor call
      const constructor_call: LocalConstructorCall = {
        class_name: "MyClass" as SymbolName,
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        assigned_to: "instance" as SymbolName,
        argument_count: 0,
        scope_id: "scope_1" as any
      };

      // Setup semantic index
      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([
          [class_sym, {
            kind: "class",
            name: "MyClass" as SymbolName,
            location: { file_path, line: 1, column: 1, end_line: 5, end_column: 1 }
          } as SymbolDefinition],
          [constructor_sym, {
            kind: "constructor",
            name: "constructor" as SymbolName,
            location: { file_path, line: 2, column: 3, end_line: 2, end_column: 15 }
          } as SymbolDefinition]
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: []
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([
            ["MyClass" as SymbolName, class_sym],
            ["constructor" as SymbolName, constructor_sym]
          ])]
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [constructor_call],
          assignments: [],
          returns: [],
          call_assignments: []
        }
      } as SemanticIndex;

      indices.set(file_path, index);

      // Resolve method calls
      const result = resolve_method_calls(indices, imports, functions, types);

      // Verify resolution
      const location_key_val = location_key(constructor_call.location);
      expect(result.constructor_calls.get(location_key_val)).toBe(constructor_sym);
      expect(result.resolution_details.get(location_key_val)).toMatchObject({
        resolved_method: constructor_sym,
        receiver_type: class_type,
        method_kind: "constructor",
        resolution_path: "direct"
      });
    });
  });

  describe("error conditions", () => {
    it("should return null when method not found on type", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      types.symbol_types.set(class_sym, class_type);
      types.type_members.set(class_type, new Map()); // Empty members

      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        member_name: "nonExistent" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "method",
        object: { location: { file_path, line: 10, column: 1, end_line: 10, end_column: 8 } },
        is_optional_chain: false
      };

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([[class_sym, {
          kind: "class",
          name: "MyClass" as SymbolName,
          location: test_location
        } as SymbolDefinition]]),
        references: { calls: [], member_accesses: [member_access], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([[file_path, new Map([["MyClass" as SymbolName, class_sym]])]]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBeUndefined();
    });

    it("should handle receiver without type information", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };

      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        member_name: "someMethod" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "method",
        object: { location: { file_path, line: 10, column: 1, end_line: 10, end_column: 8 } },
        is_optional_chain: false
      };

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], member_accesses: [member_access], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBeUndefined();
    });

    it("should handle constructor for unknown class", () => {
      const file_path = "test.ts" as FilePath;

      const constructor_call: LocalConstructorCall = {
        class_name: "UnknownClass" as SymbolName,
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        assigned_to: "instance" as SymbolName,
        argument_count: 0,
        scope_id: "scope_1" as any
      };

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([[file_path, new Map()]]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [constructor_call], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(constructor_call.location);
      expect(result.constructor_calls.get(location_key_val)).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should skip property access (not method call)", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const property_sym = method_symbol("value", "MyClass", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      types.symbol_types.set(class_sym, class_type);
      types.type_members.set(class_type, new Map([["value" as SymbolName, property_sym]]));

      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        member_name: "value" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "property", // Not a method
        object: { location: { file_path, line: 10, column: 1, end_line: 10, end_column: 8 } },
        is_optional_chain: false
      };

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], member_accesses: [member_access], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([[file_path, new Map([["MyClass" as SymbolName, class_sym]])]]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBeUndefined();
    });

    it("should handle optional chaining", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const method_sym = method_symbol("getValue", "MyClass", test_location);
      const instance_sym = variable_symbol("instance", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      types.symbol_types.set(instance_sym, class_type);
      types.type_members.set(class_type, new Map([["getValue" as SymbolName, method_sym]]));

      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        member_name: "getValue" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "method",
        object: { location: { file_path, line: 10, column: 1, end_line: 10, end_column: 8 } },
        is_optional_chain: true // Optional chaining
      };

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([[method_sym, {
          kind: "method",
          name: "getValue" as SymbolName,
          location: test_location
        } as SymbolDefinition]]),
        references: { calls: [], member_accesses: [member_access], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      // Should still resolve even with optional chaining
      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.has(location_key_val)).toBe(false); // No type for receiver
    });

    it("should handle empty indices map", () => {
      const result = resolve_method_calls(new Map(), imports, functions, types);
      expect(result.method_calls.size).toBe(0);
      expect(result.constructor_calls.size).toBe(0);
      expect(result.calls_to_method.size).toBe(0);
    });
  });

  describe("type lookup", () => {
    it("should differentiate static and instance methods", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_sym = class_symbol("MyClass", test_location);
      const instance_meth = method_symbol("getValue", "MyClass", test_location);
      const static_meth = method_symbol("createDefault", "MyClass", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      // Setup type resolution with both static and instance methods
      types.symbol_types.set(class_sym, class_type);
      types.type_members.set(class_type, new Map([
        ["getValue" as SymbolName, instance_meth],
        ["createDefault" as SymbolName, static_meth]
      ]));

      // Setup semantic index with both method types
      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([
          [class_sym, {
            kind: "class",
            name: "MyClass" as SymbolName,
            location: { file_path, line: 1, column: 1, end_line: 10, end_column: 1 }
          } as SymbolDefinition],
          [instance_meth, {
            kind: "method",
            name: "getValue" as SymbolName,
            location: { file_path, line: 3, column: 3, end_line: 3, end_column: 20 }
          } as SymbolDefinition],
          [static_meth, {
            kind: "method",
            name: "createDefault" as SymbolName,
            modifiers: ["static"],
            location: { file_path, line: 5, column: 3, end_line: 5, end_column: 25 }
          } as SymbolDefinition]
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: []
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([
            ["MyClass" as SymbolName, class_sym]
          ])]
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      indices.set(file_path, index);

      // Test that type lookup correctly categorizes methods
      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices
      };

      const type_methods = get_type_methods(class_type, context);
      expect(type_methods).not.toBeNull();
      expect(type_methods!.methods.get("getValue" as SymbolName)).toBe(instance_meth);
      expect(type_methods!.static_methods.get("createDefault" as SymbolName)).toBe(static_meth);
      expect(type_methods!.methods.has("createDefault" as SymbolName)).toBe(false);
      expect(type_methods!.static_methods.has("getValue" as SymbolName)).toBe(false);
    });
  });

  describe("unit tests for resolve_method_on_type", () => {
    it("should resolve method on type directly", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const method_sym = method_symbol("getValue", "MyClass", test_location);
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      types.type_members.set(class_type, new Map([["getValue" as SymbolName, method_sym]]));

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([[method_sym, {
          kind: "method",
          name: "getValue" as SymbolName,
          location: test_location
        } as SymbolDefinition]]),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]])
      };

      const result = resolve_method_on_type("getValue" as SymbolName, class_type, false, context);
      expect(result).not.toBeNull();
      expect(result!.resolved_method).toBe(method_sym);
      expect(result!.method_kind).toBe("instance");
      expect(result!.resolution_path).toBe("direct");
    });

    it("should return null for non-existent method", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const class_type = defined_type_id(TypeCategory.CLASS, "MyClass" as SymbolName, test_location);

      types.type_members.set(class_type, new Map());

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]])
      };

      const result = resolve_method_on_type("nonExistent" as SymbolName, class_type, false, context);
      expect(result).toBeNull();
    });
  });

  describe("unit tests for static resolution functions", () => {
    it("should identify static call when is_static_access is true", () => {
      const file_path = "test.ts" as FilePath;
      const member_access: MemberAccessReference = {
        location: { file_path, line: 10, column: 1, end_line: 10, end_column: 15 },
        member_name: "method" as SymbolName,
        scope_id: "scope_1" as any,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static_access: true
      } as MemberAccessReference;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map()
        } as any,
        indices: new Map()
      };

      expect(determine_if_static_call(member_access, context)).toBe(true);
    });

    it("should get method kind correctly", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const constructor_sym = method_symbol("constructor", "MyClass", test_location);
      const static_method_sym = method_symbol("create", "MyClass", test_location);
      const instance_method_sym = method_symbol("getValue", "MyClass", test_location);

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([
          [constructor_sym, {
            kind: "constructor",
            name: "constructor" as SymbolName,
            location: test_location
          } as SymbolDefinition],
          [static_method_sym, {
            kind: "method",
            name: "create" as SymbolName,
            modifiers: ["static"],
            location: test_location
          } as SymbolDefinition],
          [instance_method_sym, {
            kind: "method",
            name: "getValue" as SymbolName,
            location: test_location
          } as SymbolDefinition]
        ]),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]])
      };

      expect(get_method_kind(constructor_sym, context)).toBe("constructor");
      expect(get_method_kind(static_method_sym, context)).toBe("static");
      expect(get_method_kind(instance_method_sym, context)).toBe("instance");
    });
  });

  describe("unit tests for find_symbol_definition", () => {
    it("should find symbol in current file", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const method_sym = method_symbol("getValue", "MyClass", test_location);

      const symbol_def: SymbolDefinition = {
        kind: "method",
        name: "getValue" as SymbolName,
        location: test_location
      } as SymbolDefinition;

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map([[method_sym, symbol_def]]),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]])
      };

      const result = find_symbol_definition(method_sym, context);
      expect(result).toBe(symbol_def);
    });

    it("should find symbol in other files", () => {
      const file_path1 = "test1.ts" as FilePath;
      const file_path2 = "test2.ts" as FilePath;
      const test_location = { file_path: file_path2, line: 1, column: 1, end_line: 1, end_column: 10 };
      const method_sym = method_symbol("getValue", "MyClass", test_location);

      const symbol_def: SymbolDefinition = {
        kind: "method",
        name: "getValue" as SymbolName,
        location: test_location
      } as SymbolDefinition;

      const index1: SemanticIndex = {
        file_path: file_path1,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const index2: SemanticIndex = {
        file_path: file_path2,
        language: "typescript",
        root_scope_id: "scope_2" as any,
        scopes: new Map(),
        symbols: new Map([[method_sym, symbol_def]]),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path1,
        current_index: index1,
        indices: new Map([[file_path1, index1], [file_path2, index2]])
      };

      const result = find_symbol_definition(method_sym, context);
      expect(result).toBe(symbol_def);
    });

    it("should return null for non-existent symbol", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = { file_path, line: 1, column: 1, end_line: 1, end_column: 10 };
      const method_sym = method_symbol("getValue", "MyClass", test_location);

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as any,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], member_accesses: [], returns: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] }
      } as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]])
      };

      const result = find_symbol_definition(method_sym, context);
      expect(result).toBeNull();
    });
  });
});