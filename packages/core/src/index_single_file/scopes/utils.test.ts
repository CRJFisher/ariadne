/**
 * Tests for scope utility functions
 */

import { describe, it, expect } from "vitest";
import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import type { CaptureNode } from "../index_single_file";
import { SemanticEntity } from "../index_single_file";
import { find_body_scope_for_definition, find_enclosing_function_scope, find_root_scope } from "./utils";

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
    entity: SemanticEntity.FUNCTION,
    category: "definition" as any,
    name: "definition.function",
    text: "test_function" as SymbolName,
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

  it("should NOT match scope that starts BEFORE definition", () => {
    // This was previously allowed with permissive matching, but caused bugs
    // where multiple functions shared the same body_scope_id
    const def_location = mock_location(100, 0, 100, 15);
    const scope_location = mock_location(95, 0, 105, 1); // Scope starts BEFORE definition line
    const scope_id = "function:test.ts:95:0:105:1" as ScopeId;
    const scope = mock_scope("function", "helper_function" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    // Should throw - scope starts on line 95, but definition ends on line 100
    expect(() => {
      find_body_scope_for_definition(
        capture,
        scopes,
        "helper" as SymbolName,
        def_location,
      );
    }).toThrow("No body scope found");
  });

  it("should NOT match scope with different name even if location is close", () => {
    // This was previously allowed with location-only fallback, but caused bugs
    const def_location = mock_location(110, 0, 110, 15);
    const scope_location = mock_location(110, 16, 115, 1); // Same line, after definition
    const scope_id = "function:test.ts:110:16:115:1" as ScopeId;
    const scope = mock_scope("function", "completely_different_name" as SymbolName, scope_location, scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    // Should throw - names don't match and this is not an anonymous function case
    expect(() => {
      find_body_scope_for_definition(
        capture,
        scopes,
        "target_function" as SymbolName,
        def_location,
      );
    }).toThrow("No body scope found");
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

  // ============================================================================
  // Tests for same-line proximity matching (fix for body_scope_id sharing bug)
  // ============================================================================

  it("should NOT share body_scope_id between functions at different lines", () => {
    // This test exposes the bug where multiple functions get the same body_scope_id
    // Three function definitions at different lines
    const def1_loc = mock_location(16, 10, 16, 15);  // "inner" name ends at line 16, col 15
    const def2_loc = mock_location(20, 10, 20, 21);  // "with_reduce" name ends at line 20, col 21
    const def3_loc = mock_location(21, 10, 21, 20);  // anonymous, ends at line 21, col 20

    // Create corresponding scopes (each starts right after its definition on the same line)
    const scope1_id = "function:test.ts:16:15:18:1" as ScopeId;
    const scope2_id = "function:test.ts:20:21:22:1" as ScopeId;
    const scope3_id = "function:test.ts:21:22:23:1" as ScopeId;

    const scope1 = mock_scope("function", "inner" as SymbolName, mock_location(16, 15, 18, 1), scope1_id);
    const scope2 = mock_scope("function", "with_reduce" as SymbolName, mock_location(20, 21, 22, 1), scope2_id);
    const scope3 = mock_scope("function", "" as SymbolName, mock_location(21, 22, 23, 1), scope3_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [scope1_id, scope1],
      [scope2_id, scope2],
      [scope3_id, scope3],
    ]);

    const capture = mock_capture(def1_loc);

    // Each definition should get its OWN unique scope
    expect(find_body_scope_for_definition(capture, scopes, "inner" as SymbolName, def1_loc)).toBe(scope1_id);
    expect(find_body_scope_for_definition(capture, scopes, "with_reduce" as SymbolName, def2_loc)).toBe(scope2_id);
    expect(find_body_scope_for_definition(capture, scopes, "" as SymbolName, def3_loc)).toBe(scope3_id);
  });

  it("should match by same-line proximity, not just distance", () => {
    // Bug scenario: function at line 20 should NOT match scope at line 16
    const def_at_20 = mock_location(20, 10, 20, 21);  // definition ends at line 20

    // Only one scope available, but it's on line 16 (wrong line)
    const scope_at_16_id = "function:test.ts:16:15:16:30" as ScopeId;
    const scope_at_16 = mock_scope("function", "inner" as SymbolName, mock_location(16, 15, 16, 30), scope_at_16_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_at_16_id, scope_at_16]]);
    const capture = mock_capture(def_at_20);

    // Should throw - no valid scope on line 20
    expect(() => {
      find_body_scope_for_definition(capture, scopes, "with_reduce" as SymbolName, def_at_20);
    }).toThrow("No body scope found");
  });

  it("should require exact name match for named functions", () => {
    const def_location = mock_location(10, 10, 10, 20);  // definition ends at line 10, col 20

    // Two scopes on the same line but with different names
    const wrong_scope_id = "function:test.ts:10:21:15:1" as ScopeId;
    const correct_scope_id = "function:test.ts:10:22:16:1" as ScopeId;

    const wrong_scope = mock_scope("function", "wrong_name" as SymbolName, mock_location(10, 21, 15, 1), wrong_scope_id);
    const correct_scope = mock_scope("function", "correct_name" as SymbolName, mock_location(10, 22, 16, 1), correct_scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [wrong_scope_id, wrong_scope],
      [correct_scope_id, correct_scope],
    ]);
    const capture = mock_capture(def_location);

    // Should match the scope with the correct name, even if wrong_scope is closer
    const result = find_body_scope_for_definition(capture, scopes, "correct_name" as SymbolName, def_location);
    expect(result).toBe(correct_scope_id);
  });

  it("should handle multi-line function signatures", () => {
    // Definition ends at line 10, but scope starts at line 12 (multi-line signature)
    const def_location = mock_location(10, 10, 10, 20);
    const scope_id = "function:test.ts:12:5:20:1" as ScopeId;
    const scope = mock_scope("function", "multi_line_func" as SymbolName, mock_location(12, 5, 20, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);
    const capture = mock_capture(def_location);

    const result = find_body_scope_for_definition(capture, scopes, "multi_line_func" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });

  it("should match anonymous definitions only with anonymous scopes", () => {
    const def_location = mock_location(10, 10, 10, 20);

    // One named scope, one anonymous scope
    const named_scope_id = "function:test.ts:10:21:15:1" as ScopeId;
    const anon_scope_id = "function:test.ts:10:22:16:1" as ScopeId;

    const named_scope = mock_scope("function", "named_func" as SymbolName, mock_location(10, 21, 15, 1), named_scope_id);
    const anon_scope = mock_scope("function", "" as SymbolName, mock_location(10, 22, 16, 1), anon_scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [named_scope_id, named_scope],
      [anon_scope_id, anon_scope],
    ]);
    const capture = mock_capture(def_location);

    // Anonymous definition should match anonymous scope
    const result = find_body_scope_for_definition(capture, scopes, "" as SymbolName, def_location);
    expect(result).toBe(anon_scope_id);
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