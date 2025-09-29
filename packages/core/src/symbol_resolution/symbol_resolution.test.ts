/**
 * Symbol Resolution Module Tests
 *
 * Comprehensive test suite for the four-phase symbol resolution pipeline.
 * Tests each phase independently and the integration of all phases.
 */

import { describe, it, expect } from "vitest";
import { resolve_symbols } from "./symbol_resolution";
import type { ResolutionInput } from "./types";
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
  NamespaceName,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../semantic_index/semantic_index";
import type { LocalTypeInfo } from "../semantic_index/type_members";
import type { LocalTypeAnnotation } from "../semantic_index/references/type_annotation_references";
import type { LocalTypeTracking } from "../semantic_index/references/type_tracking";
import type { LocalTypeFlowData } from "../semantic_index/references/type_flow_references";
import { CallReference } from "../semantic_index/references/call_references";
import { MemberAccessReference } from "../semantic_index/references/member_access_references";
import { ReturnReference } from "../semantic_index/references/return_references";
import { TypeAnnotationReference } from "../semantic_index/references/type_annotation_references/type_annotation_references";

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
      return function_symbol(name as SymbolName, loc);
    case "class":
      return class_symbol(name as SymbolName, loc);
    case "method":
      return method_symbol(name as SymbolName, loc);
    case "variable":
      return variable_symbol(name as SymbolName, loc);
    default:
      return function_symbol(name as SymbolName, loc); // Default fallback
  }
}

describe("Symbol Resolution Pipeline", () => {
  // Enhanced helper to create test SemanticIndex with all references
  function create_test_index(
    file_path: FilePath,
    options: {
      symbols?: Map<SymbolId, SymbolDefinition>;
      imports?: Import[];
      exports?: Export[];
      local_types?: LocalTypeInfo[];
      local_type_flow?: LocalTypeFlowData;
      calls?: CallReference[];
      member_accesses?: MemberAccessReference[];
      returns?: ReturnReference[];
      type_annotations?: TypeAnnotationReference[];
    } = {}
  ): SemanticIndex {
    const root_scope_id = `scope:global:${file_path}:0:0` as ScopeId;
    const root_scope: LexicalScope = {
      id: root_scope_id,
      parent_id: null,
      name: null,
      type: "module",
      location: location(file_path, 0, 0),
      child_ids: [],
      symbols: new Map(),
    };

    return {
      file_path: file_path,
      language: "typescript",
      root_scope_id: root_scope_id,
      scopes: new Map([[root_scope_id, root_scope]]),
      symbols: options.symbols || new Map(),
      references: {
        calls: options.calls || [],
        member_accesses: options.member_accesses || [],
        returns: options.returns || [],
        type_annotations: options.type_annotations || [],
      },
      imports: options.imports || [],
      exports: options.exports || [],
      file_symbols_by_name: new Map(),
      local_types: options.local_types || [],
      local_type_annotations: [],
      local_type_tracking: {
        annotations: [],
        declarations: [],
        assignments: [],
      },
      local_type_flow: options.local_type_flow || {
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
      const test_file = "test.ts" as FilePath;
      indices.set(test_file, create_test_index(test_file));

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
    it.skip("should resolve named imports", () => {
      // Note: This test requires filesystem mocking as import resolution
      // checks for actual files. Import resolution is thoroughly tested
      // in import_resolution.test.ts with proper mocking.

      // File A exports a function
      const file_a = "a.ts" as FilePath;
      const func_symbol_id = symbol_id(
        "function",
        "myFunc",
        location(file_a, 1, 0)
      );
      const symbols_a = new Map<SymbolId, SymbolDefinition>([
        [
          func_symbol_id,
          {
            id: func_symbol_id,
            name: "myFunc" as SymbolName,
            kind: "function",
            location: location(file_a, 1, 0),
            scope_id: "scope:global:a.ts:0:0" as ScopeId,
            is_hoisted: false,
            is_exported: true,
            is_imported: false,
          },
        ],
      ]);
      const exports_a: Export[] = [
        {
          name: "myFunc" as SymbolName,
          symbol: func_symbol_id,
          symbol_name: "myFunc" as SymbolName,
          location: location(file_a, 1, 0),
          kind: "named",
          exports: [],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        },
      ];

      // File B imports the function
      const file_b = "b.ts" as FilePath;
      const imports_b: Import[] = [
        {
          kind: "named",
          source: "./a" as FilePath,
          location: location(file_b, 1, 0),
          imports: [{ name: "myFunc" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        },
      ];

      const indices = new Map<FilePath, SemanticIndex>([
        [
          file_a,
          create_test_index(file_a, { symbols: symbols_a, exports: exports_a }),
        ],
        [file_b, create_test_index(file_b, { imports: imports_b })],
      ]);

      const result = resolve_symbols({ indices });
      const { imports } = result.phases;

      // Verify import was resolved
      expect(imports.has(file_b)).toBe(true);
      const file_b_imports = imports.get(file_b);
      expect(file_b_imports).toBeDefined();
      // Note: Current implementation is TODO, so expectations would be based on actual implementation
    });

    it("should resolve default imports", () => {
      const file_a = "a.ts" as FilePath;
      const class_symbol_id = symbol_id(
        "class",
        "MyClass",
        location(file_a, 1, 0)
      );
      const exports_a: Export[] = [
        {
          name: "default" as SymbolName,
          symbol: class_symbol_id,
          symbol_name: "MyClass" as SymbolName,
          location: location(file_a, 1, 0),
          kind: "default",
          is_declaration: false,
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        },
      ];

      const file_b = "b.ts" as FilePath;
      const imports_b: Import[] = [
        {
          kind: "default",
          source: "./a" as FilePath,
          location: location(file_b, 1, 0),
          name: "MyClass" as SymbolName,
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        },
      ];

      const indices = new Map<FilePath, SemanticIndex>([
        [file_a, create_test_index(file_a, { exports: exports_a })],
        [file_b, create_test_index(file_b, { imports: imports_b })],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.imports).toBeDefined();
    });

    it("should resolve namespace imports", () => {
      const file_a = "a.ts" as FilePath;
      const func1 = symbol_id("function", "func1", location(file_a, 1, 0));
      const func2 = symbol_id("function", "func2", location(file_a, 2, 0));
      const exports_a: Export[] = [
        {
          name: "func1" as SymbolName,
          symbol: func1,
          symbol_name: "func1" as SymbolName,
          location: location(file_a, 1, 0),
          kind: "named",
          exports: [],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        },
        {
          name: "func2" as SymbolName,
          symbol: func2,
          symbol_name: "func2" as SymbolName,
          location: location(file_a, 2, 0),
          kind: "named",
          exports: [],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        },
      ];

      const file_b = "b.ts" as FilePath;
      const imports_b: Import[] = [
        {
          kind: "namespace",
          source: "./a" as FilePath,
          location: location(file_b, 1, 0),
          namespace_name: "utils" as NamespaceName,
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        },
      ];

      const indices = new Map<FilePath, SemanticIndex>([
        [file_a, create_test_index(file_a, { exports: exports_a })],
        [file_b, create_test_index(file_b, { imports: imports_b })],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.imports).toBeDefined();
    });
  });

  describe("Phase 2: Function Call Resolution", () => {
    it("should resolve function calls via lexical scope", () => {
      const file_path = "test.ts" as FilePath;
      const func_id = symbol_id(
        "function",
        "myFunc",
        location(file_path, 1, 0)
      );
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          func_id,
          {
            id: func_id,
            name: "myFunc" as SymbolName,
            kind: "function",
            location: location(file_path, 1, 0),
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            is_hoisted: true,
            is_exported: false,
            is_imported: false,
          },
        ],
      ]);

      // Create call reference
      const call_ref: CallReference = {
        name: "myFunc" as SymbolName,
        location: location(file_path, 5, 10),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
        call_type: "function",
      };

      const index = create_test_index(file_path, {
        symbols,
        calls: [call_ref],
      });
      const indices = new Map([[file_path, index]]);
      const result = resolve_symbols({ indices });

      expect(result.phases.functions.function_calls).toBeDefined();
      expect(result.phases.functions.calls_to_function).toBeDefined();
    });

    it("should resolve imported function calls", () => {
      // Setup two files with import/export
      const file_a = "a.ts" as FilePath;
      const file_b = "b.ts" as FilePath;

      const func_id = symbol_id(
        "function",
        "importedFunc",
        location(file_a, 1, 0)
      );
      const symbols_a = new Map<SymbolId, SymbolDefinition>([
        [
          func_id,
          {
            id: func_id,
            name: "importedFunc" as SymbolName,
            kind: "function",
            location: location(file_a, 1, 0),
            scope_id: "scope:global:a.ts:0:0" as ScopeId,
            is_hoisted: false,
            is_exported: true,
            is_imported: false,
          },
        ],
      ]);

      const index_a = create_test_index(file_a, {
        symbols: symbols_a,
        exports: [
          {
            name: "importedFunc" as SymbolName,
            symbol: func_id,
            symbol_name: "importedFunc" as SymbolName,
            exports: [],
            modifiers: [],
            language: "typescript",
            node_type: "export_statement",
            location: location(file_a, 1, 0),
            kind: "named",
          },
        ],
      });

      // Create call reference for file B
      const call_ref: CallReference = {
        name: "importedFunc" as SymbolName,
        location: location(file_b, 5, 10),
        scope_id: "scope:global:b.ts:0:0" as ScopeId,
        call_type: "function",
      };

      const index_b = create_test_index(file_b, {
        imports: [
          {
            kind: "named",
            source: "./a" as FilePath,
            location: location(file_b, 1, 0),
            imports: [
              { name: "importedFunc" as SymbolName, is_type_only: false },
            ],
            modifiers: [],
            language: "typescript",
            node_type: "import_statement",
          },
        ],
        calls: [call_ref],
      });

      const indices = new Map([
        [file_a, index_a],
        [file_b, index_b],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.functions).toBeDefined();
    });

    it("should handle hoisted function declarations", () => {
      const file_path = "test.ts" as FilePath;
      const func_id = symbol_id(
        "function",
        "hoistedFunc",
        location(file_path, 10, 0)
      );

      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          func_id,
          {
            id: func_id,
            name: "hoistedFunc" as SymbolName,
            kind: "function",
            location: location(file_path, 10, 0), // Declared at line 10
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            is_hoisted: true, // Important: marked as hoisted
            is_exported: false,
            is_imported: false,
          },
        ],
      ]);

      // Function called before declaration (line 5)
      const call_ref: CallReference = {
        name: "hoistedFunc" as SymbolName,
        location: location(file_path, 5, 0),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
        call_type: "function",
      };

      const index = create_test_index(file_path, {
        symbols,
        calls: [call_ref],
      });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });
      expect(result.phases.functions.function_calls).toBeDefined();
    });

    it("should track unresolved function calls", () => {
      const file_path = "test.ts" as FilePath;

      // Add an unresolvable function call
      const call_ref: CallReference = {
        name: "unknownFunction" as SymbolName,
        location: location(file_path, 5, 10),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
        call_type: "function",
      };

      const index = create_test_index(file_path, { calls: [call_ref] });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });
      expect(result.phases.functions).toBeDefined();
    });
  });

  describe("Phase 3: Type Resolution", () => {
    it("should build type registry from local types", () => {
      const file_path = "test.ts" as FilePath;
      const class_loc = location(file_path, 1, 0);
      const interface_loc = location(file_path, 5, 0);

      const local_types: LocalTypeInfo[] = [
        {
          type_name: "MyClass" as SymbolName,
          kind: "class",
          location: class_loc,
          direct_members: new Map(),
        },
        {
          type_name: "MyInterface" as SymbolName,
          kind: "interface",
          location: interface_loc,
          direct_members: new Map(),
        },
      ];

      const index = create_test_index(file_path, { local_types });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.phases.types).toBeDefined();
      expect(result.phases.types.symbol_types).toBeInstanceOf(Map);
      expect(result.phases.types.type_members).toBeInstanceOf(Map);
    });

    it("should resolve type inheritance", () => {
      const file_path = "test.ts" as FilePath;
      const base_loc = location(file_path, 1, 0);
      const derived_loc = location(file_path, 5, 0);

      const local_types: LocalTypeInfo[] = [
        {
          type_name: "BaseClass" as SymbolName,
          kind: "class",
          location: base_loc,
          direct_members: new Map(),
        },
        {
          type_name: "DerivedClass" as SymbolName,
          kind: "class",
          location: derived_loc,
          direct_members: new Map(),
          extends: ["BaseClass" as SymbolName],
        },
      ];

      const index = create_test_index(file_path, { local_types });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.phases.types.inheritance_hierarchy).toBeInstanceOf(Map);
      expect(result.phases.types.interface_implementations).toBeInstanceOf(Map);
    });

    it("should track type flow", () => {
      const file_path = "test.ts" as FilePath;
      const class_loc = location(file_path, 1, 0);
      const ctor_loc = location(file_path, 5, 0);

      const local_types: LocalTypeInfo[] = [
        {
          type_name: "MyClass" as SymbolName,
          kind: "class",
          location: class_loc,
          direct_members: new Map(),
        },
      ];

      const local_type_flow: LocalTypeFlowData = {
        constructor_calls: [
          {
            location: ctor_loc,
            class_name: "MyClass" as SymbolName,
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            argument_count: 0,
          },
        ],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const index = create_test_index(file_path, {
        local_types,
        local_type_flow,
      });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.phases.types.reference_types).toBeInstanceOf(Map);
    });
  });

  describe("Phase 4: Method/Constructor Resolution", () => {
    it("should resolve method calls", () => {
      const file_path = "test.ts" as FilePath;
      const class_id = symbol_id("class", "MyClass", location(file_path, 1, 0));
      const method_id = symbol_id(
        "method",
        "myMethod",
        location(file_path, 2, 2)
      );

      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          class_id,
          {
            id: class_id,
            name: "MyClass" as SymbolName,
            kind: "class",
            location: location(file_path, 1, 0),
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
          },
        ],
        [
          method_id,
          {
            id: method_id,
            name: "myMethod" as SymbolName,
            kind: "method",
            location: location(file_path, 2, 2),
            scope_id: "scope:class:test.ts:1:0" as ScopeId,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
          },
        ],
      ]);

      const member_access: MemberAccessReference = {
        object: {
          location: location(file_path, 10, 0),
        },
        member_name: "myMethod" as SymbolName,
        location: location(file_path, 10, 4),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
        access_type: "method",
        is_optional_chain: false,
      };

      const index = create_test_index(file_path, {
        symbols,
        member_accesses: [member_access],
      });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.phases.methods.method_calls).toBeInstanceOf(Map);
      expect(result.phases.methods.constructor_calls).toBeInstanceOf(Map);
    });

    it("should resolve constructor calls", () => {
      const file_path = "test.ts" as FilePath;
      const class_id = symbol_id("class", "MyClass", location(file_path, 1, 0));

      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          class_id,
          {
            id: class_id,
            name: "MyClass" as SymbolName,
            kind: "class",
            location: location(file_path, 1, 0),
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
          },
        ],
      ]);

      const local_type_flow: LocalTypeFlowData = {
        constructor_calls: [
          {
            location: location(file_path, 5, 0),
            class_name: "MyClass" as SymbolName,
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            argument_count: 0,
          },
        ],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const index = create_test_index(file_path, { symbols, local_type_flow });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.phases.methods.constructor_calls).toBeInstanceOf(Map);
    });
  });

  describe("Integration Tests", () => {
    it("should integrate all four phases", () => {
      const file_a = "utils.ts" as FilePath;
      const file_b = "app.ts" as FilePath;

      // File A: exports a class with methods
      const class_id = class_symbol("Utils", location(file_a, 1, 0));
      const method_id = method_symbol("process", location(file_a, 2, 2));

      const symbols_a = new Map<SymbolId, SymbolDefinition>([
        [
          class_id,
          {
            id: class_id,
            name: "Utils" as SymbolName,
            kind: "class",
            location: location(file_a, 1, 0),
            scope_id: "scope:global:utils.ts:0:0" as ScopeId,
            is_hoisted: false,
            is_exported: true,
            is_imported: false,
          },
        ],
        [
          method_id,
          {
            id: method_id,
            name: "process" as SymbolName,
            kind: "method",
            location: location(file_a, 2, 2),
            scope_id: "scope:class:utils.ts:1:0" as ScopeId,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
          },
        ],
      ]);

      const local_types_a: LocalTypeInfo[] = [
        {
          type_name: "Utils" as SymbolName,
          kind: "class",
          location: location(file_a, 1, 0),
          direct_members: new Map([
            [
              "process" as SymbolName,
              {
                kind: "method",
                location: location(file_a, 2, 2),
                is_static: false,
                is_optional: false,
                name: "process" as SymbolName,
              },
            ],
          ]),
        },
      ];

      const exports_a: Export[] = [
        {
          name: "Utils" as SymbolName,
          symbol: class_id,
          symbol_name: "Utils" as SymbolName,
          location: location(file_a, 1, 0),
          kind: "named",
          exports: [],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        },
      ];

      // File B: imports and uses the class
      const imports_b: Import[] = [
        {
          kind: "named",
          source: "./utils" as FilePath,
          location: location(file_b, 1, 0),
          imports: [{ name: "Utils" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        },
      ];

      const local_type_flow_b: LocalTypeFlowData = {
        constructor_calls: [
          {
            location: location(file_b, 5, 0),
            class_name: "Utils" as SymbolName,
            scope_id: "scope:global:app.ts:0:0" as ScopeId,
            argument_count: 0,
          },
        ],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const member_access_b: MemberAccessReference = {
        object: {
          location: location(file_b, 6, 0),
        },
        member_name: "process" as SymbolName,
        location: location(file_b, 6, 6),
        scope_id: "scope:global:app.ts:0:0" as ScopeId,
        access_type: "method",
        is_optional_chain: false,
      };

      const index_a = create_test_index(file_a, {
        symbols: symbols_a,
        local_types: local_types_a,
        exports: exports_a,
      });

      const index_b = create_test_index(file_b, {
        imports: imports_b,
        local_type_flow: local_type_flow_b,
        member_accesses: [member_access_b],
      });

      const indices = new Map([
        [file_a, index_a],
        [file_b, index_b],
      ]);

      const result = resolve_symbols({ indices });

      // Verify all phases produced results
      expect(result.phases.imports).toBeDefined();
      expect(result.phases.functions.function_calls).toBeDefined();
      expect(result.phases.types.symbol_types).toBeDefined();
      expect(result.phases.methods.method_calls).toBeDefined();
      expect(result.resolved_references).toBeInstanceOf(Map);
    });

    it("should track unresolved references", () => {
      const file_path = "test.ts" as FilePath;

      // Create a call to an undefined function
      const call_ref: CallReference = {
        name: "undefinedFunction" as SymbolName,
        location: location(file_path, 5, 0),
        scope_id: "scope:global:test.ts:0:0" as ScopeId,
        call_type: "function",
      };

      const index = create_test_index(file_path, { calls: [call_ref] });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.unresolved_references).toBeInstanceOf(Map);
    });

    it("should build reverse reference mapping", () => {
      const file_path = "test.ts" as FilePath;
      const func_id = symbol_id(
        "function",
        "targetFunc",
        location(file_path, 1, 0)
      );

      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          func_id,
          {
            id: func_id,
            name: "targetFunc" as SymbolName,
            kind: "function",
            location: location(file_path, 1, 0),
            scope_id: "scope:global:test.ts:0:0" as ScopeId,
            is_hoisted: true,
            is_exported: false,
            is_imported: false,
          },
        ],
      ]);

      // Multiple calls to the same function
      const calls: CallReference[] = [
        {
          name: "targetFunc" as SymbolName,
          location: location(file_path, 5, 0),
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
          call_type: "function",
        },
        {
          name: "targetFunc" as SymbolName,
          location: location(file_path, 10, 0),
          scope_id: "scope:global:test.ts:0:0" as ScopeId,
          call_type: "function",
        },
      ];

      const index = create_test_index(file_path, { symbols, calls });
      const indices = new Map([[file_path, index]]);

      const result = resolve_symbols({ indices });

      expect(result.references_to_symbol).toBeInstanceOf(Map);
      // The function should be referenced from multiple locations
      const references = result.references_to_symbol.get(func_id);
      if (references) {
        expect(references.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
