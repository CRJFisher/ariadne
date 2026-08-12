import { describe, it, expect, beforeEach } from "vitest";
import { ImportGraph } from "./import_graph";
import type {
  FilePath,
  ImportDefinition,
  SymbolName,
  Language,
  ScopeId,
  ModulePath,
  SymbolId,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { create_module_resolution_context, EMPTY_MODULE_SPECIFIER_INDEX } from "../import_resolution";

function create_import_definition(
  source: FilePath,
  file: FilePath,
  name: string = "foo"
): ImportDefinition {
  return {
    kind: "import",
    symbol_id: `import:${file}:1:0:1:10:${name}` as SymbolId,
    name: name as SymbolName,
    import_path: source as string as ModulePath,
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

// The import resolver only walks the file tree for relative ("./"-prefixed)
// paths; bare paths pass through unchanged, so an empty folder suffices for
// non-relative TypeScript fixtures.
const MOCK_ROOT_FOLDER: FileSystemFolder = {
  path: "/test" as FilePath,
  files: new Set(),
  folders: new Map(),
};

const TEST_LANGUAGE: Language = "typescript";

describe("ImportGraph", () => {
  let graph: ImportGraph;

  beforeEach(() => {
    graph = new ImportGraph();
  });

  describe("update_file", () => {
    it("records the importing file as a dependent of the imported file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file2)).toEqual(new Set([file1]));
    });

    it("records a dependent edge for every imported file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(
        file1,
        [
          create_import_definition(file2, file1, "a"),
          create_import_definition(file3, file1, "b"),
        ],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file2)).toEqual(new Set([file1]));
      expect(graph.get_dependents(file3)).toEqual(new Set([file1]));
    });

    it("records a dependent edge for a wildcard import", () => {
      const barrel = "barrel.ts" as FilePath;
      const leaf = "leaf.ts" as FilePath;

      graph.update_file(
        barrel,
        [
          {
            ...create_import_definition(leaf, barrel, "leaf"),
            import_kind: "wildcard",
            export: { is_reexport: true },
          },
        ],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(leaf)).toEqual(new Set([barrel]));
    });

    it("drops edges to files no longer imported after an update", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(
        file1,
        [create_import_definition(file3, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file2)).toEqual(new Set());
      expect(graph.get_dependents(file3)).toEqual(new Set([file1]));
    });

    it("leaves a file with no imports out of the dependents index", () => {
      const file1 = "file1.ts" as FilePath;

      graph.update_file(file1, [], TEST_LANGUAGE, create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX));

      expect(graph.get_dependents(file1)).toEqual(new Set());
    });

    it("collapses multiple imports of the same file to one dependent edge", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(
        file1,
        [
          create_import_definition(file2, file1, "a"),
          create_import_definition(file2, file1, "b"),
        ],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file2)).toEqual(new Set([file1]));
    });

    it("records both directions of a two-file import cycle", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(
        file2,
        [create_import_definition(file1, file2)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file1)).toEqual(new Set([file2]));
      expect(graph.get_dependents(file2)).toEqual(new Set([file1]));
    });

    it("records a self-import as a file depending on itself", () => {
      const file1 = "file1.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file1, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file1)).toEqual(new Set([file1]));
    });
  });

  describe("get_dependents", () => {
    it("returns an empty set for a file nobody imports", () => {
      const file1 = "file1.ts" as FilePath;
      expect(graph.get_dependents(file1)).toEqual(new Set());
    });

    it("returns every file that imports the queried file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(
        file2,
        [create_import_definition(file1, file2)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(
        file3,
        [create_import_definition(file1, file3)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_dependents(file1)).toEqual(new Set([file2, file3]));
    });

    it("returns a copy that does not mutate the stored dependents", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      const dependents = graph.get_dependents(file2);
      dependents.add("file3.ts" as FilePath);

      expect(graph.get_dependents(file2)).toEqual(new Set([file1]));
    });
  });

  describe("get_scope_imports", () => {
    it("returns an empty array for a scope with no imports", () => {
      const scope = "module:none.ts:1:0:100:0:<module>" as ScopeId;
      expect(graph.get_scope_imports(scope)).toEqual([]);
    });

    it("returns every import definition recorded for a scope", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const import_a = create_import_definition(file2, file1, "a");
      const import_b = create_import_definition(file2, file1, "b");

      graph.update_file(
        file1,
        [import_a, import_b],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_scope_imports(import_a.defining_scope_id)).toEqual([
        import_a,
        import_b,
      ]);
    });

    it("drops import definitions from a scope when the file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const import_def = create_import_definition(file2, file1);

      graph.update_file(
        file1,
        [import_def],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(file1, [], TEST_LANGUAGE, create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX));

      expect(graph.get_scope_imports(import_def.defining_scope_id)).toEqual([]);
    });
  });

  describe("get_resolved_import_path", () => {
    it("returns the resolved file path for an import symbol", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const import_def = create_import_definition(file2, file1);

      graph.update_file(
        file1,
        [import_def],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      expect(graph.get_resolved_import_path(import_def.symbol_id)).toBe(file2);
    });

    it("returns undefined for an unknown import symbol", () => {
      const unknown = "import:none.ts:1:0:1:10:foo" as SymbolId;
      expect(graph.get_resolved_import_path(unknown)).toBeUndefined();
    });

    it("forgets a resolved path once its import is removed by an update", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const import_def = create_import_definition(file2, file1);

      graph.update_file(
        file1,
        [import_def],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(file1, [], TEST_LANGUAGE, create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX));

      expect(
        graph.get_resolved_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });
  });

  describe("remove_file", () => {
    it("removes the dependent edges pointing at a removed importer", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.remove_file(file1);

      expect(graph.get_dependents(file2)).toEqual(new Set());
    });

    it("removes both directions when the removed file is a hub", () => {
      const importer = "importer.ts" as FilePath;
      const hub = "hub.ts" as FilePath;
      const target = "target.ts" as FilePath;

      graph.update_file(
        importer,
        [create_import_definition(hub, importer)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(
        hub,
        [create_import_definition(target, hub)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.remove_file(hub);

      expect(graph.get_dependents(hub)).toEqual(new Set());
      expect(graph.get_dependents(target)).toEqual(new Set());
    });

    it("leaves unrelated files untouched", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );
      graph.update_file(
        file3,
        [create_import_definition(file2, file3)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.remove_file(file1);

      expect(graph.get_dependents(file2)).toEqual(new Set([file3]));
    });

    it("clears the scope imports and resolved paths of a removed file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const import_def = create_import_definition(file2, file1);

      graph.update_file(
        file1,
        [import_def],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.remove_file(file1);

      expect(graph.get_scope_imports(import_def.defining_scope_id)).toEqual([]);
      expect(
        graph.get_resolved_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });

    it("clears a self-importing file in both directions", () => {
      const file1 = "file1.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file1, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.remove_file(file1);

      expect(graph.get_dependents(file1)).toEqual(new Set());
    });

    it("leaves the graph unchanged when removing an unknown file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(
        file1,
        [create_import_definition(file2, file1)],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.remove_file("unknown.ts" as FilePath);

      expect(graph.get_dependents(file2)).toEqual(new Set([file1]));
    });
  });

  describe("submodule_import_paths", () => {
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

    function create_python_module_import(
      caller_file: FilePath,
      name: string
    ): ImportDefinition {
      return {
        kind: "import",
        symbol_id: `import:${caller_file}:1:0:1:30:${name}` as SymbolId,
        name: name as SymbolName,
        import_path: "training" as ModulePath,
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
    }

    it("caches the submodule path for a Python named import of a module", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def = create_python_module_import(caller_file, "pipeline");

      graph.update_file(caller_file, [import_def], "python", create_module_resolution_context(root_folder, EMPTY_MODULE_SPECIFIER_INDEX));

      expect(graph.get_submodule_import_path(import_def.symbol_id)).toBe(
        "/project/training/pipeline.py"
      );
    });

    it("returns undefined for a named import of a symbol rather than a submodule", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def = create_python_module_import(caller_file, "train_model");

      graph.update_file(caller_file, [import_def], "python", create_module_resolution_context(root_folder, EMPTY_MODULE_SPECIFIER_INDEX));

      expect(
        graph.get_submodule_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });

    it("does not probe for a submodule path on a wildcard import", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def: ImportDefinition = {
        ...create_python_module_import(caller_file, "pipeline"),
        import_kind: "wildcard",
        export: { is_reexport: true },
      };

      graph.update_file(caller_file, [import_def], "python", create_module_resolution_context(root_folder, EMPTY_MODULE_SPECIFIER_INDEX));

      expect(
        graph.get_submodule_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });

    it("clears cached submodule paths on remove_file", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def = create_python_module_import(caller_file, "pipeline");

      graph.update_file(caller_file, [import_def], "python", create_module_resolution_context(root_folder, EMPTY_MODULE_SPECIFIER_INDEX));

      graph.remove_file(caller_file);

      expect(
        graph.get_submodule_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });

    it("clears cached submodule paths on clear", () => {
      const root_folder = create_python_tree("/project", [
        "training/__init__.py",
        "training/pipeline.py",
        "caller.py",
      ]);
      const caller_file = "/project/caller.py" as FilePath;
      const import_def = create_python_module_import(caller_file, "pipeline");

      graph.update_file(caller_file, [import_def], "python", create_module_resolution_context(root_folder, EMPTY_MODULE_SPECIFIER_INDEX));

      graph.clear();

      expect(
        graph.get_submodule_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("removes all dependent, scope, and resolved-path state", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const import_def = create_import_definition(file2, file1);

      graph.update_file(
        file1,
        [import_def],
        TEST_LANGUAGE,
        create_module_resolution_context(MOCK_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX)
      );

      graph.clear();

      expect(graph.get_dependents(file2)).toEqual(new Set());
      expect(graph.get_scope_imports(import_def.defining_scope_id)).toEqual([]);
      expect(
        graph.get_resolved_import_path(import_def.symbol_id)
      ).toBeUndefined();
    });
  });
});
