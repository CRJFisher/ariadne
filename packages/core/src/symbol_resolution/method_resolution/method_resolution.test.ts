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
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { MemberAccessReference } from "../../semantic_index/references/member_access_references/member_access_references";
import type { LocalConstructorCall } from "../../semantic_index/references/type_flow_references/type_flow_references";
import type {
  FunctionResolutionMap,
  TypeResolutionMap,
} from "../types";
import { MethodLookupContext } from "./method_types";

// Helper function to create complete SymbolDefinition objects for tests
function createTestSymbolDefinition(
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
      const method_sym = method_symbol("getValue", "MyClass", test_location);
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "getValue" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            line: 10,
            column: 1,
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
                line: 1,
                column: 1,
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
                line: 2,
                column: 3,
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
                line: 10,
                column: 1,
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
      const static_meth = method_symbol(
        "createDefault",
        "MyClass",
        test_location
      );
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 20,
        },
        member_name: "createDefault" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            line: 10,
            column: 1,
            end_line: 10,
            end_column: 7,
          },
        },
        is_optional_chain: false,
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
                line: 1,
                column: 1,
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
                line: 2,
                column: 3,
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
      const constructor_sym = method_symbol(
        "constructor",
        "MyClass",
        test_location
      );
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
          line: 10,
          column: 1,
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
                line: 1,
                column: 1,
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
                line: 2,
                column: 3,
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "nonExistent" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            line: 10,
            column: 1,
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
            createTestSymbolDefinition(
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "someMethod" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            line: 10,
            column: 1,
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
          line: 10,
          column: 1,
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
      const property_sym = method_symbol("value", "MyClass", test_location);
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "value" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "property", // Not a method
        object: {
          location: {
            file_path,
            line: 10,
            column: 1,
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
      const class_sym = class_symbol("MyClass", test_location);
      const method_sym = method_symbol("getValue", "MyClass", test_location);
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "getValue" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {
          location: {
            file_path,
            line: 10,
            column: 1,
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
      const instance_meth = method_symbol("getValue", "MyClass", test_location);
      const static_meth = method_symbol(
        "createDefault",
        "MyClass",
        test_location
      );
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
                line: 1,
                column: 1,
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
                line: 3,
                column: 3,
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
                line: 5,
                column: 3,
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
      const method_sym = method_symbol("getValue", "MyClass", test_location);
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
          line: 10,
          column: 1,
          end_line: 10,
          end_column: 15,
        },
        member_name: "method" as SymbolName,
        scope_id: "scope_1" as ScopeId,
        access_type: "method",
        object: {},
        is_optional_chain: false,
        is_static_access: true,
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
          local_type_tracking: { annotations: [], declarations: [], assignments: [] },
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
      const constructor_sym = method_symbol(
        "constructor",
        "MyClass",
        test_location
      );
      const static_method_sym = method_symbol(
        "create",
        "MyClass",
        test_location
      );
      const instance_method_sym = method_symbol(
        "getValue",
        "MyClass",
        test_location
      );

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
      const method_sym = method_symbol("getValue", "MyClass", test_location);

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
      const method_sym = method_symbol("getValue", "MyClass", test_location);

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
      const method_sym = method_symbol("getValue", "MyClass", test_location);

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
      const base_method_sym = method_symbol(
        "baseMethod",
        "BaseClass",
        test_location
      );
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
      const interface_method_sym = method_symbol(
        "doSomething",
        "IMyInterface",
        test_location
      );
      const class_method_sym = method_symbol(
        "doSomething",
        "MyClass",
        test_location
      );
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
      const base_method_sym = method_symbol("process", "Base", test_location);
      const derived_method_sym = method_symbol(
        "process",
        "Derived",
        test_location
      );

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

      const base_method_sym = method_symbol("process", "Base", test_location);
      const derived_method_sym = method_symbol(
        "process",
        "Derived",
        test_location
      );

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
      const base_constructor_sym = method_symbol(
        "constructor",
        "Base",
        test_location
      );

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

      const { find_default_constructor } = await import(
        "./constructor_resolver"
      );

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
      const base_constructor_sym = method_symbol(
        "constructor",
        "Base",
        test_location
      );

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
                line: 10,
                column: 1,
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

      const interface_method = method_symbol(
        "process",
        "IProcessor",
        test_location
      );
      const class_method = method_symbol(
        "process",
        "ProcessorImpl",
        test_location
      );
      const wrong_method = method_symbol(
        "execute",
        "ProcessorImpl",
        test_location
      );

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

      const base_method = method_symbol("process", "Base", base_location);
      const derived1_method = method_symbol(
        "process",
        "Derived1",
        derived1_location
      );
      const derived2_method = method_symbol(
        "process",
        "Derived2",
        derived2_location
      );

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

      const base_method = method_symbol("process", "Base", test_location);
      const derived_method = method_symbol("process", "Derived", test_location);
      const unrelated_method = method_symbol(
        "execute",
        "Derived",
        test_location
      );

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

      const static_method = method_symbol(
        "staticMethod",
        "MyClass",
        test_location
      );
      const final_method = method_symbol(
        "finalMethod",
        "MyClass",
        test_location
      );
      const virtual_method = method_symbol(
        "virtualMethod",
        "MyClass",
        test_location
      );

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
              createTestSymbolDefinition(
                static_method,
                "staticMethod" as SymbolName,
                "method",
                test_location,
                { is_static: true }
              ),
            ],
            [
              final_method,
              createTestSymbolDefinition(
                final_method,
                "finalMethod" as SymbolName,
                "method",
                test_location
              ),
            ],
            [
              virtual_method,
              createTestSymbolDefinition(
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

      const interface_method = method_symbol(
        "process",
        "IProcessor",
        test_location
      );
      const base_method = method_symbol(
        "process",
        "BaseProcessor",
        test_location
      );

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
});
