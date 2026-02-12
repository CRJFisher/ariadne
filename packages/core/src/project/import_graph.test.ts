import { describe, it, expect, beforeEach } from "vitest";
import { ImportGraph } from "./import_graph";
import type {
  FilePath,
  ImportDefinition,
  SymbolName,
  Language,
  ScopeId,
  ModulePath,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "../resolve_references/file_folders";

// Helper to create a simple ImportDefinition for testing
function create_import_definition(
  source: FilePath,
  file: FilePath
): ImportDefinition {
  return {
    kind: "import",
    symbol_id: `import:${file}:1:0:1:10:foo` as any,
    name: "foo" as SymbolName,
    import_path: source as unknown as ModulePath,
    import_kind: "named",
    location: {
      file_path: file,
      start_line: 1,
      start_column: 0,
      end_line: 1,
      end_column: 10,
    },
    defining_scope_id: `module:${file}:1:0:100:0:<module>` as ScopeId,
  };
}

// Mock root folder for testing - returns a permissive folder that "contains" any .ts file
// This allows the tests to work without having to list every file used
const MOCK_ROOT_FOLDER: FileSystemFolder = {
  path: "/test" as FilePath,
  files: new Set(), // Empty but the import resolver will resolve relative paths
  folders: new Map(),
};

const TEST_LANGUAGE: Language = "typescript";

describe("ImportGraph", () => {
  let graph: ImportGraph;

  beforeEach(() => {
    graph = new ImportGraph();
  });

  describe("update_file", () => {
    it("should add import relationships", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const imports: ImportDefinition[] = [create_import_definition(file2, file1)];

      graph.update_file(file1, imports, TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      expect(graph.get_dependents(file2).has(file1)).toBe(true);
    });

    it("should handle multiple imports", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      const imports: ImportDefinition[] = [
        create_import_definition(file2, file1),
        create_import_definition(file3, file1),
      ];

      graph.update_file(file1, imports, TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      expect(graph.get_dependents(file2).has(file1)).toBe(true);
      expect(graph.get_dependents(file3).has(file1)).toBe(true);
    });

    it("should replace imports when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // First version: imports file2
      graph.update_file(file1, [create_import_definition(file2, file1)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      expect(graph.get_dependents(file2).has(file1)).toBe(true);

      // Second version: imports file3 instead
      graph.update_file(file1, [create_import_definition(file3, file1)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      expect(graph.get_dependents(file2).has(file1)).toBe(false);
      expect(graph.get_dependents(file3).has(file1)).toBe(true);
    });

    it("should handle empty imports", () => {
      const file1 = "file1.ts" as FilePath;

      graph.update_file(file1, [], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      expect(graph.get_dependents(file1).size).toBe(0);
    });

    it("should deduplicate imports to same file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // Multiple imports from the same file
      const imports: ImportDefinition[] = [
        create_import_definition(file2, file1),
        create_import_definition(file2, file1),
      ];

      graph.update_file(file1, imports, TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      const dependents = graph.get_dependents(file2);
      expect(dependents.size).toBe(1);
      expect(dependents.has(file1)).toBe(true);
    });
  });

  describe("get_dependents", () => {
    it("should return empty set for file with no dependents", () => {
      const file1 = "file1.ts" as FilePath;
      expect(graph.get_dependents(file1).size).toBe(0);
    });

    it("should return all files importing from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // Both file2 and file3 import from file1
      graph.update_file(file2, [create_import_definition(file1, file2)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);
      graph.update_file(file3, [create_import_definition(file1, file3)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      const dependents = graph.get_dependents(file1);
      expect(dependents.size).toBe(2);
      expect(dependents.has(file2)).toBe(true);
      expect(dependents.has(file3)).toBe(true);
    });
  });

  describe("remove_file", () => {
    it("should remove all relationships for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import_definition(file2, file1)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      graph.remove_file(file1);

      expect(graph.get_dependents(file2).size).toBe(0);
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(file1, [create_import_definition(file2, file1)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);
      graph.update_file(file3, [create_import_definition(file2, file3)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      graph.remove_file(file1);

      // file3's relationship with file2 should remain
      expect(graph.get_dependents(file2).has(file3)).toBe(true);
    });

    it("should handle removing non-existent file gracefully", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(() => graph.remove_file(unknown_file)).not.toThrow();
    });
  });

  describe("submodule_import_paths", () => {
    // Helper to create a FileSystemFolder tree for Python submodule tests
    function create_python_tree(
      root_path: string,
      files: string[]
    ): FileSystemFolder {
      const root: FileSystemFolder = {
        path: root_path as FilePath,
        folders: new Map(),
        files: new Set(),
      };
      for (const file of files) {
        const relative_path = file.startsWith(root_path)
          ? file.slice(root_path.length + 1)
          : file;
        const parts = relative_path.split("/");
        let current = root;
        for (let i = 0; i < parts.length - 1; i++) {
          const folder_name = parts[i];
          let folder = (current.folders as Map<string, FileSystemFolder>).get(
            folder_name
          );
          if (!folder) {
            const folder_path = [root_path, ...parts.slice(0, i + 1)].join("/");
            folder = {
              path: folder_path as FilePath,
              folders: new Map(),
              files: new Set(),
            };
            (current.folders as Map<string, FileSystemFolder>).set(
              folder_name,
              folder
            );
          }
          current = folder;
        }
        const file_name = parts[parts.length - 1];
        (current.files as Set<string>).add(file_name);
      }
      return root;
    }

    it("should cache submodule path for Python named imports of modules", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: `import:${caller_file}:1:0:1:30:pipeline` as any,
        name: "pipeline" as SymbolName,
        import_path: "training" as any,
        import_kind: "named",
        location: {
          file_path: caller_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 30,
        },
        defining_scope_id: `module:${caller_file}:1:0:100:0:<module>` as ScopeId,
      };

      graph.update_file(caller_file, [import_def], "python", root_folder);

      const submodule_path = graph.get_submodule_import_path(import_def.symbol_id);
      expect(submodule_path).toBe("/project/training/pipeline.py");
    });

    it("should return undefined for named imports of symbols (not submodules)", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: `import:${caller_file}:1:0:1:30:train_model` as any,
        name: "train_model" as SymbolName,
        import_path: "training" as any,
        import_kind: "named",
        location: {
          file_path: caller_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 30,
        },
        defining_scope_id: `module:${caller_file}:1:0:100:0:<module>` as ScopeId,
      };

      graph.update_file(caller_file, [import_def], "python", root_folder);

      const submodule_path = graph.get_submodule_import_path(import_def.symbol_id);
      expect(submodule_path).toBeUndefined();
    });

    it("should clean up submodule paths on remove_file()", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: `import:${caller_file}:1:0:1:30:pipeline` as any,
        name: "pipeline" as SymbolName,
        import_path: "training" as any,
        import_kind: "named",
        location: {
          file_path: caller_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 30,
        },
        defining_scope_id: `module:${caller_file}:1:0:100:0:<module>` as ScopeId,
      };

      graph.update_file(caller_file, [import_def], "python", root_folder);
      expect(graph.get_submodule_import_path(import_def.symbol_id)).toBe(
        "/project/training/pipeline.py"
      );

      graph.remove_file(caller_file);
      expect(graph.get_submodule_import_path(import_def.symbol_id)).toBeUndefined();
    });

    it("should clean up submodule paths on clear()", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def: ImportDefinition = {
        kind: "import",
        symbol_id: `import:${caller_file}:1:0:1:30:pipeline` as any,
        name: "pipeline" as SymbolName,
        import_path: "training" as any,
        import_kind: "named",
        location: {
          file_path: caller_file,
          start_line: 1,
          start_column: 0,
          end_line: 1,
          end_column: 30,
        },
        defining_scope_id: `module:${caller_file}:1:0:100:0:<module>` as ScopeId,
      };

      graph.update_file(caller_file, [import_def], "python", root_folder);
      expect(graph.get_submodule_import_path(import_def.symbol_id)).toBe(
        "/project/training/pipeline.py"
      );

      graph.clear();
      expect(graph.get_submodule_import_path(import_def.symbol_id)).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("should remove all relationships", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import_definition(file2, file1)], TEST_LANGUAGE, MOCK_ROOT_FOLDER);

      expect(graph.get_dependents(file2).size).toBeGreaterThan(0);

      graph.clear();

      expect(graph.get_dependents(file1).size).toBe(0);
      expect(graph.get_dependents(file2).size).toBe(0);
    });
  });
});
