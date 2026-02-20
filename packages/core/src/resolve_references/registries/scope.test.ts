import { describe, it, expect, beforeEach } from "vitest";
import { ScopeRegistry } from "./scope";
import { module_scope, function_scope } from "@ariadnejs/types";
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
});
