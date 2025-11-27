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
  const mock_location = (start_line: number, start_column: number, end_line: number, end_column: number): Location => ({
    file_path: "test.ts" as any,
    start_line: start_line,
    start_column: start_column,
    end_line: end_line,
    end_column: end_column,
  });

  const mock_scope = (
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

  const mock_capture = (location: Location): CaptureNode => ({
    entity: "function",
    category: "definition" as any,
    text: "test_function",
    node: {} as any,
    location,
  });

  it("should find body scope for simple function", () => {
    const def_location = mock_location(10, 0, 10, 20);
    const scope_location = mock_location(10, 15, 15, 1); // Scope starts after function definition
    const scope_id = "function:test.ts:10:15:15:1" as ScopeId;
    const scope = mock_scope("function", "test_function" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "test_function" as SymbolName,
      def_location,
    );

    expect(result).toBe(scope_id);
  });

  it("should find body scope for method", () => {
    const def_location = mock_location(20, 2, 20, 15);
    const scope_location = mock_location(20, 10, 25, 3); // Method scope starts after method definition
    const scope_id = "method:test.ts:20:10:25:3" as ScopeId;
    const scope = mock_scope("method", "test_method" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "test_method" as SymbolName,
      def_location,
    );

    expect(result).toBe(scope_id);
  });

  it("should find body scope for constructor", () => {
    const def_location = mock_location(30, 2, 30, 15);
    const scope_location = mock_location(30, 12, 35, 3); // Constructor scope starts after constructor definition
    const scope_id = "constructor:test.ts:30:12:35:3" as ScopeId;
    const scope = mock_scope("constructor", "constructor" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "constructor" as SymbolName,
      def_location,
    );

    expect(result).toBe(scope_id);
  });

  it("should find body scope for anonymous function by location", () => {
    const def_location = mock_location(40, 0, 40, 10);
    const scope_location = mock_location(40, 8, 45, 1); // Anonymous function scope
    const scope_id = "function:test.ts:40:8:45:1" as ScopeId;
    const scope = mock_scope("function", "" as SymbolName, scope_location, scope_id); // Empty name for anonymous

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "" as SymbolName, // Anonymous function has empty name
      def_location,
    );

    expect(result).toBe(scope_id);
  });

  it("should find closest scope when multiple functions have same name", () => {
    const def_location = mock_location(50, 0, 50, 15);

    // Two functions with same name at different locations
    const closer_scope_location = mock_location(50, 12, 55, 1); // Closer to definition
    const farther_scope_location = mock_location(60, 0, 65, 1); // Farther from definition

    const closer_scope_id = "function:test.ts:50:12:55:1" as ScopeId;
    const farther_scope_id = "function:test.ts:60:0:65:1" as ScopeId;

    const closer_scope = mock_scope("function", "helper" as SymbolName, closer_scope_location, closer_scope_id);
    const farther_scope = mock_scope("function", "helper" as SymbolName, farther_scope_location, farther_scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [closer_scope_id, closer_scope],
      [farther_scope_id, farther_scope],
    ]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "helper" as SymbolName,
      def_location,
    );

    expect(result).toBe(closer_scope_id); // Should pick the closer one
  });

  it("should throw error when no scope matches", () => {
    const def_location = mock_location(70, 0, 70, 15);
    // Create a scope that starts BEFORE the definition (invalid case)
    const scope_location = mock_location(60, 0, 65, 1); // Scope starts before definition
    const scope_id = "function:test.ts:60:0:65:1" as ScopeId;
    const scope = mock_scope("function", "different_function" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    expect(() => {
      find_body_scope_for_definition(
        capture,
        scopes,
        "missing_function" as SymbolName,
        def_location,
      );
    }).toThrow("No body scope found for missing_function");
  });

  it("should ignore non-callable scopes", () => {
    const def_location = mock_location(90, 0, 90, 15);
    const func_scope_location = mock_location(90, 12, 95, 1);
    const class_scope_location = mock_location(100, 0, 110, 1);

    const func_scope_id = "function:test.ts:90:12:95:1" as ScopeId;
    const class_scope_id = "class:test.ts:100:0:110:1" as ScopeId;

    const func_scope = mock_scope("function", "test_function" as SymbolName, func_scope_location, func_scope_id);
    const class_scope: LexicalScope = {
      id: class_scope_id,
      parent_id: null,
      name: "TestClass" as SymbolName,
      type: "class", // Non-callable scope type
      location: class_scope_location,
      child_ids: [],
    };

    const scopes = new Map<ScopeId, LexicalScope>([
      [func_scope_id, func_scope],
      [class_scope_id, class_scope],
    ]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "test_function" as SymbolName,
      def_location,
    );

    expect(result).toBe(func_scope_id); // Should only consider function scope, not class scope
  });

  it("should handle edge cases with permissive matching", () => {
    const def_location = mock_location(100, 0, 100, 15);
    const scope_location = mock_location(95, 0, 105, 1); // Scope starts before definition (edge case)
    const scope_id = "function:test.ts:95:0:105:1" as ScopeId;
    const scope = mock_scope("function", "helper_function" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "helper" as SymbolName, // Partial name match
      def_location,
    );

    expect(result).toBe(scope_id); // Should match with fuzzy name matching
  });

  it("should fall back to location-only matching when name incompatible", () => {
    const def_location = mock_location(110, 0, 110, 15);
    const scope_location = mock_location(110, 10, 115, 1);
    const scope_id = "function:test.ts:110:10:115:1" as ScopeId;
    const scope = mock_scope("function", "completely_different_name" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(
      capture,
      scopes,
      "target_function" as SymbolName,
      def_location,
    );

    expect(result).toBe(scope_id); // Should match based on location proximity alone
  });

  it("should still throw when no reasonable scope found", () => {
    const def_location = mock_location(120, 0, 120, 15);
    const scope_location = mock_location(200, 0, 205, 1); // Very far away
    const scope_id = "function:test.ts:200:0:205:1" as ScopeId;
    const scope = mock_scope("function", "far_function" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    expect(() => {
      find_body_scope_for_definition(
        capture,
        scopes,
        "target_function" as SymbolName,
        def_location,
      );
    }).toThrow("No body scope found for target_function");
  });
});

describe("find_enclosing_function_scope", () => {
  const mock_location = (start_line: number, start_column: number, end_line: number, end_column: number): Location => ({
    file_path: "test.ts" as any,
    start_line: start_line,
    start_column: start_column,
    end_line: end_line,
    end_column: end_column,
  });

  const mock_scope = (
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
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const function_id = "function:test.ts:10:0:20:0" as ScopeId;
    const block_id = "block:test.ts:12:0:18:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const function_scope = mock_scope("function", "outer" as SymbolName, mock_location(10, 0, 20, 0), function_id, module_id);
    const block_scope = mock_scope("block", "" as SymbolName, mock_location(12, 0, 18, 0), block_id, function_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [function_id, function_scope],
      [block_id, block_scope],
    ]);

    const result = find_enclosing_function_scope(block_id, scopes);
    expect(result).toBe(function_id);
  });

  it("should return same scope for call directly in function", () => {
    // Call in function scope (not nested deeper)
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const function_id = "function:test.ts:10:0:20:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const function_scope = mock_scope("function", "myFunc" as SymbolName, mock_location(10, 0, 20, 0), function_id, module_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [function_id, function_scope],
    ]);

    const result = find_enclosing_function_scope(function_id, scopes);
    expect(result).toBe(function_id);
  });

  it("should return module scope for top-level call", () => {
    // Call in module scope
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
    ]);

    const result = find_enclosing_function_scope(module_id, scopes);
    expect(result).toBe(module_id);
  });

  it("should stop at first function scope", () => {
    // Scope tree: module > outer_func > inner_func > block
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const outer_func_id = "function:test.ts:10:0:50:0" as ScopeId;
    const inner_func_id = "function:test.ts:20:0:30:0" as ScopeId;
    const block_id = "block:test.ts:22:0:28:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const outer_func_scope = mock_scope("function", "outer" as SymbolName, mock_location(10, 0, 50, 0), outer_func_id, module_id);
    const inner_func_scope = mock_scope("function", "inner" as SymbolName, mock_location(20, 0, 30, 0), inner_func_id, outer_func_id);
    const block_scope = mock_scope("block", "" as SymbolName, mock_location(22, 0, 28, 0), block_id, inner_func_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [outer_func_id, outer_func_scope],
      [inner_func_id, inner_func_scope],
      [block_id, block_scope],
    ]);

    const result = find_enclosing_function_scope(block_id, scopes);
    expect(result).toBe(inner_func_id); // Should return inner_func, NOT outer_func
  });

  it("should handle method scope", () => {
    // Scope tree: module > class > method > block
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const class_id = "class:test.ts:10:0:50:0" as ScopeId;
    const method_id = "method:test.ts:20:0:30:0" as ScopeId;
    const block_id = "block:test.ts:22:0:28:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const class_scope = mock_scope("class", "MyClass" as SymbolName, mock_location(10, 0, 50, 0), class_id, module_id);
    const method_scope = mock_scope("method", "myMethod" as SymbolName, mock_location(20, 0, 30, 0), method_id, class_id);
    const block_scope = mock_scope("block", "" as SymbolName, mock_location(22, 0, 28, 0), block_id, method_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [class_id, class_scope],
      [method_id, method_scope],
      [block_id, block_scope],
    ]);

    const result = find_enclosing_function_scope(block_id, scopes);
    expect(result).toBe(method_id);
  });

  it("should handle constructor scope", () => {
    // Scope tree: module > class > constructor > block
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const class_id = "class:test.ts:10:0:50:0" as ScopeId;
    const constructor_id = "constructor:test.ts:20:0:30:0" as ScopeId;
    const block_id = "block:test.ts:22:0:28:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const class_scope = mock_scope("class", "MyClass" as SymbolName, mock_location(10, 0, 50, 0), class_id, module_id);
    const constructor_scope = mock_scope("constructor", "constructor" as SymbolName, mock_location(20, 0, 30, 0), constructor_id, class_id);
    const block_scope = mock_scope("block", "" as SymbolName, mock_location(22, 0, 28, 0), block_id, constructor_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [class_id, class_scope],
      [constructor_id, constructor_scope],
      [block_id, block_scope],
    ]);

    const result = find_enclosing_function_scope(block_id, scopes);
    expect(result).toBe(constructor_id);
  });

  it("should throw error when scope not found", () => {
    const scopes = new Map<ScopeId, LexicalScope>();
    const non_existent_id = "invalid:scope:id" as ScopeId;

    expect(() => {
      find_enclosing_function_scope(non_existent_id, scopes);
    }).toThrow("Scope invalid:scope:id not found");
  });

  it("should throw error when cycle detected in scope tree", () => {
    // Create a malformed scope tree with cycles
    const scope1_id = "scope1:test.ts:10:0:20:0" as ScopeId;
    const scope2_id = "scope2:test.ts:20:0:30:0" as ScopeId;

    const scope1 = mock_scope("block", "" as SymbolName, mock_location(10, 0, 20, 0), scope1_id, scope2_id);
    const scope2 = mock_scope("block", "" as SymbolName, mock_location(20, 0, 30, 0), scope2_id, scope1_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1_id, scope1],
      [scope2_id, scope2],
    ]);

    expect(() => {
      find_enclosing_function_scope(scope1_id, scopes);
    }).toThrow("Cycle detected in scope tree");
  });

  it("should throw error when no root scope found in malformed tree", () => {
    // Create a scope tree where all scopes have parents (no root)
    // but avoid cycles by making scope1 parent of scope2, and scope2 parent of scope3
    const scope1_id = "scope1:test.ts:10:0:20:0" as ScopeId;
    const scope2_id = "scope2:test.ts:20:0:30:0" as ScopeId;
    const scope3_id = "scope3:test.ts:30:0:40:0" as ScopeId;

    const scope1 = mock_scope("block", "" as SymbolName, mock_location(10, 0, 20, 0), scope1_id, scope2_id);
    const scope2 = mock_scope("block", "" as SymbolName, mock_location(20, 0, 30, 0), scope2_id, scope3_id);
    const scope3 = mock_scope("block", "" as SymbolName, mock_location(30, 0, 40, 0), scope3_id, scope1_id); // This creates the issue - no root

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1_id, scope1],
      [scope2_id, scope2],
      [scope3_id, scope3],
    ]);

    expect(() => {
      find_enclosing_function_scope(scope1_id, scopes);
    }).toThrow("Cycle detected in scope tree");
  });
});

describe("find_root_scope", () => {
  const mock_location = (start_line: number, start_column: number, end_line: number, end_column: number): Location => ({
    file_path: "test.ts" as any,
    start_line: start_line,
    start_column: start_column,
    end_line: end_line,
    end_column: end_column,
  });

  const mock_scope = (
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
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const function_id = "function:test.ts:10:0:20:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const function_scope = mock_scope("function", "test" as SymbolName, mock_location(10, 0, 20, 0), function_id, module_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [function_id, function_scope],
    ]);

    const result = find_root_scope(scopes);
    expect(result).toBe(module_id);
  });

  it("should throw error when no root scope exists", () => {
    // Create scopes where all have non-null parent_id (malformed scope tree)
    const scope1_id = "scope1:test.ts:10:0:20:0" as ScopeId;
    const scope2_id = "scope2:test.ts:20:0:30:0" as ScopeId;

    const scope1 = mock_scope("block", "" as SymbolName, mock_location(10, 0, 20, 0), scope1_id, scope2_id);
    const scope2 = mock_scope("block", "" as SymbolName, mock_location(20, 0, 30, 0), scope2_id, scope1_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1_id, scope1],
      [scope2_id, scope2],
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