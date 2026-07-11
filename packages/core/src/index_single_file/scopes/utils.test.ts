import { describe, it, expect } from "vitest";
import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import { find_body_scope_for_definition, find_enclosing_function_scope } from "./utils";

const mock_location = (
  start_line: number,
  start_column: number,
  end_line: number,
  end_column: number,
): Location => ({
  file_path: "test.ts" as Location["file_path"],
  start_line,
  start_column,
  end_line,
  end_column,
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

describe("find_body_scope_for_definition", () => {
  it("finds body scope for a simple function", () => {
    const def_location = mock_location(10, 0, 10, 20);
    const scope_id = "function:test.ts:10:15:15:1" as ScopeId;
    const scope = mock_scope("function", "test_function" as SymbolName, mock_location(10, 15, 15, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    const result = find_body_scope_for_definition(scopes, "test_function" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });

  it("finds body scope for a method", () => {
    const def_location = mock_location(20, 2, 20, 15);
    const scope_id = "method:test.ts:20:10:25:3" as ScopeId;
    const scope = mock_scope("method", "test_method" as SymbolName, mock_location(20, 10, 25, 3), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    const result = find_body_scope_for_definition(scopes, "test_method" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });

  it("finds body scope for a constructor", () => {
    const def_location = mock_location(30, 2, 30, 15);
    const scope_id = "constructor:test.ts:30:12:35:3" as ScopeId;
    const scope = mock_scope("constructor", "constructor" as SymbolName, mock_location(30, 12, 35, 3), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    const result = find_body_scope_for_definition(scopes, "constructor" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });

  it("finds body scope for an anonymous function on the same line", () => {
    const def_location = mock_location(40, 0, 40, 10);
    const scope_id = "function:test.ts:40:8:45:1" as ScopeId;
    const scope = mock_scope("function", "" as SymbolName, mock_location(40, 8, 45, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    const result = find_body_scope_for_definition(scopes, "" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });

  it("matches an arrow function by the smallest containing scope", () => {
    const def_location = mock_location(5, 6, 7, 20);

    const inner_id = "function:test.ts:5:6:7:20" as ScopeId;
    const outer_id = "function:test.ts:5:4:8:1" as ScopeId;
    const inner = mock_scope("function", "" as SymbolName, mock_location(5, 6, 7, 20), inner_id);
    const outer = mock_scope("function", "" as SymbolName, mock_location(5, 4, 8, 1), outer_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [outer_id, outer],
      [inner_id, inner],
    ]);

    const result = find_body_scope_for_definition(scopes, "<anonymous>" as SymbolName, def_location);
    expect(result).toBe(inner_id);
  });

  it("picks the closest scope when multiple functions share a name", () => {
    const def_location = mock_location(50, 0, 50, 15);

    const closer_id = "function:test.ts:50:12:55:1" as ScopeId;
    const farther_id = "function:test.ts:60:0:65:1" as ScopeId;
    const closer = mock_scope("function", "helper" as SymbolName, mock_location(50, 12, 55, 1), closer_id);
    const farther = mock_scope("function", "helper" as SymbolName, mock_location(60, 0, 65, 1), farther_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [closer_id, closer],
      [farther_id, farther],
    ]);

    const result = find_body_scope_for_definition(scopes, "helper" as SymbolName, def_location);
    expect(result).toBe(closer_id);
  });

  it("throws when no scope matches", () => {
    const def_location = mock_location(70, 0, 70, 15);
    const scope_id = "function:test.ts:60:0:65:1" as ScopeId;
    const scope = mock_scope("function", "different_function" as SymbolName, mock_location(60, 0, 65, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    expect(() => {
      find_body_scope_for_definition(scopes, "missing_function" as SymbolName, def_location);
    }).toThrow("No body scope found for missing_function");
  });

  it("ignores non-callable scopes", () => {
    const def_location = mock_location(90, 0, 90, 15);

    const func_id = "function:test.ts:90:12:95:1" as ScopeId;
    const class_id = "class:test.ts:100:0:110:1" as ScopeId;
    const func_scope = mock_scope("function", "test_function" as SymbolName, mock_location(90, 12, 95, 1), func_id);
    const class_scope = mock_scope("class", "TestClass" as SymbolName, mock_location(100, 0, 110, 1), class_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [func_id, func_scope],
      [class_id, class_scope],
    ]);

    const result = find_body_scope_for_definition(scopes, "test_function" as SymbolName, def_location);
    expect(result).toBe(func_id);
  });

  it("rejects a scope that starts before the definition", () => {
    const def_location = mock_location(100, 0, 100, 15);
    const scope_id = "function:test.ts:95:0:105:1" as ScopeId;
    const scope = mock_scope("function", "helper_function" as SymbolName, mock_location(95, 0, 105, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    expect(() => {
      find_body_scope_for_definition(scopes, "helper" as SymbolName, def_location);
    }).toThrow("No body scope found");
  });

  it("rejects a differently named scope even when it is close", () => {
    const def_location = mock_location(110, 0, 110, 15);
    const scope_id = "function:test.ts:110:16:115:1" as ScopeId;
    const scope = mock_scope("function", "completely_different_name" as SymbolName, mock_location(110, 16, 115, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    expect(() => {
      find_body_scope_for_definition(scopes, "target_function" as SymbolName, def_location);
    }).toThrow("No body scope found");
  });

  it("throws when the only candidate scope is far away", () => {
    const def_location = mock_location(120, 0, 120, 15);
    const scope_id = "function:test.ts:200:0:205:1" as ScopeId;
    const scope = mock_scope("function", "far_function" as SymbolName, mock_location(200, 0, 205, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    expect(() => {
      find_body_scope_for_definition(scopes, "target_function" as SymbolName, def_location);
    }).toThrow("No body scope found for target_function");
  });

  it("gives distinct definitions on different lines their own scopes", () => {
    const def1_loc = mock_location(16, 10, 16, 15);
    const def2_loc = mock_location(20, 10, 20, 21);
    const def3_loc = mock_location(21, 10, 21, 20);

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

    expect(find_body_scope_for_definition(scopes, "inner" as SymbolName, def1_loc)).toBe(scope1_id);
    expect(find_body_scope_for_definition(scopes, "with_reduce" as SymbolName, def2_loc)).toBe(scope2_id);
    expect(find_body_scope_for_definition(scopes, "" as SymbolName, def3_loc)).toBe(scope3_id);
  });

  it("does not match a same-name scope on a different line", () => {
    const def_at_20 = mock_location(20, 10, 20, 21);

    const scope_at_16_id = "function:test.ts:16:15:16:30" as ScopeId;
    const scope_at_16 = mock_scope("function", "inner" as SymbolName, mock_location(16, 15, 16, 30), scope_at_16_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_at_16_id, scope_at_16]]);

    expect(() => {
      find_body_scope_for_definition(scopes, "with_reduce" as SymbolName, def_at_20);
    }).toThrow("No body scope found");
  });

  it("requires an exact name match even when a wrong-named scope is closer", () => {
    const def_location = mock_location(10, 10, 10, 20);

    const wrong_id = "function:test.ts:10:21:15:1" as ScopeId;
    const correct_id = "function:test.ts:10:22:16:1" as ScopeId;
    const wrong = mock_scope("function", "wrong_name" as SymbolName, mock_location(10, 21, 15, 1), wrong_id);
    const correct = mock_scope("function", "correct_name" as SymbolName, mock_location(10, 22, 16, 1), correct_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [wrong_id, wrong],
      [correct_id, correct],
    ]);

    const result = find_body_scope_for_definition(scopes, "correct_name" as SymbolName, def_location);
    expect(result).toBe(correct_id);
  });

  it("matches a scope that starts within five lines for multi-line signatures", () => {
    const def_location = mock_location(10, 10, 10, 20);
    const scope_id = "function:test.ts:12:5:20:1" as ScopeId;
    const scope = mock_scope("function", "multi_line_func" as SymbolName, mock_location(12, 5, 20, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    const result = find_body_scope_for_definition(scopes, "multi_line_func" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });

  it("matches an anonymous definition only against anonymous scopes", () => {
    const def_location = mock_location(10, 10, 10, 20);

    const named_id = "function:test.ts:10:21:15:1" as ScopeId;
    const anon_id = "function:test.ts:10:22:16:1" as ScopeId;
    const named = mock_scope("function", "named_func" as SymbolName, mock_location(10, 21, 15, 1), named_id);
    const anon = mock_scope("function", "" as SymbolName, mock_location(10, 22, 16, 1), anon_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [named_id, named],
      [anon_id, anon],
    ]);

    const result = find_body_scope_for_definition(scopes, "" as SymbolName, def_location);
    expect(result).toBe(anon_id);
  });

  it("falls back to a nearby anonymous scope when the named definition has no exact match", () => {
    const def_location = mock_location(10, 0, 10, 10);
    const scope_id = "function:test.ts:11:0:15:1" as ScopeId;
    const scope = mock_scope("function", "" as SymbolName, mock_location(11, 0, 15, 1), scope_id);

    const scopes = new Map<ScopeId, LexicalScope>([[scope_id, scope]]);

    const result = find_body_scope_for_definition(scopes, "renamed_by_tree_sitter" as SymbolName, def_location);
    expect(result).toBe(scope_id);
  });
});

describe("find_enclosing_function_scope", () => {
  it("finds the enclosing function for a call in a block scope", () => {
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

    expect(find_enclosing_function_scope(block_id, scopes)).toBe(function_id);
  });

  it("returns the same scope for a call directly in a function", () => {
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const function_id = "function:test.ts:10:0:20:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const function_scope = mock_scope("function", "myFunc" as SymbolName, mock_location(10, 0, 20, 0), function_id, module_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [function_id, function_scope],
    ]);

    expect(find_enclosing_function_scope(function_id, scopes)).toBe(function_id);
  });

  it("returns the module scope for a top-level call", () => {
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);

    const scopes = new Map<ScopeId, LexicalScope>([[module_id, module_scope]]);

    expect(find_enclosing_function_scope(module_id, scopes)).toBe(module_id);
  });

  it("returns the root scope when nested non-function scopes reach module level", () => {
    const module_id = "module:test.ts:0:0:100:0" as ScopeId;
    const outer_block_id = "block:test.ts:2:0:80:0" as ScopeId;
    const inner_block_id = "block:test.ts:4:0:60:0" as ScopeId;

    const module_scope = mock_scope("module", "" as SymbolName, mock_location(0, 0, 100, 0), module_id);
    const outer_block = mock_scope("block", "" as SymbolName, mock_location(2, 0, 80, 0), outer_block_id, module_id);
    const inner_block = mock_scope("block", "" as SymbolName, mock_location(4, 0, 60, 0), inner_block_id, outer_block_id);

    const scopes = new Map<ScopeId, LexicalScope>([
      [module_id, module_scope],
      [outer_block_id, outer_block],
      [inner_block_id, inner_block],
    ]);

    expect(find_enclosing_function_scope(inner_block_id, scopes)).toBe(module_id);
  });

  it("stops at the first (innermost) function scope", () => {
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

    expect(find_enclosing_function_scope(block_id, scopes)).toBe(inner_func_id);
  });

  it("treats a method scope as an enclosing function scope", () => {
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

    expect(find_enclosing_function_scope(block_id, scopes)).toBe(method_id);
  });

  it("treats a constructor scope as an enclosing function scope", () => {
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

    expect(find_enclosing_function_scope(block_id, scopes)).toBe(constructor_id);
  });

  it("throws when the starting scope is not in the map", () => {
    const scopes = new Map<ScopeId, LexicalScope>();
    const non_existent_id = "invalid:scope:id" as ScopeId;

    expect(() => {
      find_enclosing_function_scope(non_existent_id, scopes);
    }).toThrow("Scope invalid:scope:id not found");
  });

  it("throws when the scope tree contains a cycle", () => {
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
});
