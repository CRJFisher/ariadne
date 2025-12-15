import { describe, it, expect, beforeEach } from "vitest";
import { ScopeRegistry } from "./registries.scope";
import { module_scope, function_scope, block_scope } from "@ariadnejs/types";
import type { LexicalScope, FilePath, ScopeId, SymbolName } from "@ariadnejs/types";

describe("ScopeRegistry", () => {
  let registry: ScopeRegistry;

  beforeEach(() => {
    registry = new ScopeRegistry();
  });

  describe("update_file", () => {
    it("should store scope tree for a file", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes = new Map<ScopeId, LexicalScope>([
        [module_id, {
          id: module_id,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes);

      const root = registry.get_file_root_scope(file1);
      expect(root).toBeDefined();
      expect(root!.id).toBe(module_id);
    });

    it("should build hierarchical scope tree from flat map", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const function_id = function_scope({
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 5,
        end_column: 0,
      });

      const scopes = new Map<ScopeId, LexicalScope>([
        [module_id, {
          id: module_id,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [function_id],
        }],
        [function_id, {
          id: function_id,
          parent_id: module_id,
          name: "myFunction" as SymbolName,
          type: "function",
          location: {
            file_path: file1,
            start_line: 2,
            start_column: 0,
            end_line: 5,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes);

      const root = registry.get_file_root_scope(file1);
      expect(root!.child_ids).toHaveLength(1);
      expect(root!.child_ids[0]).toBe(function_id);

      const func_scope = registry.get_scope(function_id);
      expect(func_scope).toBeDefined();
      expect(func_scope!.parent_id).toBe(module_id);
    });

    it("should replace existing scopes when file is updated", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id_v1 = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes_v1 = new Map<ScopeId, LexicalScope>([
        [module_id_v1, {
          id: module_id_v1,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes_v1);
      expect(registry.size()).toBe(1);

      // Update with new scopes
      const module_id_v2 = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 20,
        end_column: 0,
      });

      const scopes_v2 = new Map<ScopeId, LexicalScope>([
        [module_id_v2, {
          id: module_id_v2,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 20,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes_v2);

      expect(registry.size()).toBe(1);
      expect(registry.get_scope(module_id_v1)).toBeUndefined();
      expect(registry.get_scope(module_id_v2)).toBeDefined();
    });
  });

  describe("get_scope", () => {
    it("should retrieve scope by ID", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes = new Map<ScopeId, LexicalScope>([
        [module_id, {
          id: module_id,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes);

      const scope = registry.get_scope(module_id);
      expect(scope).toBeDefined();
      expect(scope!.type).toBe("module");
    });

    it("should return undefined for non-existent scope", () => {
      const fake_id = "fake:scope:id" as ScopeId;
      expect(registry.get_scope(fake_id)).toBeUndefined();
    });
  });

  describe("remove_file", () => {
    it("should remove all scopes from a file", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes = new Map<ScopeId, LexicalScope>([
        [module_id, {
          id: module_id,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes);
      expect(registry.size()).toBe(1);

      registry.remove_file(file1);

      expect(registry.size()).toBe(0);
      expect(registry.get_scope(module_id)).toBeUndefined();
      expect(registry.get_file_root_scope(file1)).toBeUndefined();
    });

    it("should remove nested scopes recursively", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const function_id = function_scope({
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 5,
        end_column: 0,
      });

      const block_id = block_scope({
        file_path: file1,
        start_line: 3,
        start_column: 2,
        end_line: 4,
        end_column: 2,
      });

      const scopes = new Map<ScopeId, LexicalScope>([
        [module_id, {
          id: module_id,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [function_id],
        }],
        [function_id, {
          id: function_id,
          parent_id: module_id,
          name: "myFunction" as SymbolName,
          type: "function",
          location: {
            file_path: file1,
            start_line: 2,
            start_column: 0,
            end_line: 5,
            end_column: 0,
          },
          child_ids: [block_id],
        }],
        [block_id, {
          id: block_id,
          parent_id: function_id,
          name: null,
          type: "block",
          location: {
            file_path: file1,
            start_line: 3,
            start_column: 2,
            end_line: 4,
            end_column: 2,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes);
      expect(registry.size()).toBe(3);

      registry.remove_file(file1);

      expect(registry.size()).toBe(0);
      expect(registry.get_scope(module_id)).toBeUndefined();
      expect(registry.get_scope(function_id)).toBeUndefined();
      expect(registry.get_scope(block_id)).toBeUndefined();
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const module_id_1 = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const module_id_2 = module_scope({
        file_path: file2,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes1 = new Map<ScopeId, LexicalScope>([
        [module_id_1, {
          id: module_id_1,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      const scopes2 = new Map<ScopeId, LexicalScope>([
        [module_id_2, {
          id: module_id_2,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file2,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes1);
      registry.update_file(file2, scopes2);

      expect(registry.size()).toBe(2);

      registry.remove_file(file1);

      expect(registry.size()).toBe(1);
      expect(registry.get_scope(module_id_1)).toBeUndefined();
      expect(registry.get_scope(module_id_2)).toBeDefined();
    });

    it("should handle removing non-existent file gracefully", () => {
      const file1 = "nonexistent.ts" as FilePath;
      expect(() => registry.remove_file(file1)).not.toThrow();
      expect(registry.size()).toBe(0);
    });
  });

  describe("get_all_files", () => {
    it("should return all indexed files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const module_id_1 = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const module_id_2 = module_scope({
        file_path: file2,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes1 = new Map<ScopeId, LexicalScope>([
        [module_id_1, {
          id: module_id_1,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      const scopes2 = new Map<ScopeId, LexicalScope>([
        [module_id_2, {
          id: module_id_2,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file2,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes1);
      registry.update_file(file2, scopes2);

      const files = registry.get_all_files();
      expect(files).toHaveLength(2);
      expect(files).toContain(file1);
      expect(files).toContain(file2);
    });

    it("should return empty array when no files indexed", () => {
      expect(registry.get_all_files()).toEqual([]);
    });
  });

  describe("clear", () => {
    it("should remove all scopes and files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const module_id_1 = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const module_id_2 = module_scope({
        file_path: file2,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const scopes1 = new Map<ScopeId, LexicalScope>([
        [module_id_1, {
          id: module_id_1,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      const scopes2 = new Map<ScopeId, LexicalScope>([
        [module_id_2, {
          id: module_id_2,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file2,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes1);
      registry.update_file(file2, scopes2);

      expect(registry.size()).toBe(2);
      expect(registry.get_all_files()).toHaveLength(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.get_all_files()).toEqual([]);
      expect(registry.get_scope(module_id_1)).toBeUndefined();
      expect(registry.get_scope(module_id_2)).toBeUndefined();
    });
  });

  describe("size", () => {
    it("should return total number of scopes", () => {
      const file1 = "file1.ts" as FilePath;

      const module_id = module_scope({
        file_path: file1,
        start_line: 0,
        start_column: 0,
        end_line: 10,
        end_column: 0,
      });

      const function_id = function_scope({
        file_path: file1,
        start_line: 2,
        start_column: 0,
        end_line: 5,
        end_column: 0,
      });

      const scopes = new Map<ScopeId, LexicalScope>([
        [module_id, {
          id: module_id,
          parent_id: null,
          name: null,
          type: "module",
          location: {
            file_path: file1,
            start_line: 0,
            start_column: 0,
            end_line: 10,
            end_column: 0,
          },
          child_ids: [function_id],
        }],
        [function_id, {
          id: function_id,
          parent_id: module_id,
          name: "myFunction" as SymbolName,
          type: "function",
          location: {
            file_path: file1,
            start_line: 2,
            start_column: 0,
            end_line: 5,
            end_column: 0,
          },
          child_ids: [],
        }],
      ]);

      registry.update_file(file1, scopes);

      expect(registry.size()).toBe(2);
    });
  });
});
