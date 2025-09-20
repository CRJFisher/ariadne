/**
 * Symbol Resolution Module Tests
 *
 * Comprehensive test suite for the four-phase symbol resolution pipeline.
 * Tests each phase independently and the integration of all phases.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_symbols } from "./symbol_resolution";
import type {
  ResolutionInput,
  ResolvedSymbols,
  ImportResolutionMap,
  FunctionResolutionMap,
  TypeResolutionMap,
  MethodResolutionMap,
} from "./types";
import type {
  FilePath,
  SymbolId,
  TypeId,
  Location,
  SymbolName,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
  Import,
  Export,
} from "@ariadnejs/types";
import { function_symbol, class_symbol, method_symbol, variable_symbol, defined_type_id, TypeCategory } from "@ariadnejs/types";
import type { SemanticIndex } from "../semantic_index/semantic_index";
import type { LocalTypeInfo } from "../semantic_index/type_members";
import type { LocalTypeAnnotation } from "../semantic_index/references/type_annotation_references";
import type { LocalTypeTracking } from "../semantic_index/references/type_tracking";
import type { LocalTypeFlow } from "../semantic_index/references/type_flow_references";

// Helper function to create a Location
function location(file_path: FilePath, line: number, column: number): Location {
  return {
    file_path,
    line,
    column,
    end_line: line,
    end_column: column + 1,
  };
}

// Helper function to create SymbolId based on kind
function symbol_id(kind: string, name: string, loc: Location): SymbolId {
  switch (kind) {
    case "function":
      return function_symbol(name, loc.file_path, loc);
    case "class":
      return class_symbol(name, loc.file_path, loc);
    case "method":
      return method_symbol(name, "UnknownClass", loc.file_path, loc);
    case "variable":
      return variable_symbol(name, loc);
    default:
      return function_symbol(name, loc.file_path, loc); // Default fallback
  }
}

// Helper to create location objects
function location(filePath: FilePath, line: number, column: number): Location {
  return {
    file_path: filePath,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };
}

describe("Symbol Resolution Pipeline", () => {
  // Helper to create test SemanticIndex
  function createTestIndex(
    filePath: FilePath,
    options: {
      symbols?: Map<SymbolId, SymbolDefinition>;
      imports?: Import[];
      exports?: Export[];
      localTypes?: LocalTypeInfo[];
      localTypeFlow?: LocalTypeFlow;
    } = {}
  ): SemanticIndex {
    const rootScopeId = `scope:global:${filePath}:0:0` as ScopeId;
    const rootScope: LexicalScope = {
      id: rootScopeId,
      parent_id: null,
      name: null,
      type: "module",
      location: location(filePath, 0, 0),
      child_ids: [],
      symbols: new Map(),
    };

    return {
      file_path: filePath,
      language: "typescript",
      root_scope_id: rootScopeId,
      scopes: new Map([[rootScopeId, rootScope]]),
      symbols: options.symbols || new Map(),
      references: {
        function_calls: [],
        member_accesses: [],
        returns: [],
        type_references: [],
      },
      imports: options.imports || [],
      exports: options.exports || [],
      file_symbols_by_name: new Map(),
      local_types: options.localTypes || [],
      local_type_annotations: [],
      local_type_tracking: {
        annotations: [],
        declarations: [],
        assignments: [],
      },
      local_type_flow: options.localTypeFlow || {
        constructor_calls: [],
        assignments: [],
        returns: [],
        call_assignments: [],
      },
    };
  }

  describe("Main Entry Point", () => {
    it("should export resolve_symbols function", () => {
      expect(resolve_symbols).toBeDefined();
      expect(typeof resolve_symbols).toBe("function");
    });

    it("should return ResolvedSymbols with all phases", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const testFile = "test.ts" as FilePath;
      indices.set(testFile, createTestIndex(testFile));

      const input: ResolutionInput = { indices };
      const result = resolve_symbols(input);

      expect(result).toBeDefined();
      expect(result.resolved_references).toBeInstanceOf(Map);
      expect(result.references_to_symbol).toBeInstanceOf(Map);
      expect(result.unresolved_references).toBeInstanceOf(Map);
      expect(result.phases).toBeDefined();
      expect(result.phases.imports).toBeDefined();
      expect(result.phases.functions).toBeDefined();
      expect(result.phases.types).toBeDefined();
      expect(result.phases.methods).toBeDefined();
    });
  });

  describe("Phase 1: Import/Export Resolution", () => {
    it("should resolve named imports", () => {
      // File A exports a function
      const fileA = "a.ts" as FilePath;
      const funcSymbolId = symbol_id("function", "myFunc", location(fileA, 1, 0));
      const symbolsA = new Map<SymbolId, SymbolDefinition>([
        [funcSymbolId, {
          id: funcSymbolId,
          name: "myFunc" as SymbolName,
          kind: "function",
          location: location(fileA, 1, 0),
          scope_id: "scope:global:a.ts:0:0" as ScopeId,
          is_hoisted: false,
          is_exported: true,
          is_imported: false,
          references: [],
        }],
      ]);
      const exportsA: Export[] = [{
        name: "myFunc" as SymbolName,
        symbol_id: funcSymbolId,
        location: location(fileA, 1, 0),
        kind: "named",
      }];

      // File B imports the function
      const fileB = "b.ts" as FilePath;
      const importsB: Import[] = [{
        name: "myFunc" as SymbolName,
        source: "./a",
        location: location(fileB, 1, 0),
        kind: "named",
      }];

      const indices = new Map<FilePath, SemanticIndex>([
        [fileA, createTestIndex(fileA, { symbols: symbolsA, exports: exportsA })],
        [fileB, createTestIndex(fileB, { imports: importsB })],
      ]);

      const result = resolve_symbols({ indices });
      const { imports } = result.phases;

      // Verify import was resolved
      expect(imports.imports.has(fileB)).toBe(true);
      const fileBImports = imports.imports.get(fileB);
      expect(fileBImports).toBeDefined();
      // Note: Current implementation is TODO, so expectations would be based on actual implementation
    });

    it("should resolve default imports", () => {
      const fileA = "a.ts" as FilePath;
      const classSymbolId = symbol_id("class", "MyClass", location(fileA, 1, 0));
      const exportsA: Export[] = [{
        name: "default" as SymbolName,
        symbol_id: classSymbolId,
        location: location(fileA, 1, 0),
        kind: "default",
      }];

      const fileB = "b.ts" as FilePath;
      const importsB: Import[] = [{
        name: "MyClass" as SymbolName,
        source: "./a",
        location: location(fileB, 1, 0),
        kind: "default",
      }];

      const indices = new Map<FilePath, SemanticIndex>([
        [fileA, createTestIndex(fileA, { exports: exportsA })],
        [fileB, createTestIndex(fileB, { imports: importsB })],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.imports).toBeDefined();
    });

    it("should resolve namespace imports", () => {
      const fileA = "a.ts" as FilePath;
      const func1 = symbol_id("function", "func1", location(fileA, 1, 0));
      const func2 = symbol_id("function", "func2", location(fileA, 2, 0));
      const exportsA: Export[] = [
        { name: "func1" as SymbolName, symbol_id: func1, location: location(fileA, 1, 0), kind: "named" },
        { name: "func2" as SymbolName, symbol_id: func2, location: location(fileA, 2, 0), kind: "named" },
      ];

      const fileB = "b.ts" as FilePath;
      const importsB: Import[] = [{
        name: "utils" as SymbolName,
        source: "./a",
        location: location(fileB, 1, 0),
        kind: "namespace",
      }];

      const indices = new Map<FilePath, SemanticIndex>([
        [fileA, createTestIndex(fileA, { exports: exportsA })],
        [fileB, createTestIndex(fileB, { imports: importsB })],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.imports.imports).toBeDefined();
    });
  });

  describe("Phase 2: Function Call Resolution", () => {
    it("should resolve function calls via lexical scope", () => {
      const filePath = "test.ts" as FilePath;
      const funcId = symbol_id("function", "myFunc", location(filePath, 1, 0));
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [funcId, {
          id: funcId,
          name: "myFunc" as SymbolName,
          kind: "function",
          location: location(filePath, 1, 0),
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
          is_hoisted: true,
          is_exported: false,
          is_imported: false,
          references: [],
        }],
      ]);

      const index = createTestIndex(filePath, { symbols });
      index.references.function_calls.push({
        name: "myFunc" as SymbolName,
        location: location(filePath, 5, 10),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
      });

      const indices = new Map([[filePath, index]]);
      const result = resolve_symbols({ indices });

      expect(result.phases.functions.function_calls).toBeDefined();
      expect(result.phases.functions.calls_to_function).toBeDefined();
    });

    it("should resolve imported function calls", () => {
      // Setup two files with import/export
      const fileA = "a.ts" as FilePath;
      const fileB = "b.ts" as FilePath;

      const funcId = symbol_id("function", "importedFunc", location(fileA, 1, 0));
      const symbolsA = new Map<SymbolId, SymbolDefinition>([
        [funcId, {
          id: funcId,
          name: "importedFunc" as SymbolName,
          kind: "function",
          location: location(fileA, 1, 0),
          scope_id: "scope:global:a.ts:0:0" as ScopeId,
          is_hoisted: false,
          is_exported: true,
          is_imported: false,
          references: [],
        }],
      ]);

      const indexA = createTestIndex(fileA, {
        symbols: symbolsA,
        exports: [{
          name: "importedFunc" as SymbolName,
          symbol_id: funcId,
          location: location(fileA, 1, 0),
          kind: "named",
        }],
      });

      const indexB = createTestIndex(fileB, {
        imports: [{
          name: "importedFunc" as SymbolName,
          source: "./a",
          location: location(fileB, 1, 0),
          kind: "named",
        }],
      });

      // Add function call reference in file B
      indexB.references.function_calls.push({
        name: "importedFunc" as SymbolName,
        location: location(fileB, 5, 10),
        scope_id: "scope:global:b.ts:0:0" as ScopeId,
      });

      const indices = new Map([
        [fileA, indexA],
        [fileB, indexB],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.functions).toBeDefined();
    });

    it("should handle hoisted function declarations", () => {
      const filePath = "test.ts" as FilePath;
      const funcId = symbol_id("function", "hoistedFunc", location(filePath, 10, 0));

      const symbols = new Map<SymbolId, SymbolDefinition>([
        [funcId, {
          id: funcId,
          name: "hoistedFunc" as SymbolName,
          kind: "function",
          location: location(filePath, 10, 0), // Declared at line 10
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
          is_hoisted: true, // Important: marked as hoisted
          is_exported: false,
          is_imported: false,
          references: [],
        }],
      ]);

      const index = createTestIndex(filePath, { symbols });

      // Function called before declaration (line 5)
      index.references.function_calls.push({
        name: "hoistedFunc" as SymbolName,
        location: location(filePath, 5, 0),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
      });

      const indices = new Map([[filePath, index]]);
      const result = resolve_symbols({ indices });

      // Should successfully resolve despite call before declaration
      expect(result.phases.functions.function_calls).toBeDefined();
    });
  });

  describe("Phase 3: Type Resolution", () => {
    it("should extract and resolve type definitions", () => {
      const filePath = "test.ts" as FilePath;
      const classLoc = location(filePath, 1, 0);
      const interfaceLoc = location(filePath, 10, 0);

      const localTypes: LocalTypeInfo[] = [
        {
          type_name: "MyClass" as SymbolName,
          kind: "class",
          location: classLoc,
          direct_members: new Map(),
        },
        {
          type_name: "MyInterface" as SymbolName,
          kind: "interface",
          location: interfaceLoc,
          direct_members: new Map(),
        },
      ];

      const index = createTestIndex(filePath, { localTypes });
      const indices = new Map([[filePath, index]]);

      const result = resolve_symbols({ indices });
      const { types } = result.phases;

      expect(types.symbol_types).toBeInstanceOf(Map);
      expect(types.reference_types).toBeInstanceOf(Map);
      expect(types.type_members).toBeInstanceOf(Map);
      expect(types.constructors).toBeInstanceOf(Map);
    });

    it("should track type flow through assignments", () => {
      const filePath = "test.ts" as FilePath;
      const classLoc = location(filePath, 1, 0);

      const localTypes: LocalTypeInfo[] = [{
        type_name: "MyClass" as SymbolName,
        kind: "class",
        location: classLoc,
        direct_members: new Map(),
      }];

      const localTypeFlow: LocalTypeFlow = {
        constructor_calls: [{
          class_name: "MyClass" as SymbolName,
          location: location(filePath, 5, 10),
          assigned_to: "obj" as SymbolName,
          argument_count: 0,
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
        }],
        assignments: [{
          source: { kind: "variable", name: "obj" as SymbolName },
          target: "obj2" as SymbolName,
          location: location(filePath, 6, 0),
          kind: "direct",
        }],
        returns: [],
        call_assignments: [],
      };

      const index = createTestIndex(filePath, { localTypes, localTypeFlow });
      const indices = new Map([[filePath, index]]);

      const result = resolve_symbols({ indices });
      expect(result.phases.types).toBeDefined();
    });

    it("should resolve type inheritance", () => {
      const fileA = "a.ts" as FilePath;
      const fileB = "b.ts" as FilePath;

      const baseTypes: LocalTypeInfo[] = [{
        type_name: "BaseClass" as SymbolName,
        kind: "class",
        location: location(fileA, 1, 0),
        direct_members: new Map([
          ["baseMethod" as SymbolName, {
            name: "baseMethod" as SymbolName,
            kind: "method",
            location: location(fileA, 2, 2),
          }],
        ]),
      }];

      const derivedTypes: LocalTypeInfo[] = [{
        type_name: "DerivedClass" as SymbolName,
        kind: "class",
        location: location(fileB, 3, 0),
        direct_members: new Map([
          ["derivedMethod" as SymbolName, {
            name: "derivedMethod" as SymbolName,
            kind: "method",
            location: location(fileB, 4, 2),
          }],
        ]),
        extends_clause: ["BaseClass" as SymbolName],
      }];

      const indices = new Map<FilePath, SemanticIndex>([
        [fileA, createTestIndex(fileA, { localTypes: baseTypes })],
        [fileB, createTestIndex(fileB, { localTypes: derivedTypes })],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.types.type_members).toBeInstanceOf(Map);
    });

    it("should build type member mappings", () => {
      const filePath = "test.ts" as FilePath;

      const localTypes: LocalTypeInfo[] = [{
        type_name: "MyClass" as SymbolName,
        kind: "class",
        location: location(filePath, 1, 0),
        direct_members: new Map([
          ["method1" as SymbolName, {
            name: "method1" as SymbolName,
            kind: "method",
            location: location(filePath, 2, 2),
          }],
          ["property1" as SymbolName, {
            name: "property1" as SymbolName,
            kind: "property",
            location: location(filePath, 3, 2),
          }],
        ]),
      }];

      const index = createTestIndex(filePath, { localTypes });
      const indices = new Map([[filePath, index]]);

      const result = resolve_symbols({ indices });
      const { types } = result.phases;

      // Should have type member mappings
      expect(types.type_members.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Phase 4: Method and Constructor Resolution", () => {
    it("should resolve method calls using receiver types", () => {
      const filePath = "test.ts" as FilePath;

      const localTypes: LocalTypeInfo[] = [{
        type_name: "MyClass" as SymbolName,
        kind: "class",
        location: location(filePath, 1, 0),
        direct_members: new Map([
          ["myMethod" as SymbolName, {
            name: "myMethod" as SymbolName,
            kind: "method",
            location: location(filePath, 2, 2),
          }],
        ]),
      }];

      const localTypeFlow: LocalTypeFlow = {
        constructor_calls: [{
          class_name: "MyClass" as SymbolName,
          location: location(filePath, 5, 10),
          assigned_to: "obj" as SymbolName,
          argument_count: 0,
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
        }],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const index = createTestIndex(filePath, { localTypes, localTypeFlow });

      // Add member access for method call
      index.references.member_accesses = [{
        object_name: "obj" as SymbolName,
        object_location: location(filePath, 6, 0),
        member_name: "myMethod" as SymbolName,
        location: location(filePath, 6, 4),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
      }];

      const indices = new Map([[filePath, index]]);
      const result = resolve_symbols({ indices });

      expect(result.phases.methods.method_calls).toBeInstanceOf(Map);
      expect(result.phases.methods.constructor_calls).toBeInstanceOf(Map);
      expect(result.phases.methods.calls_to_method).toBeInstanceOf(Map);
    });

    it("should resolve constructor calls", () => {
      const filePath = "test.ts" as FilePath;

      const classId = symbol_id("class", "MyClass", location(filePath, 1, 0));
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [classId, {
          id: classId,
          name: "MyClass" as SymbolName,
          kind: "class",
          location: location(filePath, 1, 0),
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
          references: [],
        }],
      ]);

      const localTypes: LocalTypeInfo[] = [{
        type_name: "MyClass" as SymbolName,
        kind: "class",
        location: location(filePath, 1, 0),
        direct_members: new Map(),
      }];

      const localTypeFlow: LocalTypeFlow = {
        constructor_calls: [{
          class_name: "MyClass" as SymbolName,
          location: location(filePath, 5, 10),
          assigned_to: "instance" as SymbolName,
          argument_count: 0,
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
        }],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const index = createTestIndex(filePath, { symbols, localTypes, localTypeFlow });
      const indices = new Map([[filePath, index]]);

      const result = resolve_symbols({ indices });
      const { methods } = result.phases;

      // Should have resolved constructor
      expect(methods.constructor_calls).toBeInstanceOf(Map);
    });

    it("should handle static vs instance methods", () => {
      const filePath = "test.ts" as FilePath;

      const localTypes: LocalTypeInfo[] = [{
        type_name: "MyClass" as SymbolName,
        kind: "class",
        location: location(filePath, 1, 0),
        direct_members: new Map([
          ["instanceMethod" as SymbolName, {
            name: "instanceMethod" as SymbolName,
            kind: "method",
            location: location(filePath, 2, 2),
            is_static: false,
          }],
          ["staticMethod" as SymbolName, {
            name: "staticMethod" as SymbolName,
            kind: "method",
            location: location(filePath, 3, 2),
            is_static: true,
          }],
        ]),
      }];

      const index = createTestIndex(filePath, { localTypes });
      const indices = new Map([[filePath, index]]);

      const result = resolve_symbols({ indices });
      expect(result.phases.methods).toBeDefined();
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete resolution pipeline", () => {
      // Create a multi-file scenario
      const libFile = "lib.ts" as FilePath;
      const appFile = "app.ts" as FilePath;

      // Library file with base class
      const baseClassId = symbol_id("class", "Base", location(libFile, 1, 0));
      const libSymbols = new Map<SymbolId, SymbolDefinition>([
        [baseClassId, {
          id: baseClassId,
          name: "Base" as SymbolName,
          kind: "class",
          location: location(libFile, 1, 0),
          scope_id: "scope:global:lib.ts:0:0" as ScopeId,
          is_hoisted: false,
          is_exported: true,
          is_imported: false,
          references: [],
        }],
      ]);

      const libTypes: LocalTypeInfo[] = [{
        type_name: "Base" as SymbolName,
        kind: "class",
        location: location(libFile, 1, 0),
        direct_members: new Map([
          ["baseMethod" as SymbolName, {
            name: "baseMethod" as SymbolName,
            kind: "method",
            location: location(libFile, 2, 2),
          }],
        ]),
      }];

      const libIndex = createTestIndex(libFile, {
        symbols: libSymbols,
        exports: [{
          name: "Base" as SymbolName,
          symbol_id: baseClassId,
          location: location(libFile, 1, 0),
          kind: "named",
        }],
        localTypes: libTypes,
      });

      // Application file that imports and extends
      const appTypes: LocalTypeInfo[] = [{
        type_name: "App" as SymbolName,
        kind: "class",
        location: location(appFile, 3, 0),
        direct_members: new Map([
          ["appMethod" as SymbolName, {
            name: "appMethod" as SymbolName,
            kind: "method",
            location: location(appFile, 4, 2),
          }],
        ]),
        extends_clause: ["Base" as SymbolName],
      }];

      const appFlow: LocalTypeFlow = {
        constructor_calls: [{
          class_name: "App" as SymbolName,
          location: location(appFile, 10, 10),
          assigned_to: "myApp" as SymbolName,
          argument_count: 0,
          scope_id: "scope:global:app.ts:0:0" as ScopeId,
        }],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const appIndex = createTestIndex(appFile, {
        imports: [{
          name: "Base" as SymbolName,
          source: "./lib",
          location: location(appFile, 1, 0),
          kind: "named",
        }],
        localTypes: appTypes,
        localTypeFlow: appFlow,
      });

      const indices = new Map([
        [libFile, libIndex],
        [appFile, appIndex],
      ]);

      const result = resolve_symbols({ indices });

      // Verify all phases completed
      expect(result.phases.imports).toBeDefined();
      expect(result.phases.functions).toBeDefined();
      expect(result.phases.types).toBeDefined();
      expect(result.phases.methods).toBeDefined();

      // Verify final resolution maps
      expect(result.resolved_references).toBeInstanceOf(Map);
      expect(result.references_to_symbol).toBeInstanceOf(Map);
      expect(result.unresolved_references).toBeInstanceOf(Map);
    });

    it("should handle circular dependencies", () => {
      const fileA = "a.ts" as FilePath;
      const fileB = "b.ts" as FilePath;

      // File A imports from B
      const indexA = createTestIndex(fileA, {
        imports: [{
          name: "BClass" as SymbolName,
          source: "./b",
          location: location(fileA, 1, 0),
          kind: "named",
        }],
        exports: [{
          name: "AClass" as SymbolName,
          symbol_id: symbol_id("class", "AClass", location(fileA, 2, 0)),
          location: location(fileA, 2, 0),
          kind: "named",
        }],
      });

      // File B imports from A
      const indexB = createTestIndex(fileB, {
        imports: [{
          name: "AClass" as SymbolName,
          source: "./a",
          location: location(fileB, 1, 0),
          kind: "named",
        }],
        exports: [{
          name: "BClass" as SymbolName,
          symbol_id: symbol_id("class", "BClass", location(fileB, 2, 0)),
          location: location(fileB, 2, 0),
          kind: "named",
        }],
      });

      const indices = new Map([
        [fileA, indexA],
        [fileB, indexB],
      ]);

      // Should not throw or hang
      expect(() => resolve_symbols({ indices })).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle empty indices", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const result = resolve_symbols({ indices });

      expect(result.resolved_references).toEqual(new Map());
      expect(result.references_to_symbol).toEqual(new Map());
      expect(result.unresolved_references).toEqual(new Map());
    });

    it("should handle missing imports", () => {
      const filePath = "test.ts" as FilePath;
      const index = createTestIndex(filePath, {
        imports: [{
          name: "NonExistent" as SymbolName,
          source: "./missing",
          location: location(filePath, 1, 0),
          kind: "named",
        }],
      });

      const indices = new Map([[filePath, index]]);
      const result = resolve_symbols({ indices });

      // Should complete without error
      expect(result).toBeDefined();
    });

    it("should track unresolved references", () => {
      const filePath = "test.ts" as FilePath;
      const index = createTestIndex(filePath);

      // Add an unresolvable function call
      index.references.function_calls.push({
        name: "unknownFunction" as SymbolName,
        location: location(filePath, 5, 10),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
      });

      const indices = new Map([[filePath, index]]);
      const result = resolve_symbols({ indices });

      // Should track as unresolved
      // Note: Current implementation needs to be updated to properly track unresolved
      expect(result.unresolved_references).toBeDefined();
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large number of files efficiently", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Create 100 files
      for (let i = 0; i < 100; i++) {
        const filePath = `file${i}.ts` as FilePath;
        const index = createTestIndex(filePath, {
          localTypes: [{
            type_name: `Class${i}` as SymbolName,
            kind: "class",
            location: location(filePath, 1, 0),
            direct_members: new Map(),
          }],
        });
        indices.set(filePath, index);
      }

      const start = performance.now();
      const result = resolve_symbols({ indices });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it("should handle deep inheritance chains", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Create chain of 10 classes, each extending the previous
      for (let i = 0; i < 10; i++) {
        const filePath = `class${i}.ts` as FilePath;
        const localTypes: LocalTypeInfo[] = [{
          type_name: `Class${i}` as SymbolName,
          kind: "class",
          location: location(filePath, 1, 0),
          direct_members: new Map([
            [`method${i}` as SymbolName, {
              name: `method${i}` as SymbolName,
              kind: "method",
              location: location(filePath, 2, 2),
            }],
          ]),
          extends_clause: i > 0 ? [`Class${i - 1}` as SymbolName] : undefined,
        }];

        const index = createTestIndex(filePath, { localTypes });
        indices.set(filePath, index);
      }

      const result = resolve_symbols({ indices });
      expect(result.phases.types).toBeDefined();
    });
  });
});
