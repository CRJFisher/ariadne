import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Location,
  ScopeId,
  CallReference,
  SymbolDefinition,
  LexicalScope,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { ImportResolutionMap } from "../types";
import type { FunctionResolutionContext } from "./function_types";
import {
  try_lexical_resolution,
  try_imported_resolution,
  try_global_resolution,
  try_builtin_resolution,
} from "./resolution_priority";

// Helper to create a mock call reference
function create_call_ref(
  name: SymbolName,
  file_path: FilePath,
  line: number,
  scope_id: ScopeId
): CallReference {
  return {
    location: {
      file_path,
      line,
      column: 5,
      end_line: line,
      end_column: 10,
    },
    name,
    scope_id,
    call_type: "function",
  };
}

// Helper to create a minimal function definition
function create_function_def(
  id: SymbolId,
  name: SymbolName,
  scope_id: ScopeId,
  file_path: FilePath,
  line: number
): SymbolDefinition {
  return {
    id,
    name,
    kind: "function",
    location: {
      file_path,
      line,
      column: 10,
      end_line: line,
      end_column: 20,
    },
    scope_id,
  };
}

// Helper to create a scope
function create_scope(
  id: ScopeId,
  parent_id: ScopeId | null,
  symbols: Map<SymbolName, SymbolDefinition>
): LexicalScope {
  return {
    id,
    parent_id,
    name: null,
    type: parent_id === null ? "module" : "function",
    location: {
      file_path: "test.js" as FilePath,
      line: 1,
      column: 1,
      end_line: 20,
      end_column: 1,
    },
    child_ids: [],
    symbols,
  };
}

describe("Resolution Priority Functions", () => {
  describe("try_lexical_resolution", () => {
    it("should resolve function in current scope", () => {
      const file_path = "test.js" as FilePath;
      const funcDef = create_function_def(
        "sym:localFunc" as SymbolId,
        "localFunc" as SymbolName,
        "scope:module" as ScopeId,
        file_path,
        1
      );

      const scope = create_scope(
        "scope:module" as ScopeId,
        null,
        new Map([["localFunc" as SymbolName, funcDef]])
      );

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map([["scope:module" as ScopeId, scope]]),
        symbols: new Map([["sym:localFunc" as SymbolId, funcDef]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "localFunc" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      const result = try_lexical_resolution("localFunc" as SymbolName, call_ref, context);

      expect(result).not.toBeNull();
      expect(result?.resolved_function).toBe("sym:localFunc" as SymbolId);
      expect(result?.resolution_method).toBe("lexical");
    });

    it("should resolve function in parent scope", () => {
      const file_path = "test.js" as FilePath;
      const funcDef = create_function_def(
        "sym:parentFunc" as SymbolId,
        "parentFunc" as SymbolName,
        "scope:module" as ScopeId,
        file_path,
        1
      );

      const moduleScope = create_scope(
        "scope:module" as ScopeId,
        null,
        new Map([["parentFunc" as SymbolName, funcDef]])
      );

      const childScope = create_scope("scope:child" as ScopeId, "scope:module" as ScopeId, new Map());

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map([
          ["scope:module" as ScopeId, moduleScope],
          ["scope:child" as ScopeId, childScope],
        ]),
        symbols: new Map([["sym:parentFunc" as SymbolId, funcDef]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "parentFunc" as SymbolName,
        file_path,
        5,
        "scope:child" as ScopeId
      );

      const result = try_lexical_resolution("parentFunc" as SymbolName, call_ref, context);

      expect(result).not.toBeNull();
      expect(result?.resolved_function).toBe("sym:parentFunc" as SymbolId);
    });

    it("should not resolve non-function symbols", () => {
      const file_path = "test.js" as FilePath;
      const varDef: SymbolDefinition = {
        id: "sym:myVar" as SymbolId,
        name: "myVar" as SymbolName,
        kind: "variable",
        location: {
          file_path,
          line: 1,
          column: 10,
          end_line: 1,
          end_column: 15,
        },
        scope_id: "scope:module" as ScopeId,
      };

      const scope = create_scope(
        "scope:module" as ScopeId,
        null,
        new Map([["myVar" as SymbolName, varDef]])
      );

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map([["scope:module" as ScopeId, scope]]),
        symbols: new Map([["sym:myVar" as SymbolId, varDef]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref("myVar" as SymbolName, file_path, 5, "scope:module" as ScopeId);

      const result = try_lexical_resolution("myVar" as SymbolName, call_ref, context);

      expect(result).toBeNull();
    });

    it("should return null for missing scope", () => {
      const file_path = "test.js" as FilePath;
      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(), // Empty scopes
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "someFunc" as SymbolName,
        file_path,
        5,
        "scope:missing" as ScopeId
      );

      const result = try_lexical_resolution("someFunc" as SymbolName, call_ref, context);

      expect(result).toBeNull();
    });
  });

  describe("try_imported_resolution", () => {
    it("should resolve imported function", () => {
      const file_path = "test.js" as FilePath;
      const other_file = "other.js" as FilePath;

      const importedFuncDef = create_function_def(
        "sym:importedFunc" as SymbolId,
        "importedFunc" as SymbolName,
        "scope:other" as ScopeId,
        other_file,
        1
      );

      const otherIndex: SemanticIndex = {
        file_path: other_file,
        language: "javascript",
        root_scope_id: "scope:other" as ScopeId,
        scopes: new Map(),
        symbols: new Map([["sym:importedFunc" as SymbolId, importedFuncDef]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const currentIndex: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([
          [file_path, currentIndex],
          [other_file, otherIndex],
        ]),
        imports: { imports: new Map() },
        file_path,
        file_index: currentIndex,
        file_imports: new Map([
          ["importedFunc" as SymbolName, "sym:importedFunc" as SymbolId],
        ]),
      };

      const call_ref = create_call_ref(
        "importedFunc" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      const result = try_imported_resolution("importedFunc" as SymbolName, call_ref, context);

      expect(result).not.toBeNull();
      expect(result?.resolved_function).toBe("sym:importedFunc" as SymbolId);
      expect(result?.resolution_method).toBe("imported");
      expect(result?.import_source).toBe(other_file);
    });

    it("should return null for non-imported function", () => {
      const file_path = "test.js" as FilePath;

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(), // No imports
      };

      const call_ref = create_call_ref(
        "notImported" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      const result = try_imported_resolution("notImported" as SymbolName, call_ref, context);

      expect(result).toBeNull();
    });

    it("should not resolve imported non-function symbols", () => {
      const file_path = "test.js" as FilePath;
      const other_file = "other.js" as FilePath;

      const importedVarDef: SymbolDefinition = {
        id: "sym:importedVar" as SymbolId,
        name: "importedVar" as SymbolName,
        kind: "variable",
        location: {
          file_path: other_file,
          line: 1,
          column: 10,
          end_line: 1,
          end_column: 21,
        },
        scope_id: "scope:other" as ScopeId,
      };

      const otherIndex: SemanticIndex = {
        file_path: other_file,
        language: "javascript",
        root_scope_id: "scope:other" as ScopeId,
        scopes: new Map(),
        symbols: new Map([["sym:importedVar" as SymbolId, importedVarDef]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const currentIndex: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([
          [file_path, currentIndex],
          [other_file, otherIndex],
        ]),
        imports: { imports: new Map() },
        file_path,
        file_index: currentIndex,
        file_imports: new Map([["importedVar" as SymbolName, "sym:importedVar" as SymbolId]]),
      };

      const call_ref = create_call_ref(
        "importedVar" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      const result = try_imported_resolution("importedVar" as SymbolName, call_ref, context);

      expect(result).toBeNull();
    });
  });

  describe("try_global_resolution", () => {
    it("should resolve JavaScript global functions", () => {
      const file_path = "test.js" as FilePath;

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "setTimeout" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      const result = try_global_resolution("setTimeout" as SymbolName, call_ref, context);

      expect(result).not.toBeNull();
      expect(result?.resolved_function).toBe("builtin:javascript:setTimeout" as SymbolId);
      expect(result?.resolution_method).toBe("global");
    });

    it("should resolve Python global functions", () => {
      const file_path = "test.py" as FilePath;

      const index: SemanticIndex = {
        file_path,
        language: "python",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref("print" as SymbolName, file_path, 5, "scope:module" as ScopeId);

      const result = try_global_resolution("print" as SymbolName, call_ref, context);

      expect(result).not.toBeNull();
      expect(result?.resolved_function).toBe("builtin:python:print" as SymbolId);
      expect(result?.resolution_method).toBe("global");
    });

    it("should return null for unknown global", () => {
      const file_path = "test.js" as FilePath;

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "unknownGlobal" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      const result = try_global_resolution("unknownGlobal" as SymbolName, call_ref, context);

      expect(result).toBeNull();
    });
  });

  describe("try_builtin_resolution", () => {
    it("should return null since globals handle builtins", () => {
      const file_path = "test.js" as FilePath;

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "parseInt" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      // try_builtin_resolution now returns null since globals handle everything
      const result = try_builtin_resolution("parseInt" as SymbolName, call_ref, context);

      expect(result).toBeNull();
    });
  });

  describe("Resolution priority order", () => {
    it("should prioritize lexical over global resolution", () => {
      const file_path = "test.js" as FilePath;

      // Create a local function with same name as global
      const localSetTimeout = create_function_def(
        "sym:setTimeout" as SymbolId,
        "setTimeout" as SymbolName,
        "scope:module" as ScopeId,
        file_path,
        1
      );

      const scope = create_scope(
        "scope:module" as ScopeId,
        null,
        new Map([["setTimeout" as SymbolName, localSetTimeout]])
      );

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map([["scope:module" as ScopeId, scope]]),
        symbols: new Map([["sym:setTimeout" as SymbolId, localSetTimeout]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([[file_path, index]]),
        imports: { imports: new Map() },
        file_path,
        file_index: index,
        file_imports: new Map(),
      };

      const call_ref = create_call_ref(
        "setTimeout" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      // Lexical should resolve first
      const lexicalResult = try_lexical_resolution("setTimeout" as SymbolName, call_ref, context);
      expect(lexicalResult).not.toBeNull();
      expect(lexicalResult?.resolved_function).toBe("sym:setTimeout" as SymbolId);

      // Global would also resolve, but should not be called if lexical succeeds
      const globalResult = try_global_resolution("setTimeout" as SymbolName, call_ref, context);
      expect(globalResult).not.toBeNull();
      expect(globalResult?.resolved_function).toBe("builtin:javascript:setTimeout" as SymbolId);
    });

    it("should prioritize imported over global resolution", () => {
      const file_path = "test.js" as FilePath;
      const other_file = "other.js" as FilePath;

      // Create imported function with same name as global
      const importedConsole = create_function_def(
        "sym:console" as SymbolId,
        "console" as SymbolName,
        "scope:other" as ScopeId,
        other_file,
        1
      );

      const otherIndex: SemanticIndex = {
        file_path: other_file,
        language: "javascript",
        root_scope_id: "scope:other" as ScopeId,
        scopes: new Map(),
        symbols: new Map([["sym:console" as SymbolId, importedConsole]]),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const currentIndex: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map(),
        symbols: new Map(),
        references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
      };

      const context: FunctionResolutionContext = {
        indices: new Map([
          [file_path, currentIndex],
          [other_file, otherIndex],
        ]),
        imports: { imports: new Map() },
        file_path,
        file_index: currentIndex,
        file_imports: new Map([["console" as SymbolName, "sym:console" as SymbolId]]),
      };

      const call_ref = create_call_ref(
        "console" as SymbolName,
        file_path,
        5,
        "scope:module" as ScopeId
      );

      // Imported should resolve
      const importedResult = try_imported_resolution("console" as SymbolName, call_ref, context);
      expect(importedResult).not.toBeNull();
      expect(importedResult?.resolved_function).toBe("sym:console" as SymbolId);

      // Global would also resolve
      const globalResult = try_global_resolution("console" as SymbolName, call_ref, context);
      expect(globalResult).not.toBeNull();
      expect(globalResult?.resolved_function).toBe("builtin:javascript:console" as SymbolId);
    });
  });
});