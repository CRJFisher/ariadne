import { describe, it, expect, beforeEach } from "vitest";
import { ScopeRegistry } from "./scope";
import { module_scope, function_scope } from "@ariadnejs/types";
import type {
  LexicalScope,
  FilePath,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";

function location(file_path: FilePath, start_line: number, end_line: number): Location {
  return {
    file_path,
    start_line,
    start_column: 0,
    end_line,
    end_column: 0,
  };
}

function module_root(file_path: FilePath, child_ids: ScopeId[] = []): LexicalScope {
  const loc = location(file_path, 0, 100);
  return {
    id: module_scope(loc),
    parent_id: null,
    name: null,
    type: "module",
    location: loc,
    child_ids,
  };
}

function child_function(
  file_path: FilePath,
  parent_id: ScopeId,
  name: string,
  start_line: number,
  child_ids: ScopeId[] = []
): LexicalScope {
  const loc = location(file_path, start_line, start_line + 3);
  return {
    id: function_scope(loc),
    parent_id,
    name: name as SymbolName,
    type: "function",
    location: loc,
    child_ids,
  };
}

function scope_map(...scopes: LexicalScope[]): Map<ScopeId, LexicalScope> {
  return new Map(scopes.map((scope) => [scope.id, scope]));
}

describe("ScopeRegistry", () => {
  let registry: ScopeRegistry;
  const file1 = "file1.ts" as FilePath;
  const file2 = "file2.ts" as FilePath;

  beforeEach(() => {
    registry = new ScopeRegistry();
  });

  describe("update_file", () => {
    it("stores the parent-less scope as the file root", () => {
      const root = module_root(file1);
      registry.update_file(file1, scope_map(root));

      expect(registry.get_file_root_scope(file1)).toEqual(root);
    });

    it("indexes every scope in the tree by id", () => {
      const func = child_function(file1, module_scope(location(file1, 0, 100)), "run", 2);
      const root = module_root(file1, [func.id]);
      registry.update_file(file1, scope_map(root, func));

      expect(registry.get_scope(root.id)).toEqual(root);
      expect(registry.get_scope(func.id)).toEqual(func);
    });

    it("preserves parent/child links across the stored tree", () => {
      const func = child_function(file1, module_scope(location(file1, 0, 100)), "run", 2);
      const root = module_root(file1, [func.id]);
      registry.update_file(file1, scope_map(root, func));

      const stored_root = registry.get_file_root_scope(file1);
      expect(stored_root!.child_ids).toEqual([func.id]);
      expect(registry.get_scope(func.id)!.parent_id).toEqual(root.id);
    });

    it("re-indexing a file replaces its prior scopes", () => {
      const old_func = child_function(file1, module_scope(location(file1, 0, 100)), "old", 2);
      registry.update_file(file1, scope_map(module_root(file1, [old_func.id]), old_func));

      const new_func = child_function(file1, module_scope(location(file1, 0, 100)), "fresh", 5);
      registry.update_file(file1, scope_map(module_root(file1, [new_func.id]), new_func));

      expect(registry.get_scope(old_func.id)).toBeUndefined();
      expect(registry.get_scope(new_func.id)).toEqual(new_func);
    });

    it("indexes nothing for an empty scope map", () => {
      const previously_indexed = module_root(file1);
      registry.update_file(file1, scope_map(previously_indexed));

      registry.update_file(file1, new Map());

      expect(registry.get_file_root_scope(file1)).toBeUndefined();
      expect(registry.get_scope(previously_indexed.id)).toBeUndefined();
    });

    it("falls back to the first scope when no parent-less root exists", () => {
      const loc = location(file1, 2, 5);
      const orphan: LexicalScope = {
        id: function_scope(loc),
        parent_id: function_scope(location(file1, 0, 100)),
        name: "orphan" as SymbolName,
        type: "function",
        location: loc,
        child_ids: [],
      };
      registry.update_file(file1, scope_map(orphan));

      expect(registry.get_file_root_scope(file1)).toEqual(orphan);
    });

    it("keeps scopes from separate files isolated", () => {
      const root1 = module_root(file1);
      const root2 = module_root(file2);
      registry.update_file(file1, scope_map(root1));
      registry.update_file(file2, scope_map(root2));

      expect(registry.get_file_root_scope(file1)).toEqual(root1);
      expect(registry.get_file_root_scope(file2)).toEqual(root2);
    });
  });

  describe("get_scope", () => {
    it("returns undefined for an unknown scope id", () => {
      expect(registry.get_scope("fake:scope:id" as ScopeId)).toBeUndefined();
    });
  });

  describe("get_file_root_scope", () => {
    it("returns undefined for a file that was never indexed", () => {
      expect(registry.get_file_root_scope("missing.ts" as FilePath)).toBeUndefined();
    });
  });

  describe("remove_file", () => {
    it("purges a whole nested tree from the flattened index", () => {
      const root_loc = location(file1, 0, 100);
      const inner = child_function(file1, function_scope(location(file1, 2, 5)), "inner", 3);
      const outer = child_function(file1, module_scope(root_loc), "outer", 2, [inner.id]);
      const root = module_root(file1, [outer.id]);
      registry.update_file(file1, scope_map(root, outer, inner));

      registry.remove_file(file1);

      expect(registry.get_file_root_scope(file1)).toBeUndefined();
      expect(registry.get_scope(root.id)).toBeUndefined();
      expect(registry.get_scope(outer.id)).toBeUndefined();
      expect(registry.get_scope(inner.id)).toBeUndefined();
    });

    it("leaves other files intact when removing one", () => {
      const root1 = module_root(file1);
      const root2 = module_root(file2);
      registry.update_file(file1, scope_map(root1));
      registry.update_file(file2, scope_map(root2));

      registry.remove_file(file1);

      expect(registry.get_file_root_scope(file1)).toBeUndefined();
      expect(registry.get_file_root_scope(file2)).toEqual(root2);
    });

    it("does nothing for a file that was never indexed", () => {
      const root1 = module_root(file1);
      registry.update_file(file1, scope_map(root1));

      registry.remove_file("missing.ts" as FilePath);

      expect(registry.get_file_root_scope(file1)).toEqual(root1);
      expect(registry.get_scope(root1.id)).toEqual(root1);
    });
  });

  describe("clear", () => {
    it("empties every file tree and the flattened index", () => {
      const root1 = module_root(file1);
      const root2 = module_root(file2);
      registry.update_file(file1, scope_map(root1));
      registry.update_file(file2, scope_map(root2));

      registry.clear();

      expect(registry.get_file_root_scope(file1)).toBeUndefined();
      expect(registry.get_file_root_scope(file2)).toBeUndefined();
      expect(registry.get_scope(root1.id)).toBeUndefined();
      expect(registry.get_scope(root2.id)).toBeUndefined();
    });
  });

  describe("find_enclosing_function_scope", () => {
    const test_file = "test.ts" as FilePath;

    function test_scope(
      type: LexicalScope["type"],
      name: string,
      loc: Location,
      id: ScopeId,
      parent_id: ScopeId | null = null,
    ): LexicalScope {
      return {
        id,
        parent_id,
        name: name as SymbolName,
        type,
        location: loc,
        child_ids: [],
      };
    }

    const module_id = "module:test.ts:0:0:100:0" as ScopeId;

    function module_test_scope(): LexicalScope {
      return test_scope("module", "", location(test_file, 0, 100), module_id);
    }

    it("finds the enclosing function for a call in a block scope", () => {
      const function_id = "function:test.ts:10:0:20:0" as ScopeId;
      const block_id = "block:test.ts:12:0:18:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        module_test_scope(),
        test_scope("function", "outer", location(test_file, 10, 20), function_id, module_id),
        test_scope("block", "", location(test_file, 12, 18), block_id, function_id),
      ));

      expect(registry.find_enclosing_function_scope(block_id)).toBe(function_id);
    });

    it("returns the same scope for a call directly in a function", () => {
      const function_id = "function:test.ts:10:0:20:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        module_test_scope(),
        test_scope("function", "my_func", location(test_file, 10, 20), function_id, module_id),
      ));

      expect(registry.find_enclosing_function_scope(function_id)).toBe(function_id);
    });

    it("returns the module scope for a top-level call", () => {
      registry.update_file(test_file, scope_map(module_test_scope()));

      expect(registry.find_enclosing_function_scope(module_id)).toBe(module_id);
    });

    it("returns the root scope when nested non-function scopes reach module level", () => {
      const outer_block_id = "block:test.ts:2:0:80:0" as ScopeId;
      const inner_block_id = "block:test.ts:4:0:60:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        module_test_scope(),
        test_scope("block", "", location(test_file, 2, 80), outer_block_id, module_id),
        test_scope("block", "", location(test_file, 4, 60), inner_block_id, outer_block_id),
      ));

      expect(registry.find_enclosing_function_scope(inner_block_id)).toBe(module_id);
    });

    it("stops at the first (innermost) function scope", () => {
      const outer_func_id = "function:test.ts:10:0:50:0" as ScopeId;
      const inner_func_id = "function:test.ts:20:0:30:0" as ScopeId;
      const block_id = "block:test.ts:22:0:28:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        module_test_scope(),
        test_scope("function", "outer", location(test_file, 10, 50), outer_func_id, module_id),
        test_scope("function", "inner", location(test_file, 20, 30), inner_func_id, outer_func_id),
        test_scope("block", "", location(test_file, 22, 28), block_id, inner_func_id),
      ));

      expect(registry.find_enclosing_function_scope(block_id)).toBe(inner_func_id);
    });

    it("treats a method scope as an enclosing function scope", () => {
      const class_id = "class:test.ts:10:0:50:0" as ScopeId;
      const method_id = "method:test.ts:20:0:30:0" as ScopeId;
      const block_id = "block:test.ts:22:0:28:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        module_test_scope(),
        test_scope("class", "MyClass", location(test_file, 10, 50), class_id, module_id),
        test_scope("method", "my_method", location(test_file, 20, 30), method_id, class_id),
        test_scope("block", "", location(test_file, 22, 28), block_id, method_id),
      ));

      expect(registry.find_enclosing_function_scope(block_id)).toBe(method_id);
    });

    it("treats a constructor scope as an enclosing function scope", () => {
      const class_id = "class:test.ts:10:0:50:0" as ScopeId;
      const constructor_id = "constructor:test.ts:20:0:30:0" as ScopeId;
      const block_id = "block:test.ts:22:0:28:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        module_test_scope(),
        test_scope("class", "MyClass", location(test_file, 10, 50), class_id, module_id),
        test_scope("constructor", "constructor", location(test_file, 20, 30), constructor_id, class_id),
        test_scope("block", "", location(test_file, 22, 28), block_id, constructor_id),
      ));

      expect(registry.find_enclosing_function_scope(block_id)).toBe(constructor_id);
    });

    it("throws when the starting scope is not indexed", () => {
      const non_existent_id = "invalid:scope:id" as ScopeId;

      expect(() => {
        registry.find_enclosing_function_scope(non_existent_id);
      }).toThrow("Scope invalid:scope:id not found");
    });

    it("throws when the scope tree contains a cycle", () => {
      const scope1_id = "scope1:test.ts:10:0:20:0" as ScopeId;
      const scope2_id = "scope2:test.ts:20:0:30:0" as ScopeId;

      registry.update_file(test_file, scope_map(
        test_scope("block", "", location(test_file, 10, 20), scope1_id, scope2_id),
        test_scope("block", "", location(test_file, 20, 30), scope2_id, scope1_id),
      ));

      expect(() => {
        registry.find_enclosing_function_scope(scope1_id);
      }).toThrow("Cycle detected in scope tree");
    });
  });
});
