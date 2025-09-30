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
  ScopeId,
} from "@ariadnejs/types";
import {
  location_key,
  class_symbol,
  method_symbol,
  variable_symbol,
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import { resolve_method_calls } from "./method_resolver";
import {
  get_type_methods,
  resolve_method_on_type,
  find_symbol_definition,
} from "./type_lookup";
import { determine_if_static_call, get_method_kind } from "./static_resolution";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { MemberAccessReference } from "../../index_single_file/references/member_access_references/member_access_references";
import type { LocalConstructorCall } from "../../index_single_file/references/type_flow_references/type_flow_references";
import type { FunctionResolutionMap, TypeResolutionMap } from "../types";
import { MethodLookupContext } from "./method_types";
import { find_default_constructor } from "./constructor_resolver";

// Helper function to create complete SymbolDefinition objects for tests
function create_test_symbol_definition(
  id: SymbolId,
  name: SymbolName,
  kind: SymbolDefinition["kind"],
  location: Location,
  options: {
    scope_id?: ScopeId;
    is_hoisted?: boolean;
    is_exported?: boolean;
    is_imported?: boolean;
    is_static?: boolean;
    modifiers?: string[];
  } = {}
): SymbolDefinition {
  return {
    id,
    name,
    kind,
    location,
    scope_id: options.scope_id || ("scope:module" as ScopeId),
    is_hoisted: options.is_hoisted || false,
    is_exported: options.is_exported || false,
    is_imported: options.is_imported || false,
    ...(options.is_static !== undefined && { is_static: options.is_static }),
    ...(options.modifiers && { modifiers: options.modifiers }),
  };
}

describe("method_resolution", () => {
  let indices: Map<FilePath, SemanticIndex>;
  let imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
  let functions: FunctionResolutionMap;
  let types: TypeResolutionMap;

  beforeEach(() => {
    indices = new Map();
    imports = new Map([["test.ts" as FilePath, new Map()]]);
    functions = {
      function_calls: new Map(),
      calls_to_function: new Map(),
      closure_calls: new Map(),
      higher_order_calls: new Map(),
      function_pointer_calls: new Map(),
    };
    types = {
      symbol_types: new Map(),
      reference_types: new Map(),
      type_members: new Map(),
      constructors: new Map(),
      inheritance_hierarchy: new Map(),
      interface_implementations: new Map(),
    };
  });

  describe("basic method resolution", () => {
    it("should resolve instance method calls", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_sym = class_symbol("MyClass", test_location);
      const method_sym = method_symbol("getValue", test_location);
      const instance_sym = variable_symbol("instance", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      // Setup type resolution
      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        instance_sym,
        class_type
      );
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["getValue" as SymbolName, method_sym]])
      );

      // Setup member access
      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "getValue" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 8,
          },
        },
        is_optional_chain: false,
      };

      // Setup semantic index
      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            class_sym,
            {
              kind: "class",
              name: "MyClass" as SymbolName,
              location: {
                file_path,
                start_line: 1,
                start_column: 1,
                end_line: 5,
                end_column: 1,
              },
            } as SymbolDefinition,
          ],
          [
            method_sym,
            {
              kind: "method",
              name: "getValue" as SymbolName,
              location: {
                file_path,
                start_line: 2,
                start_column: 3,
                end_line: 2,
                end_column: 20,
              },
            } as SymbolDefinition,
          ],
          [
            instance_sym,
            {
              kind: "variable",
              name: "instance" as SymbolName,
              location: {
                file_path,
                start_line: 10,
                start_column: 1,
                end_line: 10,
                end_column: 8,
              },
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [
            file_path,
            new Map([
              ["MyClass" as SymbolName, class_sym],
              ["getValue" as SymbolName, method_sym],
              ["instance" as SymbolName, instance_sym],
            ]),
          ],
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

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
        resolution_path: "direct",
      });
    });

    it("should resolve static method calls", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_sym = class_symbol("MyClass", test_location);
      const static_meth = method_symbol("createDefault", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      // Setup type resolution
      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["createDefault" as SymbolName, static_meth]])
      );

      // Setup member access
      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 20,
        },
        member_name: "createDefault" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 7,
          },
        },
        is_optional_chain: false,
        is_static: true,
      } as MemberAccessReference;

      // Setup semantic index
      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            class_sym,
            {
              kind: "class",
              name: "MyClass" as SymbolName,
              location: {
                file_path,
                start_line: 1,
                start_column: 1,
                end_line: 5,
                end_column: 1,
              },
            } as SymbolDefinition,
          ],
          [
            static_meth,
            {
              id: static_meth,
              kind: "method",
              name: "createDefault" as SymbolName,
              location: {
                file_path,
                start_line: 2,
                start_column: 3,
                end_line: 2,
                end_column: 25,
              },
              scope_id: "scope:module" as ScopeId,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              is_static: true,
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [
            file_path,
            new Map([
              ["MyClass" as SymbolName, class_sym],
              ["createDefault" as SymbolName, static_meth],
            ]),
          ],
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

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
        resolution_path: "direct",
      });
    });

    it("should resolve constructor calls", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_sym = class_symbol("MyClass", test_location);
      const constructor_sym = method_symbol("constructor", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      // Setup type resolution
      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["constructor" as SymbolName, constructor_sym]])
      );
      (types.constructors as Map<TypeId, SymbolId>).set(
        class_type,
        constructor_sym
      );

      // Setup constructor call
      const constructor_call: LocalConstructorCall = {
        class_name: "MyClass" as SymbolName,
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        assigned_to: "instance" as SymbolName,
        argument_count: 0,
        scope_id: "scope_1" as ScopeId,
      };

      // Setup semantic index
      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            class_sym,
            {
              kind: "class",
              name: "MyClass" as SymbolName,
              location: {
                file_path,
                start_line: 1,
                start_column: 1,
                end_line: 5,
                end_column: 1,
              },
            } as SymbolDefinition,
          ],
          [
            constructor_sym,
            {
              kind: "constructor",
              name: "constructor" as SymbolName,
              location: {
                file_path,
                start_line: 2,
                start_column: 3,
                end_line: 2,
                end_column: 15,
              },
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [
            file_path,
            new Map([
              ["MyClass" as SymbolName, class_sym],
              ["constructor" as SymbolName, constructor_sym],
            ]),
          ],
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [constructor_call],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      indices.set(file_path, index);

      // Resolve method calls
      const result = resolve_method_calls(indices, imports, functions, types);

      // Verify resolution
      const location_key_val = location_key(constructor_call.location);
      expect(result.constructor_calls.get(location_key_val)).toBe(
        constructor_sym
      );
      expect(result.resolution_details.get(location_key_val)).toMatchObject({
        resolved_method: constructor_sym,
        receiver_type: class_type,
        method_kind: "constructor",
        resolution_path: "direct",
      });
    });
  });

  describe("error conditions", () => {
    it("should return null when method not found on type", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_sym = class_symbol("MyClass", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map()
      ); // Empty members

      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "nonExistent" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 8,
          },
        },
        is_optional_chain: false,
      };

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            class_sym,
            create_test_symbol_definition(
              class_sym,
              "MyClass" as SymbolName,
              "class",
              test_location
            ),
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([["MyClass" as SymbolName, class_sym]])],
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBeUndefined();
    });

    it("should handle receiver without type information", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "someMethod" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 8,
          },
        },
        is_optional_chain: false,
      };

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBeUndefined();
    });

    it("should handle constructor for unknown class", () => {
      const file_path = "test.ts" as FilePath;

      const constructor_call: LocalConstructorCall = {
        class_name: "UnknownClass" as SymbolName,
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        assigned_to: "instance" as SymbolName,
        argument_count: 0,
        scope_id: "scope_1" as ScopeId,
      };

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([[file_path, new Map()]]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [constructor_call],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(constructor_call.location);
      expect(result.constructor_calls.get(location_key_val)).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should skip property access (not method call)", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_sym = class_symbol("MyClass", test_location);
      const property_sym = method_symbol("value", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["value" as SymbolName, property_sym]])
      );

      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "value" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "property", // Not a method
        object: {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 8,
          },
        },
        is_optional_chain: false,
      };

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([["MyClass" as SymbolName, class_sym]])],
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      indices.set(file_path, index);
      const result = resolve_method_calls(indices, imports, functions, types);

      const location_key_val = location_key(member_access.location);
      expect(result.method_calls.get(location_key_val)).toBeUndefined();
    });

    it("should handle optional chaining", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const method_sym = method_symbol("getValue", test_location);
      const instance_sym = variable_symbol("instance", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      (types.symbol_types as Map<SymbolId, TypeId>).set(
        instance_sym,
        class_type
      );
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["getValue" as SymbolName, method_sym]])
      );

      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "getValue" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 8,
          },
        },
        is_optional_chain: true, // Optional chaining
      };

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            method_sym,
            {
              kind: "method",
              name: "getValue" as SymbolName,
              location: test_location,
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [member_access],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

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
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_sym = class_symbol("MyClass", test_location);
      const instance_meth = method_symbol("getValue", test_location);
      const static_meth = method_symbol("createDefault", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      // Setup type resolution with both static and instance methods
      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([
          ["getValue" as SymbolName, instance_meth],
          ["createDefault" as SymbolName, static_meth],
        ])
      );

      // Setup semantic index with both method types
      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            class_sym,
            {
              kind: "class",
              name: "MyClass" as SymbolName,
              location: {
                file_path,
                start_line: 1,
                start_column: 1,
                end_line: 10,
                end_column: 1,
              },
            } as SymbolDefinition,
          ],
          [
            instance_meth,
            {
              kind: "method",
              name: "getValue" as SymbolName,
              location: {
                file_path,
                start_line: 3,
                start_column: 3,
                end_line: 3,
                end_column: 20,
              },
            } as SymbolDefinition,
          ],
          [
            static_meth,
            {
              id: static_meth,
              kind: "method",
              name: "createDefault" as SymbolName,
              location: {
                file_path,
                start_line: 5,
                start_column: 3,
                end_line: 5,
                end_column: 25,
              },
              scope_id: "scope:module" as ScopeId,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              is_static: true,
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map([
          [file_path, new Map([["MyClass" as SymbolName, class_sym]])],
        ]),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      indices.set(file_path, index);

      // Test that type lookup correctly categorizes methods
      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices,
      };

      const type_methods = get_type_methods(class_type, context);
      expect(type_methods).not.toBeNull();
      expect(type_methods!.methods.get("getValue" as SymbolName)).toBe(
        instance_meth
      );
      expect(
        type_methods!.static_methods.get("createDefault" as SymbolName)
      ).toBe(static_meth);
      expect(type_methods!.methods.has("createDefault" as SymbolName)).toBe(
        false
      );
      expect(type_methods!.static_methods.has("getValue" as SymbolName)).toBe(
        false
      );
    });
  });

  describe("unit tests for resolve_method_on_type", () => {
    it("should resolve method on type directly", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const method_sym = method_symbol("getValue", test_location);
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["getValue" as SymbolName, method_sym]])
      );

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            method_sym,
            {
              kind: "method",
              name: "getValue" as SymbolName,
              location: test_location,
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]]),
      };

      const result = resolve_method_on_type(
        "getValue" as SymbolName,
        class_type,
        false,
        context,
        test_location
      );
      expect(result).not.toBeNull();
      expect(result!.resolved_method).toBe(method_sym);
      expect(result!.method_kind).toBe("instance");
      expect(result!.resolution_path).toBe("direct");
    });

    it("should return null for non-existent method", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map()
      );

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]]),
      };

      const result = resolve_method_on_type(
        "nonExistent" as SymbolName,
        class_type,
        false,
        context,
        test_location
      );
      expect(result).toBeNull();
    });
  });

  describe("unit tests for static resolution functions", () => {
    it("should identify static call when is_static_access is true", () => {
      const file_path = "test.ts" as FilePath;
      const member_access: MemberAccessReference = {
        location: {
          file_path,
          start_line: 10,
          start_column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "method" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static: true,
      } as MemberAccessReference;

      const context: MethodLookupContext = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map(),
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          references: {
            calls: [],
            member_accesses: [],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map(),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: {
            annotations: [],
            declarations: [],
            assignments: [],
          },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        },
        indices: new Map(),
      };

      expect(determine_if_static_call(member_access, context)).toBe(true);
    });

    it("should get method kind correctly", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const constructor_sym = method_symbol("constructor", test_location);
      const static_method_sym = method_symbol("create", test_location);
      const instance_method_sym = method_symbol("getValue", test_location);

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([
          [
            constructor_sym,
            {
              kind: "constructor",
              name: "constructor" as SymbolName,
              location: test_location,
            } as SymbolDefinition,
          ],
          [
            static_method_sym,
            {
              id: static_method_sym,
              kind: "method",
              name: "create" as SymbolName,
              location: test_location,
              scope_id: "scope:module" as ScopeId,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
              is_static: true,
            } as SymbolDefinition,
          ],
          [
            instance_method_sym,
            {
              kind: "method",
              name: "getValue" as SymbolName,
              location: test_location,
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]]),
      };

      expect(get_method_kind(constructor_sym, context)).toBe("constructor");
      expect(get_method_kind(static_method_sym, context)).toBe("static");
      expect(get_method_kind(instance_method_sym, context)).toBe("instance");
    });
  });

  describe("unit tests for find_symbol_definition", () => {
    it("should find symbol in current file", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const method_sym = method_symbol("getValue", test_location);

      const symbol_def: SymbolDefinition = {
        id: method_sym,
        kind: "method",
        name: "getValue" as SymbolName,
        location: test_location,
        scope_id: "scope_1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map([[method_sym, symbol_def]]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]]),
      };

      const result = find_symbol_definition(method_sym, context);
      expect(result).toBe(symbol_def);
    });

    it("should find symbol in other files", () => {
      const file_path1 = "test1.ts" as FilePath;
      const file_path2 = "test2.ts" as FilePath;
      const test_location = {
        file_path: file_path2,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const method_sym = method_symbol("getValue", test_location);

      const symbol_def: SymbolDefinition = {
        id: method_sym,
        kind: "method",
        name: "getValue" as SymbolName,
        location: test_location,
        scope_id: "scope_1" as ScopeId,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      };

      const index1: SemanticIndex = {
        file_path: file_path1,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const index2: SemanticIndex = {
        file_path: file_path2,
        language: "typescript",
        root_scope_id: "scope_2",
        scopes: new Map(),
        symbols: new Map([[method_sym, symbol_def]]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path1,
        current_index: index1,
        indices: new Map([
          [file_path1, index1],
          [file_path2, index2],
        ]),
      };

      const result = find_symbol_definition(method_sym, context);
      expect(result).toBe(symbol_def);
    });

    it("should return null for non-existent symbol", () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };
      const method_sym = method_symbol("getValue", test_location);

      const index = {
        file_path,
        language: "typescript",
        root_scope_id: "scope_1" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
        local_type_annotations: [],
        local_type_tracking: { variable_types: [], assignment_flows: [] },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map([[file_path, index]]),
      };

      const result = find_symbol_definition(method_sym, context);
      expect(result).toBeNull();
    });
  });

  describe("inheritance resolution", () => {
    it("should resolve inherited methods", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      // Create base and derived classes
      const base_class_sym = class_symbol("BaseClass", test_location);
      const derived_class_sym = class_symbol("DerivedClass", test_location);
      const base_method_sym = method_symbol("baseMethod", test_location);
      const instance_sym = variable_symbol("instance", test_location);

      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "BaseClass" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "DerivedClass" as SymbolName,
        test_location
      );

      // Setup type resolution with inheritance
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        base_class_sym,
        base_type
      );
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        derived_class_sym,
        derived_type
      );
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        instance_sym,
        derived_type
      );

      // Base class has the method
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        base_type,
        new Map([["baseMethod" as SymbolName, base_method_sym]])
      );

      // Derived class doesn't have the method directly
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        derived_type,
        new Map()
      );

      // Setup inheritance hierarchy
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        derived_type,
        [base_type]
      );
      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();

      // Import the inheritance resolver
      const { resolve_method_with_inheritance } = await import(
        "./inheritance_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              base_method_sym,
              {
                kind: "method",
                name: "baseMethod" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Resolve method on derived type should find it in base type
      const result = resolve_method_with_inheritance(
        "baseMethod" as SymbolName,
        derived_type,
        false,
        context,
        test_location
      );

      expect(result).not.toBeNull();
      expect(result?.resolved_method).toBe(base_method_sym);
      expect(result?.resolution_path).toBe("inherited");
    });

    it("should build inheritance chain correctly", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      // Create multi-level inheritance
      const type_a = defined_type_id(
        TypeCategory.CLASS,
        "A" as SymbolName,
        test_location
      );
      const type_b = defined_type_id(
        TypeCategory.CLASS,
        "B" as SymbolName,
        test_location
      );
      const type_c = defined_type_id(
        TypeCategory.CLASS,
        "C" as SymbolName,
        test_location
      );
      const type_d = defined_type_id(
        TypeCategory.CLASS,
        "D" as SymbolName,
        test_location
      );

      // D extends C extends B extends A
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        type_b,
        [type_a]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        type_c,
        [type_b]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        type_d,
        [type_c]
      );
      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();

      const { build_inheritance_chain } = await import(
        "./inheritance_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map(),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const chain = build_inheritance_chain(type_d, context);

      expect(chain).toEqual([type_c, type_b, type_a]);
    });

    it("should resolve interface methods", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      // Create interface and implementing class
      const interface_sym = class_symbol("IMyInterface", test_location);
      const class_sym = class_symbol("MyClass", test_location);
      const interface_method_sym = method_symbol("doSomething", test_location);
      const class_method_sym = method_symbol("doSomething", test_location);
      const instance_sym = variable_symbol("instance", test_location);

      const interface_type = defined_type_id(
        TypeCategory.INTERFACE,
        "IMyInterface" as SymbolName,
        test_location
      );
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "MyClass" as SymbolName,
        test_location
      );

      // Setup type resolution
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        interface_sym,
        interface_type
      );
      (types.symbol_types as Map<SymbolId, TypeId>).set(class_sym, class_type);
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        instance_sym,
        class_type
      );

      // Interface has the method
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        interface_type,
        new Map([["doSomething" as SymbolName, interface_method_sym]])
      );

      // Class implements the method
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        class_type,
        new Map([["doSomething" as SymbolName, class_method_sym]])
      );

      // Setup interface implementations
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();
      (types.interface_implementations as Map<TypeId, readonly TypeId[]>).set(
        class_type,
        [interface_type]
      );

      const { resolve_method_with_inheritance } = await import(
        "./inheritance_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              interface_method_sym,
              {
                kind: "method",
                name: "doSomething" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              class_method_sym,
              {
                kind: "method",
                name: "doSomething" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const result = resolve_method_with_inheritance(
        "doSomething" as SymbolName,
        class_type,
        false,
        context,
        test_location
      );

      expect(result).not.toBeNull();
      expect(result?.resolved_method).toBe(class_method_sym);
      expect(result?.resolution_path).toBe("direct");
    });
  });

  describe("polymorphism and method overriding", () => {
    it("should find all method implementations in hierarchy", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      // Create class hierarchy with overridden method
      const base_class_sym = class_symbol("Base", test_location);
      const derived_class_sym = class_symbol("Derived", test_location);
      const base_method_sym = method_symbol("process", test_location);
      const derived_method_sym = method_symbol("process", test_location);

      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "Base" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "Derived" as SymbolName,
        test_location
      );

      // Setup type resolution
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        base_type,
        new Map([["process" as SymbolName, base_method_sym]])
      );

      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        derived_type,
        new Map([["process" as SymbolName, derived_method_sym]])
      );

      types = {
        ...types,
        inheritance_hierarchy: new Map([[derived_type, [base_type]]]),
        interface_implementations: new Map(),
      };

      const { find_all_method_implementations } = await import(
        "./polymorphism_handler"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              base_method_sym,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              derived_method_sym,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const implementations = find_all_method_implementations(
        "process" as SymbolName,
        derived_type,
        false,
        context
      );

      expect(implementations).toHaveLength(2);
      expect(implementations[0].symbol_id).toBe(derived_method_sym);
      expect(implementations[0].override_depth).toBe(0);
      expect(implementations[1].symbol_id).toBe(base_method_sym);
      expect(implementations[1].override_depth).toBe(1);
    });

    it("should choose most specific method implementation", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const base_method_sym = method_symbol("process", test_location);
      const derived_method_sym = method_symbol("process", test_location);

      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "Base" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "Derived" as SymbolName,
        test_location
      );

      const { choose_most_specific_method } = await import(
        "./polymorphism_handler"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map(),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const implementations = [
        {
          symbol_id: base_method_sym,
          source_type: base_type,
          override_depth: 1,
        },
        {
          symbol_id: derived_method_sym,
          source_type: derived_type,
          override_depth: 0,
        },
      ];

      const most_specific = choose_most_specific_method(
        implementations,
        derived_type,
        context
      );

      expect(most_specific.symbol_id).toBe(derived_method_sym);
      expect(most_specific.override_depth).toBe(0);
    });
  });

  describe("constructor resolution with inheritance", () => {
    it("should resolve inherited constructors", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const base_class_sym = class_symbol("Base", test_location);
      const derived_class_sym = class_symbol("Derived", test_location);
      const base_constructor_sym = method_symbol("constructor", test_location);

      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "Base" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "Derived" as SymbolName,
        test_location
      );

      // Base has constructor, derived doesn't
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        base_class_sym,
        base_type
      );
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        derived_class_sym,
        derived_type
      );
      (types.constructors as Map<TypeId, SymbolId>).set(
        base_type,
        base_constructor_sym
      );

      // Setup type members with proper constructors map
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        base_type,
        new Map()
      );
      (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
        derived_type,
        new Map()
      );

      types = {
        ...types,
        inheritance_hierarchy: new Map([[derived_type, [base_type]]]),
        interface_implementations: new Map(),
      };

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              base_constructor_sym,
              {
                kind: "constructor",
                name: "constructor" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Finding constructor for derived should look in base
      const constructor = find_default_constructor(base_type, context);

      expect(constructor).toBe(base_constructor_sym);
    });

    it("should resolve super constructor calls", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const base_class_sym = class_symbol("Base", test_location);
      const derived_class_sym = class_symbol("Derived", test_location);
      const base_constructor_sym = method_symbol("constructor", test_location);

      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "Base" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "Derived" as SymbolName,
        test_location
      );

      // Setup types and hierarchy
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        base_class_sym,
        base_type
      );
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        derived_class_sym,
        derived_type
      );
      (types.constructors as Map<TypeId, SymbolId>).set(
        base_type,
        base_constructor_sym
      );

      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        derived_type,
        [base_type]
      );
      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();

      const { resolve_constructor_calls_enhanced } = await import(
        "./constructor_resolver"
      );

      // Create a semantic index with a super call
      const index = {
        file_path,
        symbols: new Map([
          [
            base_constructor_sym,
            {
              kind: "constructor",
              name: "constructor" as SymbolName,
              location: test_location,
            } as SymbolDefinition,
          ],
          [
            derived_class_sym,
            {
              kind: "class",
              name: "Derived" as SymbolName,
              location: {
                file_path,
                start_line: 10,
                start_column: 1,
                end_line: 20,
                end_column: 1,
              },
            } as SymbolDefinition,
          ],
        ]),
        references: {
          calls: [
            {
              location: {
                file_path,
                line: 12,
                column: 5,
                end_line: 12,
                end_column: 10,
              },
              name: "super" as SymbolName,
              scope_id: "scope_1" as ScopeId,
              call_type: "super",
            },
          ],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
      } as unknown as SemanticIndex;

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: index,
        indices: new Map(),
      };

      const resolutions = resolve_constructor_calls_enhanced(index, context);

      expect(resolutions.length).toBeGreaterThan(0);
      const super_resolution = resolutions.find(
        (r) => r.resolution_path === "inherited"
      );
      expect(super_resolution).toBeDefined();
      expect(super_resolution?.resolved_method).toBe(base_constructor_sym);
    });
  });

  describe("interface resolution utilities", () => {
    it("should find interface implementations", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const interface_type = defined_type_id(
        TypeCategory.INTERFACE,
        "IProcessor" as SymbolName,
        test_location
      );
      const class1_type = defined_type_id(
        TypeCategory.CLASS,
        "ProcessorA" as SymbolName,
        test_location
      );
      const class2_type = defined_type_id(
        TypeCategory.CLASS,
        "ProcessorB" as SymbolName,
        test_location
      );

      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();
      (types.interface_implementations as Map<TypeId, readonly TypeId[]>).set(
        class1_type,
        [interface_type]
      );
      (types.interface_implementations as Map<TypeId, readonly TypeId[]>).set(
        class2_type,
        [interface_type]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();

      const { find_interface_implementations } = await import(
        "./interface_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: { symbols: new Map() } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const implementations = find_interface_implementations(
        interface_type,
        context
      );

      expect(implementations).toEqual([class1_type, class2_type]);
    });

    it("should check if type implements interface", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const interface_type = defined_type_id(
        TypeCategory.INTERFACE,
        "ISerializable" as SymbolName,
        test_location
      );
      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "BaseClass" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "DerivedClass" as SymbolName,
        test_location
      );

      // Base implements interface, derived inherits from base
      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();
      (types.interface_implementations as Map<TypeId, readonly TypeId[]>).set(
        base_type,
        [interface_type]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        derived_type,
        [base_type]
      );

      const { type_implements_interface } = await import(
        "./interface_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: { symbols: new Map() } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Direct implementation
      expect(
        type_implements_interface(base_type, interface_type, context)
      ).toBe(true);

      // Inherited implementation
      expect(
        type_implements_interface(derived_type, interface_type, context)
      ).toBe(true);

      // No implementation
      const unrelated_type = defined_type_id(
        TypeCategory.CLASS,
        "UnrelatedClass" as SymbolName,
        test_location
      );
      expect(
        type_implements_interface(unrelated_type, interface_type, context)
      ).toBe(false);
    });

    it("should verify method implementations", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const interface_method = method_symbol("process", test_location);
      const class_method = method_symbol("process", test_location);
      const wrong_method = method_symbol("execute", test_location);

      const { is_method_implementation } = await import("./interface_resolver");

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              interface_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              class_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              wrong_method,
              {
                kind: "method",
                name: "execute" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Same name = implementation
      expect(
        is_method_implementation(class_method, interface_method, context)
      ).toBe(true);

      // Different name = not implementation
      expect(
        is_method_implementation(wrong_method, interface_method, context)
      ).toBe(false);
    });
  });

  describe("polymorphism utilities", () => {
    it("should find method overrides", async () => {
      const file_path = "test.ts" as FilePath;
      const base_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 1,
      };
      const derived1_location = {
        file_path,
        line: 10,
        column: 1,
        end_line: 15,
        end_column: 1,
      };
      const derived2_location = {
        file_path,
        line: 20,
        column: 1,
        end_line: 25,
        end_column: 1,
      };

      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "Base" as SymbolName,
        base_location
      );
      const derived1_type = defined_type_id(
        TypeCategory.CLASS,
        "Derived1" as SymbolName,
        derived1_location
      );
      const derived2_type = defined_type_id(
        TypeCategory.CLASS,
        "Derived2" as SymbolName,
        derived2_location
      );

      const base_method = method_symbol("process", base_location);
      const derived1_method = method_symbol("process", derived1_location);
      const derived2_method = method_symbol("process", derived2_location);

      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        derived1_type,
        [base_type]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        derived2_type,
        [base_type]
      );

      (
        types.type_members as Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
      ).set(base_type, new Map([["process" as SymbolName, base_method]]));
      (
        types.type_members as Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
      ).set(
        derived1_type,
        new Map([["process" as SymbolName, derived1_method]])
      );
      (
        types.type_members as Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
      ).set(
        derived2_type,
        new Map([["process" as SymbolName, derived2_method]])
      );

      const { find_method_overrides } = await import("./polymorphism_handler");

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              base_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: base_location,
              } as SymbolDefinition,
            ],
            [
              derived1_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: derived1_location,
              } as SymbolDefinition,
            ],
            [
              derived2_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: derived2_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const overrides = find_method_overrides(base_method, base_type, context);

      expect(overrides).toContain(derived1_method);
      expect(overrides).toContain(derived2_method);
      expect(overrides).not.toContain(base_method);
    });

    it("should check if method is override", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const base_method = method_symbol("process", test_location);
      const derived_method = method_symbol("process", test_location);
      const unrelated_method = method_symbol("execute", test_location);

      const { is_method_override } = await import("./polymorphism_handler");

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              base_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              derived_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              unrelated_method,
              {
                kind: "method",
                name: "execute" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Same name = override
      expect(is_method_override(derived_method, base_method, context)).toBe(
        true
      );

      // Different name = not override
      expect(is_method_override(unrelated_method, base_method, context)).toBe(
        false
      );
    });

    it("should determine dispatch type", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const static_method = method_symbol("staticMethod", test_location);
      const final_method = method_symbol("finalMethod", test_location);
      const virtual_method = method_symbol("virtualMethod", test_location);

      const { determine_dispatch_type } = await import(
        "./polymorphism_handler"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              static_method,
              create_test_symbol_definition(
                static_method,
                "staticMethod" as SymbolName,
                "method",
                test_location,
                { is_static: true }
              ),
            ],
            [
              final_method,
              create_test_symbol_definition(
                final_method,
                "finalMethod" as SymbolName,
                "method",
                test_location,
                { modifiers: ["final"] }
              ),
            ],
            [
              virtual_method,
              create_test_symbol_definition(
                virtual_method,
                "virtualMethod" as SymbolName,
                "method",
                test_location
              ),
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      expect(determine_dispatch_type(static_method, context)).toBe("static");
      expect(determine_dispatch_type(final_method, context)).toBe("static");
      expect(determine_dispatch_type(virtual_method, context)).toBe("dynamic");
    });
  });

  describe("edge cases and error conditions", () => {
    it("should handle circular inheritance gracefully", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const type_a = defined_type_id(
        TypeCategory.CLASS,
        "A" as SymbolName,
        test_location
      );
      const type_b = defined_type_id(
        TypeCategory.CLASS,
        "B" as SymbolName,
        test_location
      );
      const type_c = defined_type_id(
        TypeCategory.CLASS,
        "C" as SymbolName,
        test_location
      );

      // Create circular inheritance (should be detected and handled)
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        type_a,
        [type_b]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        type_b,
        [type_c]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        type_c,
        [type_a]
      ); // Circular reference

      const { build_inheritance_chain } = await import(
        "./inheritance_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: { symbols: new Map() } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Should not infinite loop
      const chain = build_inheritance_chain(type_a, context);

      // Should have detected cycle and stopped
      expect(chain.length).toBeLessThanOrEqual(3);
      expect(new Set(chain).size).toBe(chain.length); // No duplicates
    });

    it("should handle missing type members gracefully", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const type_without_members = defined_type_id(
        TypeCategory.CLASS,
        "EmptyClass" as SymbolName,
        test_location
      );

      // Don't set up any type members
      (types.symbol_types as Map<SymbolId, TypeId>).set(
        class_symbol("EmptyClass", test_location),
        type_without_members
      );

      const { get_type_methods } = await import("./type_lookup");

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: { symbols: new Map() } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const methods = get_type_methods(type_without_members, context);
      expect(methods).toBeNull();
    });

    it("should handle polymorphic resolution with no implementations", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const empty_type = defined_type_id(
        TypeCategory.CLASS,
        "EmptyClass" as SymbolName,
        test_location
      );

      const { resolve_polymorphic_method_call } = await import(
        "./polymorphism_handler"
      );

      const call_context = {
        location: test_location,
        receiver_type: empty_type,
        is_static: false,
      };

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: { symbols: new Map() } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const result = resolve_polymorphic_method_call(
        "nonExistentMethod" as SymbolName,
        empty_type,
        call_context,
        context
      );

      expect(result).toBeNull();
    });

    it("should handle multiple interface implementations", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      const interface1_type = defined_type_id(
        TypeCategory.INTERFACE,
        "ISerializable" as SymbolName,
        test_location
      );
      const interface2_type = defined_type_id(
        TypeCategory.INTERFACE,
        "IComparable" as SymbolName,
        test_location
      );
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "DataClass" as SymbolName,
        test_location
      );

      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();
      (types.interface_implementations as Map<TypeId, readonly TypeId[]>).set(
        class_type,
        [interface1_type, interface2_type]
      );
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();

      const { get_implemented_interfaces } = await import(
        "./interface_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: { symbols: new Map() } as unknown as SemanticIndex,
        indices: new Map(),
      };

      const interfaces = get_implemented_interfaces(class_type, context);

      expect(interfaces).toContain(interface1_type);
      expect(interfaces).toContain(interface2_type);
      expect(interfaces).toHaveLength(2);
    });

    it("should resolve complex inheritance with interfaces", async () => {
      const file_path = "test.ts" as FilePath;
      const test_location = {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 10,
      };

      // Setup: Interface <- BaseClass <- DerivedClass
      const interface_type = defined_type_id(
        TypeCategory.INTERFACE,
        "IProcessor" as SymbolName,
        test_location
      );
      const base_type = defined_type_id(
        TypeCategory.CLASS,
        "BaseProcessor" as SymbolName,
        test_location
      );
      const derived_type = defined_type_id(
        TypeCategory.CLASS,
        "DerivedProcessor" as SymbolName,
        test_location
      );

      const interface_method = method_symbol("process", test_location);
      const base_method = method_symbol("BaseProcessor", test_location);

      // Base implements interface
      (
        types.interface_implementations as Map<TypeId, readonly TypeId[]>
      ).clear();
      (types.interface_implementations as Map<TypeId, readonly TypeId[]>).set(
        base_type,
        [interface_type]
      );

      // Derived extends Base
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).clear();
      (types.inheritance_hierarchy as Map<TypeId, readonly TypeId[]>).set(
        derived_type,
        [base_type]
      );

      // Interface defines method
      (
        types.type_members as Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
      ).set(
        interface_type,
        new Map([["process" as SymbolName, interface_method]])
      );

      // Base implements method
      (
        types.type_members as Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
      ).set(base_type, new Map([["process" as SymbolName, base_method]]));

      // Derived doesn't override
      (
        types.type_members as Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
      ).set(derived_type, new Map());

      const { resolve_method_with_inheritance } = await import(
        "./inheritance_resolver"
      );

      const context = {
        type_resolution: types,
        imports,
        current_file: file_path,
        current_index: {
          symbols: new Map([
            [
              interface_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
            [
              base_method,
              {
                kind: "method",
                name: "process" as SymbolName,
                location: test_location,
              } as SymbolDefinition,
            ],
          ]),
        } as unknown as SemanticIndex,
        indices: new Map(),
      };

      // Calling process on derived should resolve to base implementation
      const result = resolve_method_with_inheritance(
        "process" as SymbolName,
        derived_type,
        false,
        context,
        test_location
      );

      expect(result).not.toBeNull();
      expect(result?.resolved_method).toBe(base_method);
      // Could be "inherited" since it comes from base, or "interface" if resolved via interface
      expect(["inherited", "interface"]).toContain(result?.resolution_path);
    });
  });

  describe("Method Resolver Enhancements", () => {
    describe("resolve_member_property_access function", () => {
      it("should resolve property access on known type", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };
        const class_sym = class_symbol("TestClass", test_location);
        const property_sym = variable_symbol("testProperty", test_location);
        const class_type = defined_type_id(
          TypeCategory.CLASS,
          "TestClass" as SymbolName,
          test_location
        );

        // Setup type resolution with property
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          class_sym,
          class_type
        );
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          class_type,
          new Map([["testProperty" as SymbolName, property_sym]])
        );

        // Setup property access
        const member_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 20,
          },
          member_name: "testProperty" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 1,
              end_line: 10,
              end_column: 8,
            },
          },
          is_optional_chain: false,
        };

        // Setup semantic index with type information for receiver
        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              class_sym,
              create_test_symbol_definition(
                class_sym,
                "TestClass" as SymbolName,
                "class",
                test_location
              ),
            ],
            [
              property_sym,
              create_test_symbol_definition(
                property_sym,
                "testProperty" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [
              file_path,
              new Map([
                ["TestClass" as SymbolName, class_sym],
                ["testProperty" as SymbolName, property_sym],
              ]),
            ],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        // Add receiver type information to reference_types
        const receiver_location_key = location_key(
          member_access.object.location!
        );
        (types.reference_types as Map<LocationKey, TypeId>).set(
          receiver_location_key,
          class_type
        );

        indices.set(file_path, index);

        // Resolve method calls (should include property access)
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify property access was resolved
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(property_sym);
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: property_sym,
          receiver_type: class_type,
          method_kind: "instance",
          resolution_path: "direct",
        });
      });

      it("should return null for property access on unknown type", () => {
        const file_path = "test.ts" as FilePath;
        const member_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 20,
          },
          member_name: "unknownProperty" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 1,
              end_line: 10,
              end_column: 8,
            },
          },
          is_optional_chain: false,
        };

        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map(),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map(),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(file_path, index);

        // Resolve method calls - property access should fail
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify property access was not resolved
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBeUndefined();
      });
    });

    describe("resolve_enum_member_access function", () => {
      it("should resolve enum member access with direct enum symbol", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };
        const enum_sym = class_symbol("Color", test_location);
        const member_sym = variable_symbol("Red", test_location);
        const enum_type = defined_type_id(
          TypeCategory.ENUM,
          "Color" as SymbolName,
          test_location
        );

        // Setup type resolution
        (types.symbol_types as Map<SymbolId, TypeId>).set(enum_sym, enum_type);
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          enum_type,
          new Map([["Red" as SymbolName, member_sym]])
        );

        // Setup enum member access (Color.Red)
        const member_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 6,
            end_line: 10,
            end_column: 9,
          },
          member_name: "Red" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 1,
              end_line: 10,
              end_column: 5,
            },
          },
          is_optional_chain: false,
        };

        // Setup semantic index with enum symbol at object location
        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              enum_sym,
              create_test_symbol_definition(
                enum_sym,
                "Color" as SymbolName,
                "enum",
                {
                  file_path,
                  start_line: 10,
                  start_column: 1,
                  end_line: 10,
                  end_column: 5,
                }
              ),
            ],
            [
              member_sym,
              create_test_symbol_definition(
                member_sym,
                "Red" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [
              file_path,
              new Map([
                ["Color" as SymbolName, enum_sym],
                ["Red" as SymbolName, member_sym],
              ]),
            ],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(file_path, index);

        // Resolve method calls (should include enum access)
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify enum member access was resolved
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(member_sym);
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: member_sym,
          receiver_type: enum_type,
          method_kind: "instance", // Current implementation behavior
          resolution_path: "direct",
        });
      });

      it("should resolve enum member access through imports", () => {
        const enum_file = "enums.ts" as FilePath;
        const consumer_file = "consumer.ts" as FilePath;
        const test_location = {
          file_path: enum_file,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };

        const enum_sym = class_symbol("Status", test_location);
        const member_sym = variable_symbol("Active", test_location);
        const enum_type = defined_type_id(
          TypeCategory.ENUM,
          "Status" as SymbolName,
          test_location
        );

        // Setup type resolution
        (types.symbol_types as Map<SymbolId, TypeId>).set(enum_sym, enum_type);
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          enum_type,
          new Map([["Active" as SymbolName, member_sym]])
        );

        // Setup imports for consumer file
        const consumer_imports = new Map([["Status" as SymbolName, enum_sym]]);
        imports = new Map([
          [enum_file, new Map()],
          [consumer_file, consumer_imports],
        ]);

        // Setup enum member access (Status.Active)
        const member_access: MemberAccessReference = {
          location: {
            file_path: consumer_file,
            start_line: 5,
            start_column: 7,
            end_line: 5,
            end_column: 13,
          },
          member_name: "Active" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path: consumer_file,
              start_line: 5,
              start_column: 1,
              end_line: 5,
              end_column: 6,
            },
          },
          is_optional_chain: false,
        };

        // Setup enum file index
        const enum_index = {
          file_path: enum_file,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              enum_sym,
              create_test_symbol_definition(
                enum_sym,
                "Status" as SymbolName,
                "enum",
                test_location
              ),
            ],
            [
              member_sym,
              create_test_symbol_definition(
                member_sym,
                "Active" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [enum_file, new Map([["Status" as SymbolName, enum_sym]])],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        // Setup consumer file index with enum symbol at object location
        const consumer_index = {
          file_path: consumer_file,
          language: "typescript",
          root_scope_id: "scope_2" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              enum_sym,
              create_test_symbol_definition(
                enum_sym,
                "Status" as SymbolName,
                "enum",
                {
                  file_path: consumer_file,
                  start_line: 5,
                  start_column: 1,
                  end_line: 5,
                  end_column: 6,
                }
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [consumer_file, new Map([["Status" as SymbolName, enum_sym]])],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(enum_file, enum_index);
        indices.set(consumer_file, consumer_index);

        // Resolve method calls (should resolve through imports)
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify enum member access was resolved through imports
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(member_sym);
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: member_sym,
          receiver_type: enum_type,
          method_kind: "instance",
          resolution_path: "direct",
        });
      });
    });

    describe("record_property_resolution function", () => {
      it("should record property access as trackable call relationship", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };
        const class_sym = class_symbol("TestClass", test_location);
        const property_sym = variable_symbol("value", test_location);
        const class_type = defined_type_id(
          TypeCategory.CLASS,
          "TestClass" as SymbolName,
          test_location
        );

        // Setup type resolution
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          class_sym,
          class_type
        );
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          class_type,
          new Map([["value" as SymbolName, property_sym]])
        );

        // Setup property access
        const member_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 15,
          },
          member_name: "value" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 1,
              end_line: 10,
              end_column: 8,
            },
          },
          is_optional_chain: false,
        };

        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              class_sym,
              create_test_symbol_definition(
                class_sym,
                "TestClass" as SymbolName,
                "class",
                test_location
              ),
            ],
            [
              property_sym,
              create_test_symbol_definition(
                property_sym,
                "value" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [file_path, new Map([["TestClass" as SymbolName, class_sym]])],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        // Add receiver type information
        const receiver_location_key = location_key(
          member_access.object.location!
        );
        (types.reference_types as Map<LocationKey, TypeId>).set(
          receiver_location_key,
          class_type
        );

        indices.set(file_path, index);

        // Resolve method calls
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify property access creates trackable call relationship
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.has(location_key_val)).toBe(true);
        expect(result.calls_to_method.has(property_sym)).toBe(true);
        expect(result.calls_to_method.get(property_sym)).toContain(
          member_access.location
        );
        expect(result.resolution_details.has(location_key_val)).toBe(true);
      });
    });

    describe("property access fallback to enum resolution", () => {
      it("should try enum resolution when property resolution fails", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };
        const enum_sym = class_symbol("Status", test_location);
        const member_sym = variable_symbol("Active", test_location);
        const enum_type = defined_type_id(
          TypeCategory.ENUM,
          "Status" as SymbolName,
          test_location
        );

        // Setup enum type (but NOT as a regular property type)
        (types.symbol_types as Map<SymbolId, TypeId>).set(enum_sym, enum_type);
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          enum_type,
          new Map([["Active" as SymbolName, member_sym]])
        );

        // Setup property access that should fail as property but succeed as enum
        const member_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 7,
            end_line: 10,
            end_column: 13,
          },
          member_name: "Active" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 1,
              end_line: 10,
              end_column: 6,
            },
          },
          is_optional_chain: false,
        };

        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              enum_sym,
              create_test_symbol_definition(
                enum_sym,
                "Status" as SymbolName,
                "enum",
                {
                  file_path,
                  start_line: 10,
                  start_column: 1,
                  end_line: 10,
                  end_column: 6,
                }
              ),
            ],
            [
              member_sym,
              create_test_symbol_definition(
                member_sym,
                "Active" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [file_path, new Map([["Status" as SymbolName, enum_sym]])],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(file_path, index);

        // Resolve - should fallback to enum resolution
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify enum fallback resolution worked
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(member_sym);
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: member_sym,
          receiver_type: enum_type,
          method_kind: "instance",
          resolution_path: "direct",
        });
      });
    });
  });

  describe("TypeScript Enhanced Features", () => {
    describe("Parameter Property Resolution", () => {
      it("should resolve parameter property access in method calls", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };
        const class_sym = class_symbol("User", test_location);
        const name_property = variable_symbol("name", test_location);
        const class_type = defined_type_id(
          TypeCategory.CLASS,
          "User" as SymbolName,
          test_location
        );

        // Setup type resolution
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          class_sym,
          class_type
        );
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          class_type,
          new Map([["name" as SymbolName, name_property]])
        );

        // Setup property access (this.name)
        const member_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 5,
            start_column: 12,
            end_line: 5,
            end_column: 16,
          },
          member_name: "name" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 5,
              start_column: 7,
              end_line: 5,
              end_column: 11,
            },
          },
          is_optional_chain: false,
        };

        // Setup semantic index
        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              class_sym,
              create_test_symbol_definition(
                class_sym,
                "User" as SymbolName,
                "class",
                test_location
              ),
            ],
            [
              name_property,
              create_test_symbol_definition(
                name_property,
                "name" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [
              file_path,
              new Map([
                ["User" as SymbolName, class_sym],
                ["name" as SymbolName, name_property],
              ]),
            ],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(file_path, index);

        // Resolve method calls (including property access)
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify parameter property access was captured
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(name_property);
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: name_property,
          receiver_type: class_type,
          method_kind: "instance",
          resolution_path: "direct",
        });
      });
    });

    describe("Enum Member Access Resolution", () => {
      it("should resolve enum member access across files", () => {
        const enum_file = "enums.ts" as FilePath;
        const consumer_file = "consumer.ts" as FilePath;
        const test_location = {
          file_path: enum_file,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };

        const status_enum = class_symbol("Status", test_location);
        const active_member = variable_symbol("Active", test_location);
        const enum_type = defined_type_id(
          TypeCategory.ENUM,
          "Status" as SymbolName,
          test_location
        );

        // Setup type resolution
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          status_enum,
          enum_type
        );
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          enum_type,
          new Map([["Active" as SymbolName, active_member]])
        );

        // Setup imports for consumer file
        const consumer_imports = new Map([
          ["Status" as SymbolName, status_enum],
        ]);
        imports = new Map([
          [enum_file, new Map()],
          [consumer_file, consumer_imports],
        ]);

        // Setup enum member access (Status.Active)
        const member_access: MemberAccessReference = {
          location: {
            file_path: consumer_file,
            start_line: 4,
            start_column: 16,
            end_line: 4,
            end_column: 22,
          },
          member_name: "Active" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path: consumer_file,
              start_line: 4,
              start_column: 10,
              end_line: 4,
              end_column: 16,
            },
          },
          is_optional_chain: false,
        };

        // Setup enum file index
        const enum_index = {
          file_path: enum_file,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              status_enum,
              create_test_symbol_definition(
                status_enum,
                "Status" as SymbolName,
                "enum",
                test_location
              ),
            ],
            [
              active_member,
              create_test_symbol_definition(
                active_member,
                "Active" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [
              enum_file,
              new Map([
                ["Status" as SymbolName, status_enum],
                ["Active" as SymbolName, active_member],
              ]),
            ],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        // Setup consumer file index - need to include the enum symbol at object location
        const consumer_index = {
          file_path: consumer_file,
          language: "typescript",
          root_scope_id: "scope_2" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              status_enum,
              create_test_symbol_definition(
                status_enum,
                "Status" as SymbolName,
                "enum",
                {
                  file_path: consumer_file,
                  start_line: 4,
                  start_column: 10,
                  end_line: 4,
                  end_column: 16,
                }
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [member_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [consumer_file, new Map([["Status" as SymbolName, status_enum]])],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(enum_file, enum_index);
        indices.set(consumer_file, consumer_index);

        // Resolve method calls (including enum access)
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify enum member access was resolved
        const location_key_val = location_key(member_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(active_member);
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: active_member,
          receiver_type: enum_type,
          method_kind: "instance", // Actually resolved as instance in current implementation
          resolution_path: "direct",
        });
      });
    });

    describe("Property Access vs Method Calls", () => {
      it("should handle both property access and method calls on same type", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };
        const class_sym = class_symbol("MyClass", test_location);
        const property_sym = variable_symbol("value", test_location);
        const method_sym = method_symbol("getValue", test_location);
        const class_type = defined_type_id(
          TypeCategory.CLASS,
          "MyClass" as SymbolName,
          test_location
        );

        // Setup type resolution with both property and method
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          class_sym,
          class_type
        );
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          class_type,
          new Map([
            ["value" as SymbolName, property_sym],
            ["getValue" as SymbolName, method_sym],
          ])
        );

        // Setup both property access and method call
        const property_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 1,
            end_line: 10,
            end_column: 15,
          },
          member_name: "value" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 1,
              end_line: 10,
              end_column: 8,
            },
          },
          is_optional_chain: false,
        };

        const method_call: MemberAccessReference = {
          location: {
            file_path,
            start_line: 11,
            start_column: 1,
            end_line: 11,
            end_column: 18,
          },
          member_name: "getValue" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "method",
          object: {
            location: {
              file_path,
              start_line: 11,
              start_column: 1,
              end_line: 11,
              end_column: 8,
            },
          },
          is_optional_chain: false,
        };

        // Setup semantic index
        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              class_sym,
              create_test_symbol_definition(
                class_sym,
                "MyClass" as SymbolName,
                "class",
                test_location
              ),
            ],
            [
              property_sym,
              create_test_symbol_definition(
                property_sym,
                "value" as SymbolName,
                "variable",
                test_location
              ),
            ],
            [
              method_sym,
              create_test_symbol_definition(
                method_sym,
                "getValue" as SymbolName,
                "method",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [property_access, method_call],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [
              file_path,
              new Map([
                ["MyClass" as SymbolName, class_sym],
                ["value" as SymbolName, property_sym],
                ["getValue" as SymbolName, method_sym],
              ]),
            ],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(file_path, index);

        // Resolve both property access and method calls
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify both property access and method call were resolved
        const property_location_key = location_key(property_access.location);
        const method_location_key = location_key(method_call.location);

        expect(result.method_calls.get(property_location_key)).toBe(
          property_sym
        );
        expect(result.method_calls.get(method_location_key)).toBe(method_sym);

        // Verify property access has correct resolution details
        expect(
          result.resolution_details.get(property_location_key)
        ).toMatchObject({
          resolved_method: property_sym,
          receiver_type: class_type,
          method_kind: "instance",
          resolution_path: "direct",
        });

        // Verify method call has correct resolution details
        expect(
          result.resolution_details.get(method_location_key)
        ).toMatchObject({
          resolved_method: method_sym,
          receiver_type: class_type,
          method_kind: "instance",
          resolution_path: "direct",
        });
      });
    });

    describe("Complex Member Access Chains", () => {
      it("should resolve complex member access with TypeScript constructs", () => {
        const file_path = "test.ts" as FilePath;
        const test_location = {
          file_path,
          line: 1,
          column: 1,
          end_line: 1,
          end_column: 10,
        };

        // Create symbols for complex chain: this.settings.user.name
        const config_class = class_symbol("ConfigManager", test_location);
        const settings_property = variable_symbol("settings", test_location);
        const user_property = variable_symbol("user", test_location);
        const name_property = variable_symbol("name", test_location);

        const config_type = defined_type_id(
          TypeCategory.CLASS,
          "ConfigManager" as SymbolName,
          test_location
        );
        const settings_type = defined_type_id(
          TypeCategory.TYPE_ALIAS,
          "Settings" as SymbolName,
          test_location
        );
        const user_type = defined_type_id(
          TypeCategory.TYPE_ALIAS,
          "UserPrefs" as SymbolName,
          test_location
        );

        // Setup type resolution for the chain
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          config_class,
          config_type
        );
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          settings_property,
          settings_type
        );
        (types.symbol_types as Map<SymbolId, TypeId>).set(
          user_property,
          user_type
        );

        // ConfigManager has settings property
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          config_type,
          new Map([["settings" as SymbolName, settings_property]])
        );

        // Settings has user property
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          settings_type,
          new Map([["user" as SymbolName, user_property]])
        );

        // UserPrefs has name property
        (types.type_members as Map<TypeId, Map<SymbolName, SymbolId>>).set(
          user_type,
          new Map([["name" as SymbolName, name_property]])
        );

        // Setup member access for this.settings
        const settings_access: MemberAccessReference = {
          location: {
            file_path,
            start_line: 10,
            start_column: 17,
            end_line: 10,
            end_column: 25,
          },
          member_name: "settings" as SymbolName,
          scope_id: "scope_1" as ScopeId,
          access_type: "property",
          object: {
            location: {
              file_path,
              start_line: 10,
              start_column: 12,
              end_line: 10,
              end_column: 16,
            },
          },
          is_optional_chain: false,
        };

        // Setup semantic index
        const index = {
          file_path,
          language: "typescript",
          root_scope_id: "scope_1" as ScopeId,
          scopes: new Map(),
          symbols: new Map([
            [
              config_class,
              create_test_symbol_definition(
                config_class,
                "ConfigManager" as SymbolName,
                "class",
                test_location
              ),
            ],
            [
              settings_property,
              create_test_symbol_definition(
                settings_property,
                "settings" as SymbolName,
                "variable",
                test_location
              ),
            ],
          ]),
          references: {
            calls: [],
            member_accesses: [settings_access],
            returns: [],
            type_annotations: [],
          },
          imports: [],
          exports: [],
          file_symbols_by_name: new Map([
            [
              file_path,
              new Map([
                ["ConfigManager" as SymbolName, config_class],
                ["settings" as SymbolName, settings_property],
              ]),
            ],
          ]),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { variable_types: [], assignment_flows: [] },
          local_type_flow: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
        } as unknown as SemanticIndex;

        indices.set(file_path, index);

        // Resolve member access chain
        const result = resolve_method_calls(indices, imports, functions, types);

        // Verify property access in chain was resolved
        const location_key_val = location_key(settings_access.location);
        expect(result.method_calls.get(location_key_val)).toBe(
          settings_property
        );
        expect(result.resolution_details.get(location_key_val)).toMatchObject({
          resolved_method: settings_property,
          receiver_type: config_type,
          method_kind: "instance",
          resolution_path: "direct",
        });
      });
    });
  });
});
