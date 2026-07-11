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
      registry.update_file(file1, new Map());

      expect(registry.get_file_root_scope(file1)).toBeUndefined();
      expect(registry.get_all_scopes().size).toEqual(0);
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

  describe("get_all_scopes", () => {
    it("returns scopes aggregated across every indexed file", () => {
      const root1 = module_root(file1);
      const root2 = module_root(file2);
      registry.update_file(file1, scope_map(root1));
      registry.update_file(file2, scope_map(root2));

      const all = registry.get_all_scopes();
      expect(all.size).toEqual(2);
      expect(all.get(root1.id)).toEqual(root1);
      expect(all.get(root2.id)).toEqual(root2);
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
      registry.remove_file("missing.ts" as FilePath);

      expect(registry.get_all_scopes().size).toEqual(0);
    });
  });

  describe("clear", () => {
    it("empties every file tree and the flattened index", () => {
      registry.update_file(file1, scope_map(module_root(file1)));
      registry.update_file(file2, scope_map(module_root(file2)));

      registry.clear();

      expect(registry.get_all_scopes().size).toEqual(0);
      expect(registry.get_file_root_scope(file1)).toBeUndefined();
      expect(registry.get_file_root_scope(file2)).toBeUndefined();
    });
  });
});
