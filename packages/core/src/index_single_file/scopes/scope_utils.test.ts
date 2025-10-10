/**
 * Tests for scope utility functions
 */

import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import type { CaptureNode } from "../semantic_index";
import { find_body_scope_for_definition, find_enclosing_function_scope, find_root_scope } from "./scope_utils";

describe("find_body_scope_for_definition", () => {
  const mockLocation = (startLine: number, startColumn: number, endLine: number, endColumn: number): Location => ({
    file_path: "test.ts" as any,
    start_line: startLine,
    start_column: startColumn,
    end_line: endLine,
    end_column: endColumn,
  });

  const mockScope = (
    type: "function" | "method" | "constructor",
    name: SymbolName,
    location: Location,
    id: ScopeId,
  ): LexicalScope => ({
    id,
    parent_id: null,
    name,
    type,
    location,
    child_ids: [],
  });

  const mockCapture = (location: Location): CaptureNode => ({
    entity: "function",
    category: "definition" as any,
    text: "test_function",
    node: {} as any,
    location,
  });

  it("should find body scope for simple function", () => {
    const defLocation = mockLocation(10, 0, 10, 20);
    const scopeLocation = mockLocation(10, 15, 15, 1); // Scope starts after function definition
    const scopeId = "function:test.ts:10:15:15:1" as ScopeId;
    const scope = mockScope("function", "test_function" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "test_function" as SymbolName,
      defLocation,
    );

    expect(result).toBe(scopeId);
  });

  it("should find body scope for method", () => {
    const defLocation = mockLocation(20, 2, 20, 15);
    const scopeLocation = mockLocation(20, 10, 25, 3); // Method scope starts after method definition
    const scopeId = "method:test.ts:20:10:25:3" as ScopeId;
    const scope = mockScope("method", "test_method" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "test_method" as SymbolName,
      defLocation,
    );

    expect(result).toBe(scopeId);
  });

  it("should find body scope for constructor", () => {
    const defLocation = mockLocation(30, 2, 30, 15);
    const scopeLocation = mockLocation(30, 12, 35, 3); // Constructor scope starts after constructor definition
    const scopeId = "constructor:test.ts:30:12:35:3" as ScopeId;
    const scope = mockScope("constructor", "constructor" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "constructor" as SymbolName,
      defLocation,
    );

    expect(result).toBe(scopeId);
  });

  it("should find body scope for anonymous function by location", () => {
    const defLocation = mockLocation(40, 0, 40, 10);
    const scopeLocation = mockLocation(40, 8, 45, 1); // Anonymous function scope
    const scopeId = "function:test.ts:40:8:45:1" as ScopeId;
    const scope = mockScope("function", "" as SymbolName, scopeLocation, scopeId); // Empty name for anonymous

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "" as SymbolName, // Anonymous function has empty name
      defLocation,
    );

    expect(result).toBe(scopeId);
  });

  it("should find closest scope when multiple functions have same name", () => {
    const defLocation = mockLocation(50, 0, 50, 15);

    // Two functions with same name at different locations
    const closerScopeLocation = mockLocation(50, 12, 55, 1); // Closer to definition
    const fartherScopeLocation = mockLocation(60, 0, 65, 1); // Farther from definition

    const closerScopeId = "function:test.ts:50:12:55:1" as ScopeId;
    const fartherScopeId = "function:test.ts:60:0:65:1" as ScopeId;

    const closerScope = mockScope("function", "helper" as SymbolName, closerScopeLocation, closerScopeId);
    const fartherScope = mockScope("function", "helper" as SymbolName, fartherScopeLocation, fartherScopeId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [closerScopeId, closerScope],
      [fartherScopeId, fartherScope],
    ]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "helper" as SymbolName,
      defLocation,
    );

    expect(result).toBe(closerScopeId); // Should pick the closer one
  });

  it("should throw error when no scope matches", () => {
    const defLocation = mockLocation(70, 0, 70, 15);
    // Create a scope that starts BEFORE the definition (invalid case)
    const scopeLocation = mockLocation(60, 0, 65, 1); // Scope starts before definition
    const scopeId = "function:test.ts:60:0:65:1" as ScopeId;
    const scope = mockScope("function", "different_function" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    expect(() => {
      find_body_scope_for_definition(
        capture,
        scopes,
        "missing_function" as SymbolName,
        defLocation,
      );
    }).toThrow("No body scope found for missing_function");
  });

  it("should ignore non-callable scopes", () => {
    const defLocation = mockLocation(90, 0, 90, 15);
    const funcScopeLocation = mockLocation(90, 12, 95, 1);
    const classScopeLocation = mockLocation(100, 0, 110, 1);

    const funcScopeId = "function:test.ts:90:12:95:1" as ScopeId;
    const classScopeId = "class:test.ts:100:0:110:1" as ScopeId;

    const funcScope = mockScope("function", "test_function" as SymbolName, funcScopeLocation, funcScopeId);
    const classScope: LexicalScope = {
      id: classScopeId,
      parent_id: null,
      name: "TestClass" as SymbolName,
      type: "class", // Non-callable scope type
      location: classScopeLocation,
      child_ids: [],
    };

    const scopes = new Map<ScopeId, LexicalScope>([
      [funcScopeId, funcScope],
      [classScopeId, classScope],
    ]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "test_function" as SymbolName,
      defLocation,
    );

    expect(result).toBe(funcScopeId); // Should only consider function scope, not class scope
  });

  it("should handle edge cases with permissive matching", () => {
    const defLocation = mockLocation(100, 0, 100, 15);
    const scopeLocation = mockLocation(95, 0, 105, 1); // Scope starts before definition (edge case)
    const scopeId = "function:test.ts:95:0:105:1" as ScopeId;
    const scope = mockScope("function", "helper_function" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "helper" as SymbolName, // Partial name match
      defLocation,
    );

    expect(result).toBe(scopeId); // Should match with fuzzy name matching
  });

  it("should fall back to location-only matching when name incompatible", () => {
    const defLocation = mockLocation(110, 0, 110, 15);
    const scopeLocation = mockLocation(110, 10, 115, 1);
    const scopeId = "function:test.ts:110:10:115:1" as ScopeId;
    const scope = mockScope("function", "completely_different_name" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "target_function" as SymbolName,
      defLocation,
    );

    expect(result).toBe(scopeId); // Should match based on location proximity alone
  });

  it("should still throw when no reasonable scope found", () => {
    const defLocation = mockLocation(120, 0, 120, 15);
    const scopeLocation = mockLocation(200, 0, 205, 1); // Very far away
    const scopeId = "function:test.ts:200:0:205:1" as ScopeId;
    const scope = mockScope("function", "far_function" as SymbolName, scopeLocation, scopeId);

    const scopes = new Map<ScopeId, LexicalScope>([[scopeId, scope]]);
    const capture = mockCapture(defLocation);

    expect(() => {
      find_body_scope_for_definition(
        capture,
        scopes,
        "target_function" as SymbolName,
        defLocation,
      );
    }).toThrow("No body scope found for target_function");
  });
});

describe("find_enclosing_function_scope", () => {
  const mockLocation = (startLine: number, startColumn: number, endLine: number, endColumn: number): Location => ({
    file_path: "test.ts" as any,
    start_line: startLine,
    start_column: startColumn,
    end_line: endLine,
    end_column: endColumn,
  });

  const mockScope = (
    type: LexicalScope["type"],
    name: SymbolName,
    location: Location,
    id: ScopeId,
    parent_id: ScopeId | null = null,
  ): LexicalScope => ({
    id,
    parent_id,
    name,
    type,
    location,
    child_ids: [],
  });

  it("should find enclosing function for call in block scope", () => {
    // Create scope tree: module > function > block
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const functionId = "function:test.ts:10:0:20:0" as ScopeId;
    const blockId = "block:test.ts:12:0:18:0" as ScopeId;

    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);
    const functionScope = mockScope("function", "outer" as SymbolName, mockLocation(10, 0, 20, 0), functionId, moduleId);
    const blockScope = mockScope("block", "" as SymbolName, mockLocation(12, 0, 18, 0), blockId, functionId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
      [functionId, functionScope],
      [blockId, blockScope],
    ]);

    const result = find_enclosing_function_scope(blockId, scopes);
    expect(result).toBe(functionId);
  });

  it("should return same scope for call directly in function", () => {
    // Call in function scope (not nested deeper)
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const functionId = "function:test.ts:10:0:20:0" as ScopeId;

    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);
    const functionScope = mockScope("function", "myFunc" as SymbolName, mockLocation(10, 0, 20, 0), functionId, moduleId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
      [functionId, functionScope],
    ]);

    const result = find_enclosing_function_scope(functionId, scopes);
    expect(result).toBe(functionId);
  });

  it("should return module scope for top-level call", () => {
    // Call in module scope
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
    ]);

    const result = find_enclosing_function_scope(moduleId, scopes);
    expect(result).toBe(moduleId);
  });

  it("should stop at first function scope", () => {
    // Scope tree: module > outer_func > inner_func > block
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const outerFuncId = "function:test.ts:10:0:50:0" as ScopeId;
    const innerFuncId = "function:test.ts:20:0:30:0" as ScopeId;
    const blockId = "block:test.ts:22:0:28:0" as ScopeId;

    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);
    const outerFuncScope = mockScope("function", "outer" as SymbolName, mockLocation(10, 0, 50, 0), outerFuncId, moduleId);
    const innerFuncScope = mockScope("function", "inner" as SymbolName, mockLocation(20, 0, 30, 0), innerFuncId, outerFuncId);
    const blockScope = mockScope("block", "" as SymbolName, mockLocation(22, 0, 28, 0), blockId, innerFuncId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
      [outerFuncId, outerFuncScope],
      [innerFuncId, innerFuncScope],
      [blockId, blockScope],
    ]);

    const result = find_enclosing_function_scope(blockId, scopes);
    expect(result).toBe(innerFuncId); // Should return inner_func, NOT outer_func
  });

  it("should handle method scope", () => {
    // Scope tree: module > class > method > block
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const classId = "class:test.ts:10:0:50:0" as ScopeId;
    const methodId = "method:test.ts:20:0:30:0" as ScopeId;
    const blockId = "block:test.ts:22:0:28:0" as ScopeId;

    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);
    const classScope = mockScope("class", "MyClass" as SymbolName, mockLocation(10, 0, 50, 0), classId, moduleId);
    const methodScope = mockScope("method", "myMethod" as SymbolName, mockLocation(20, 0, 30, 0), methodId, classId);
    const blockScope = mockScope("block", "" as SymbolName, mockLocation(22, 0, 28, 0), blockId, methodId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
      [classId, classScope],
      [methodId, methodScope],
      [blockId, blockScope],
    ]);

    const result = find_enclosing_function_scope(blockId, scopes);
    expect(result).toBe(methodId);
  });

  it("should handle constructor scope", () => {
    // Scope tree: module > class > constructor > block
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const classId = "class:test.ts:10:0:50:0" as ScopeId;
    const constructorId = "constructor:test.ts:20:0:30:0" as ScopeId;
    const blockId = "block:test.ts:22:0:28:0" as ScopeId;

    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);
    const classScope = mockScope("class", "MyClass" as SymbolName, mockLocation(10, 0, 50, 0), classId, moduleId);
    const constructorScope = mockScope("constructor", "constructor" as SymbolName, mockLocation(20, 0, 30, 0), constructorId, classId);
    const blockScope = mockScope("block", "" as SymbolName, mockLocation(22, 0, 28, 0), blockId, constructorId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
      [classId, classScope],
      [constructorId, constructorScope],
      [blockId, blockScope],
    ]);

    const result = find_enclosing_function_scope(blockId, scopes);
    expect(result).toBe(constructorId);
  });

  it("should throw error when scope not found", () => {
    const scopes = new Map<ScopeId, LexicalScope>();
    const nonExistentId = "invalid:scope:id" as ScopeId;

    expect(() => {
      find_enclosing_function_scope(nonExistentId, scopes);
    }).toThrow("Scope invalid:scope:id not found");
  });

  it("should throw error when cycle detected in scope tree", () => {
    // Create a malformed scope tree with cycles
    const scope1Id = "scope1:test.ts:10:0:20:0" as ScopeId;
    const scope2Id = "scope2:test.ts:20:0:30:0" as ScopeId;

    const scope1 = mockScope("block", "" as SymbolName, mockLocation(10, 0, 20, 0), scope1Id, scope2Id);
    const scope2 = mockScope("block", "" as SymbolName, mockLocation(20, 0, 30, 0), scope2Id, scope1Id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1Id, scope1],
      [scope2Id, scope2],
    ]);

    expect(() => {
      find_enclosing_function_scope(scope1Id, scopes);
    }).toThrow("Cycle detected in scope tree");
  });

  it("should throw error when no root scope found in malformed tree", () => {
    // Create a scope tree where all scopes have parents (no root)
    // but avoid cycles by making scope1 parent of scope2, and scope2 parent of scope3
    const scope1Id = "scope1:test.ts:10:0:20:0" as ScopeId;
    const scope2Id = "scope2:test.ts:20:0:30:0" as ScopeId;
    const scope3Id = "scope3:test.ts:30:0:40:0" as ScopeId;

    const scope1 = mockScope("block", "" as SymbolName, mockLocation(10, 0, 20, 0), scope1Id, scope2Id);
    const scope2 = mockScope("block", "" as SymbolName, mockLocation(20, 0, 30, 0), scope2Id, scope3Id);
    const scope3 = mockScope("block", "" as SymbolName, mockLocation(30, 0, 40, 0), scope3Id, scope1Id); // This creates the issue - no root

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1Id, scope1],
      [scope2Id, scope2],
      [scope3Id, scope3],
    ]);

    expect(() => {
      find_enclosing_function_scope(scope1Id, scopes);
    }).toThrow("Cycle detected in scope tree");
  });
});

describe("find_root_scope", () => {
  const mockLocation = (startLine: number, startColumn: number, endLine: number, endColumn: number): Location => ({
    file_path: "test.ts" as any,
    start_line: startLine,
    start_column: startColumn,
    end_line: endLine,
    end_column: endColumn,
  });

  const mockScope = (
    type: LexicalScope["type"],
    name: SymbolName,
    location: Location,
    id: ScopeId,
    parent_id: ScopeId | null = null,
  ): LexicalScope => ({
    id,
    parent_id,
    name,
    type,
    location,
    child_ids: [],
  });

  it("should find and return root scope", () => {
    const moduleId = "module:test.ts:0:0:100:0" as ScopeId;
    const functionId = "function:test.ts:10:0:20:0" as ScopeId;

    const moduleScope = mockScope("module", "" as SymbolName, mockLocation(0, 0, 100, 0), moduleId);
    const functionScope = mockScope("function", "test" as SymbolName, mockLocation(10, 0, 20, 0), functionId, moduleId);

    const scopes = new Map<ScopeId, LexicalScope>([
      [moduleId, moduleScope],
      [functionId, functionScope],
    ]);

    const result = find_root_scope(scopes);
    expect(result).toBe(moduleId);
  });

  it("should throw error when no root scope exists", () => {
    // Create scopes where all have non-null parent_id (malformed scope tree)
    const scope1Id = "scope1:test.ts:10:0:20:0" as ScopeId;
    const scope2Id = "scope2:test.ts:20:0:30:0" as ScopeId;

    const scope1 = mockScope("block", "" as SymbolName, mockLocation(10, 0, 20, 0), scope1Id, scope2Id);
    const scope2 = mockScope("block", "" as SymbolName, mockLocation(20, 0, 30, 0), scope2Id, scope1Id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1Id, scope1],
      [scope2Id, scope2],
    ]);

    expect(() => {
      find_root_scope(scopes);
    }).toThrow("No root scope found");
  });

  it("should handle empty scope map", () => {
    const scopes = new Map<ScopeId, LexicalScope>();

    expect(() => {
      find_root_scope(scopes);
    }).toThrow("No root scope found");
  });
});