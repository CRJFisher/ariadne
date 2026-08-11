import { describe, it, expect, vi } from "vitest";
import { ExportRegistry } from "./export";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  Language,
  ModulePath,
  VariableDefinition,
  FunctionDefinition,
  ImportDefinition,
  ExportableDefinition,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";
import type { FileSystemFolder } from "../file_folders";

function make_location(file_path: FilePath, start_line: number, len: number): Location {
  return {
    file_path,
    start_line,
    start_column: 0,
    end_line: start_line,
    end_column: len,
  };
}

function create_variable_definition(
  name: string,
  file_path: FilePath,
  start_line: number,
  is_exported: boolean = true
): VariableDefinition {
  return {
    kind: "variable",
    name: name as SymbolName,
    symbol_id:
      `variable:${file_path}:${start_line}:0:${start_line}:${name.length}:${name}` as SymbolId,
    defining_scope_id: `module:${file_path}` as ScopeId,
    location: make_location(file_path, start_line, name.length),
    is_exported,
  };
}

function create_function_definition(
  name: string,
  file_path: FilePath,
  start_line: number,
  options: {
    is_exported?: boolean;
    is_default?: boolean;
    export_name?: string;
  } = {}
): FunctionDefinition {
  const is_exported = options.is_exported ?? true;
  const export_meta =
    options.is_default || options.export_name
      ? {
          is_default: options.is_default,
          export_name: options.export_name as SymbolName | undefined,
        }
      : undefined;
  return {
    kind: "function",
    name: name as SymbolName,
    symbol_id:
      `function:${file_path}:${start_line}:0:${start_line}:${name.length}:${name}` as SymbolId,
    defining_scope_id: `module:${file_path}` as ScopeId,
    location: make_location(file_path, start_line, name.length),
    is_exported,
    export: export_meta,
    signature: { parameters: [] },
    body_scope_id: `scope:${file_path}:${name}:${start_line}:0` as ScopeId,
  };
}

function create_reexport_definition(
  name: string,
  file_path: FilePath,
  import_path: string,
  start_line: number,
  options: {
    import_kind?: "named" | "default" | "namespace";
    original_name?: string;
    export_name?: string;
  } = {}
): ImportDefinition {
  return {
    kind: "import",
    name: name as SymbolName,
    symbol_id:
      `import:${file_path}:${start_line}:0:${start_line}:${name.length}:${name}` as SymbolId,
    defining_scope_id: `module:${file_path}` as ScopeId,
    location: make_location(file_path, start_line, name.length),
    export: {
      is_reexport: true,
      export_name: options.export_name as SymbolName | undefined,
    },
    import_path: import_path as ModulePath,
    import_kind: options.import_kind ?? "named",
    original_name: options.original_name as SymbolName | undefined,
  };
}

function create_definition_registry(
  by_file: Record<string, ExportableDefinition[]>
): DefinitionRegistry {
  return {
    get_exportable_definitions_in_file: vi.fn(
      (file: FilePath) => by_file[file] ?? []
    ),
  } as Partial<DefinitionRegistry> as DefinitionRegistry;
}

const ROOT_FOLDER: FileSystemFolder = {
  path: "/" as FilePath,
  folders: new Map(),
  files: new Set(["main.ts", "middle.ts", "helper.ts", "a.ts", "b.ts", "c.ts"]),
};

const ALL_TS: ReadonlyMap<FilePath, Language> = new Map<FilePath, Language>([
  ["main.ts" as FilePath, "typescript"],
  ["middle.ts" as FilePath, "typescript"],
  ["helper.ts" as FilePath, "typescript"],
  ["a.ts" as FilePath, "typescript"],
  ["b.ts" as FilePath, "typescript"],
  ["c.ts" as FilePath, "typescript"],
]);

function create_wildcard_reexport_definition(
  file_path: FilePath,
  import_path: string,
  start_line: number
): ImportDefinition {
  const name = import_path.split("/").pop()!.replace(/\.(js|ts)$/, "");
  return {
    kind: "import",
    name: name as SymbolName,
    symbol_id:
      `variable:${file_path}:${start_line}:0:${start_line}:${name.length}:${name}` as SymbolId,
    defining_scope_id: `module:${file_path}` as ScopeId,
    location: make_location(file_path, start_line, name.length),
    export: { is_reexport: true },
    import_path: import_path as ModulePath,
    import_kind: "wildcard",
    original_name: undefined,
  };
}

function resolve_named(
  registry: ExportRegistry,
  file: FilePath,
  name: string
): SymbolId | null {
  return registry.resolve_export_chain(
    file,
    name as SymbolName,
    "named",
    ALL_TS,
    ROOT_FOLDER
  );
}

describe("ExportRegistry", () => {
  const file_id = "helper.ts" as FilePath;

  describe("named exports", () => {
    it("registers an exported function under its name", () => {
      const fn = create_function_definition("greet", file_id, 1);
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      expect(registry.get_exports(file_id)).toEqual(new Set([fn.symbol_id]));
      expect(resolve_named(registry, file_id, "greet")).toBe(fn.symbol_id);
    });

    it("omits non-exported definitions", () => {
      const hidden = create_variable_definition("secret", file_id, 1, false);
      const registry = new ExportRegistry();
      registry.update_file(
        file_id,
        create_definition_registry({ [file_id]: [hidden] })
      );

      expect(registry.get_exports(file_id)).toEqual(new Set());
      expect(resolve_named(registry, file_id, "secret")).toBeNull();
    });

    it("registers multiple named exports independently", () => {
      const a = create_function_definition("alpha", file_id, 1);
      const b = create_variable_definition("beta", file_id, 2);
      const registry = new ExportRegistry();
      registry.update_file(
        file_id,
        create_definition_registry({ [file_id]: [a, b] })
      );

      expect(registry.get_exports(file_id)).toEqual(
        new Set([a.symbol_id, b.symbol_id])
      );
      expect(resolve_named(registry, file_id, "alpha")).toBe(a.symbol_id);
      expect(resolve_named(registry, file_id, "beta")).toBe(b.symbol_id);
    });

    it("keys an aliased export by its export name, not its definition name", () => {
      const fn = create_function_definition("internal", file_id, 1, {
        export_name: "external",
      });
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      expect(resolve_named(registry, file_id, "external")).toBe(fn.symbol_id);
      expect(resolve_named(registry, file_id, "internal")).toBeNull();
    });
  });

  describe("default exports", () => {
    it("resolves a default export regardless of the requested name", () => {
      const fn = create_function_definition("thing", file_id, 1, {
        is_default: true,
      });
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      const resolved = registry.resolve_export_chain(
        file_id,
        "ignored" as SymbolName,
        "default",
        ALL_TS,
        ROOT_FOLDER
      );
      expect(resolved).toBe(fn.symbol_id);
      expect(registry.get_exports(file_id)).toEqual(new Set([fn.symbol_id]));
    });

    it("throws when a file declares two default exports", () => {
      const first = create_function_definition("first", file_id, 1, {
        is_default: true,
      });
      const second = create_function_definition("second", file_id, 2, {
        is_default: true,
      });
      const registry = new ExportRegistry();

      expect(() =>
        registry.update_file(
          file_id,
          create_definition_registry({ [file_id]: [first, second] })
        )
      ).toThrow(/Multiple default exports/);
    });

    it("returns null for a default lookup when the file has no default export", () => {
      const fn = create_function_definition("named_only", file_id, 1);
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      const resolved = registry.resolve_export_chain(
        file_id,
        "named_only" as SymbolName,
        "default",
        ALL_TS,
        ROOT_FOLDER
      );
      expect(resolved).toBeNull();
    });
  });

  describe("resolve_sole_default_export", () => {
    it("returns the default when it is the file's only export", () => {
      const fn = create_function_definition("Widget", file_id, 1, {
        is_default: true,
      });
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      expect(
        registry.resolve_sole_default_export(file_id, ALL_TS, ROOT_FOLDER)
      ).toBe(fn.symbol_id);
    });

    it("returns null for an object module with only named exports", () => {
      const a = create_function_definition("helper", file_id, 1);
      const b = create_function_definition("process", file_id, 2);
      const registry = new ExportRegistry();
      registry.update_file(
        file_id,
        create_definition_registry({ [file_id]: [a, b] })
      );

      expect(
        registry.resolve_sole_default_export(file_id, ALL_TS, ROOT_FOLDER)
      ).toBeNull();
    });

    it("returns null when a default coexists with a named export", () => {
      const def = create_function_definition("Widget", file_id, 1, {
        is_default: true,
      });
      const named = create_function_definition("helper", file_id, 2);
      const registry = new ExportRegistry();
      registry.update_file(
        file_id,
        create_definition_registry({ [file_id]: [def, named] })
      );

      expect(
        registry.resolve_sole_default_export(file_id, ALL_TS, ROOT_FOLDER)
      ).toBeNull();
    });
  });

  describe("duplicate handling", () => {
    it("throws on two exported functions sharing a name", () => {
      const a = create_function_definition("dup", "app.ts" as FilePath, 1);
      const b = create_function_definition("dup", "app.ts" as FilePath, 5);
      const registry = new ExportRegistry();

      expect(() =>
        registry.update_file(
          "app.ts" as FilePath,
          create_definition_registry({ "app.ts": [a, b] })
        )
      ).toThrow(/Duplicate export name "dup"/);
    });

    it("exports the last of a Python @overload group rather than aborting the file", () => {
      // `@overload def f(...)` declares the name once per signature before the
      // implementation. Throwing here blanked the whole file: every definition,
      // reference and edge in it was lost.
      const first = create_function_definition("f", "app.py" as FilePath, 1);
      const second = create_function_definition("f", "app.py" as FilePath, 5);
      const implementation = create_function_definition(
        "f",
        "app.py" as FilePath,
        9
      );
      const registry = new ExportRegistry();

      registry.update_file(
        "app.py" as FilePath,
        create_definition_registry({ "app.py": [first, second, implementation] })
      );

      expect(resolve_named(registry, "app.py" as FilePath, "f")).toBe(
        implementation.symbol_id
      );
    });

    it("registers every wildcard re-export surface in a package init", () => {
      // `from .a import *` beside `from .b import *` are not competing bindings
      // of one name; throwing here blanked the whole __init__ and every import
      // that arrived through it.
      const first = create_reexport_definition("*", "pkg/__init__.py" as FilePath, "./a", 1);
      const second = create_reexport_definition("*", "pkg/__init__.py" as FilePath, "./b", 2);
      const registry = new ExportRegistry();

      registry.update_file(
        "pkg/__init__.py" as FilePath,
        create_definition_registry({ "pkg/__init__.py": [first, second] })
      );

      expect(registry.get_exports("pkg/__init__.py" as FilePath)).toEqual(
        new Set([first.symbol_id, second.symbol_id])
      );
    });

    it("still throws when one Python definition is captured twice at one location", () => {
      // Same name, same location, is not a rebinding — it is the indexing bug
      // the duplicate-export error exists to surface.
      const once = create_function_definition("dup", "app.py" as FilePath, 3);
      const twice = create_function_definition("dup", "app.py" as FilePath, 3);
      const registry = new ExportRegistry();

      expect(() =>
        registry.update_file(
          "app.py" as FilePath,
          create_definition_registry({ "app.py": [once, twice] })
        )
      ).toThrow(/Duplicate export name "dup"/);
    });

    it("prefers a variable over a function of the same name (function seen first)", () => {
      const fn = create_function_definition("handler", "app.ts" as FilePath, 1);
      const variable = create_variable_definition(
        "handler",
        "app.ts" as FilePath,
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "app.ts" as FilePath,
        create_definition_registry({ "app.ts": [fn, variable] })
      );

      expect(resolve_named(registry, "app.ts" as FilePath, "handler")).toBe(
        variable.symbol_id
      );
    });

    it("prefers a variable over a function of the same name (variable seen first)", () => {
      const variable = create_variable_definition(
        "handler",
        "app.ts" as FilePath,
        1
      );
      const fn = create_function_definition("handler", "app.ts" as FilePath, 1);
      const registry = new ExportRegistry();
      registry.update_file(
        "app.ts" as FilePath,
        create_definition_registry({ "app.ts": [variable, fn] })
      );

      expect(resolve_named(registry, "app.ts" as FilePath, "handler")).toBe(
        variable.symbol_id
      );
    });
  });

  describe("Python module-level reassignment", () => {
    const py_file = "test.py" as FilePath;

    it("exports the later definition when a variable is reassigned", () => {
      const var1 = create_variable_definition("predictions", py_file, 10);
      const var2 = create_variable_definition("predictions", py_file, 20);
      const registry = new ExportRegistry();
      registry.update_file(
        py_file,
        create_definition_registry({ [py_file]: [var1, var2] })
      );

      expect(registry.get_exports(py_file)).toEqual(new Set([var2.symbol_id]));
    });

    it("keeps only the last of several reassignments", () => {
      const var1 = create_variable_definition("x", py_file, 5);
      const var2 = create_variable_definition("x", py_file, 10);
      const var3 = create_variable_definition("x", py_file, 15);
      const registry = new ExportRegistry();
      registry.update_file(
        py_file,
        create_definition_registry({ [py_file]: [var1, var2, var3] })
      );

      expect(registry.get_exports(py_file)).toEqual(new Set([var3.symbol_id]));
    });

    it("prefers the higher line number when definitions arrive out of order", () => {
      const var1 = create_variable_definition("data", py_file, 100);
      const var2 = create_variable_definition("data", py_file, 50);
      const registry = new ExportRegistry();
      registry.update_file(
        py_file,
        create_definition_registry({ [py_file]: [var1, var2] })
      );

      expect(registry.get_exports(py_file)).toEqual(new Set([var1.symbol_id]));
    });

    it("tracks reassignment per name across interleaved variables", () => {
      const x1 = create_variable_definition("x", py_file, 1);
      const y1 = create_variable_definition("y", py_file, 2);
      const x2 = create_variable_definition("x", py_file, 3);
      const z1 = create_variable_definition("z", py_file, 4);
      const y2 = create_variable_definition("y", py_file, 5);
      const registry = new ExportRegistry();
      registry.update_file(
        py_file,
        create_definition_registry({ [py_file]: [x1, y1, x2, z1, y2] })
      );

      expect(registry.get_exports(py_file)).toEqual(
        new Set([x2.symbol_id, y2.symbol_id, z1.symbol_id])
      );
    });
  });

  describe("re-export chains", () => {
    it("follows a single re-export hop to the source symbol", () => {
      const foo = create_function_definition("foo", "helper.ts" as FilePath, 1);
      const reexport = create_reexport_definition(
        "foo",
        "main.ts" as FilePath,
        "./helper",
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "helper.ts" as FilePath,
        create_definition_registry({ "helper.ts": [foo] })
      );
      registry.update_file(
        "main.ts" as FilePath,
        create_definition_registry({ "main.ts": [reexport] })
      );

      expect(resolve_named(registry, "main.ts" as FilePath, "foo")).toBe(
        foo.symbol_id
      );
    });

    it("follows a multi-hop re-export chain to the ultimate source", () => {
      const foo = create_function_definition("foo", "helper.ts" as FilePath, 1);
      const middle = create_reexport_definition(
        "foo",
        "middle.ts" as FilePath,
        "./helper",
        1
      );
      const main = create_reexport_definition(
        "foo",
        "main.ts" as FilePath,
        "./middle",
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "helper.ts" as FilePath,
        create_definition_registry({ "helper.ts": [foo] })
      );
      registry.update_file(
        "middle.ts" as FilePath,
        create_definition_registry({ "middle.ts": [middle] })
      );
      registry.update_file(
        "main.ts" as FilePath,
        create_definition_registry({ "main.ts": [main] })
      );

      expect(resolve_named(registry, "main.ts" as FilePath, "foo")).toBe(
        foo.symbol_id
      );
    });

    it("follows a re-export whose source name is aliased", () => {
      const original = create_function_definition(
        "original",
        "helper.ts" as FilePath,
        1
      );
      const reexport = create_reexport_definition(
        "renamed",
        "main.ts" as FilePath,
        "./helper",
        1,
        { original_name: "original" }
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "helper.ts" as FilePath,
        create_definition_registry({ "helper.ts": [original] })
      );
      registry.update_file(
        "main.ts" as FilePath,
        create_definition_registry({ "main.ts": [reexport] })
      );

      expect(resolve_named(registry, "main.ts" as FilePath, "renamed")).toBe(
        original.symbol_id
      );
    });

    it("returns null for a circular re-export", () => {
      const from_b = create_reexport_definition(
        "x",
        "a.ts" as FilePath,
        "./b",
        1
      );
      const from_a = create_reexport_definition(
        "x",
        "b.ts" as FilePath,
        "./a",
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "a.ts" as FilePath,
        create_definition_registry({ "a.ts": [from_b] })
      );
      registry.update_file(
        "b.ts" as FilePath,
        create_definition_registry({ "b.ts": [from_a] })
      );

      expect(resolve_named(registry, "a.ts" as FilePath, "x")).toBeNull();
    });

    it("returns null when the re-exporting file's language is unknown", () => {
      const foo = create_function_definition("foo", "helper.ts" as FilePath, 1);
      const reexport = create_reexport_definition(
        "foo",
        "main.ts" as FilePath,
        "./helper",
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "helper.ts" as FilePath,
        create_definition_registry({ "helper.ts": [foo] })
      );
      registry.update_file(
        "main.ts" as FilePath,
        create_definition_registry({ "main.ts": [reexport] })
      );

      const resolved = registry.resolve_export_chain(
        "main.ts" as FilePath,
        "foo" as SymbolName,
        "named",
        new Map(),
        ROOT_FOLDER
      );
      expect(resolved).toBeNull();
    });

    it("lets a local definition shadow a re-exported import of the same name", () => {
      const local = create_function_definition("foo", "main.ts" as FilePath, 5);
      const reexport = create_reexport_definition(
        "foo",
        "main.ts" as FilePath,
        "./helper",
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "main.ts" as FilePath,
        create_definition_registry({ "main.ts": [reexport, local] })
      );

      expect(resolve_named(registry, "main.ts" as FilePath, "foo")).toBe(
        local.symbol_id
      );
    });

    it("keeps an existing local definition over a later re-export of the same name", () => {
      const local = create_function_definition("foo", "main.ts" as FilePath, 5);
      const reexport = create_reexport_definition(
        "foo",
        "main.ts" as FilePath,
        "./helper",
        1
      );
      const registry = new ExportRegistry();
      registry.update_file(
        "main.ts" as FilePath,
        create_definition_registry({ "main.ts": [local, reexport] })
      );

      expect(resolve_named(registry, "main.ts" as FilePath, "foo")).toBe(
        local.symbol_id
      );
    });
  });

  describe("lifecycle", () => {
    it("replaces prior exports when a file is re-indexed", () => {
      const before = create_function_definition("before", file_id, 1);
      const after = create_function_definition("after", file_id, 1);
      const registry = new ExportRegistry();
      registry.update_file(
        file_id,
        create_definition_registry({ [file_id]: [before] })
      );
      registry.update_file(
        file_id,
        create_definition_registry({ [file_id]: [after] })
      );

      expect(registry.get_exports(file_id)).toEqual(new Set([after.symbol_id]));
      expect(resolve_named(registry, file_id, "before")).toBeNull();
      expect(resolve_named(registry, file_id, "after")).toBe(after.symbol_id);
    });

    it("clears one file's exports with remove_file", () => {
      const fn = create_function_definition("gone", file_id, 1);
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      registry.remove_file(file_id);

      expect(registry.get_exports(file_id)).toEqual(new Set());
      expect(resolve_named(registry, file_id, "gone")).toBeNull();
    });

    it("empties every file's exports with clear", () => {
      const a = create_function_definition("a", "a.ts" as FilePath, 1);
      const b = create_function_definition("b", "b.ts" as FilePath, 1);
      const registry = new ExportRegistry();
      registry.update_file(
        "a.ts" as FilePath,
        create_definition_registry({ "a.ts": [a] })
      );
      registry.update_file(
        "b.ts" as FilePath,
        create_definition_registry({ "b.ts": [b] })
      );

      registry.clear();

      expect(registry.get_exports("a.ts" as FilePath)).toEqual(new Set());
      expect(registry.get_exports("b.ts" as FilePath)).toEqual(new Set());
    });
  });

  describe("missing lookups", () => {
    it("returns an empty set for a file with no exports", () => {
      const registry = new ExportRegistry();
      expect(registry.get_exports("unknown.ts" as FilePath)).toEqual(new Set());
    });

    it("returns a defensive copy that callers cannot use to mutate registry state", () => {
      const fn = create_function_definition("keep", file_id, 1);
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      const returned = registry.get_exports(file_id);
      returned.add("injected" as SymbolId);

      expect(registry.get_exports(file_id)).toEqual(new Set([fn.symbol_id]));
    });

    it("returns null when resolving a name the file does not export", () => {
      const fn = create_function_definition("present", file_id, 1);
      const registry = new ExportRegistry();
      registry.update_file(file_id, create_definition_registry({ [file_id]: [fn] }));

      expect(resolve_named(registry, file_id, "absent")).toBeNull();
    });
  });

  describe("wildcard re-export fan-out", () => {
    const MAIN = "main.ts" as FilePath;
    const HELPER = "helper.ts" as FilePath;
    const MIDDLE = "middle.ts" as FilePath;
    const A = "a.ts" as FilePath;
    const B = "b.ts" as FilePath;

    it("resolves a name through a single wildcard edge", () => {
      const foo = create_function_definition("foo", HELPER, 1);
      const star = create_wildcard_reexport_definition(MAIN, "./helper", 1);
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [foo] }));
      registry.update_file(MAIN, create_definition_registry({ [MAIN]: [star] }));

      expect(resolve_named(registry, MAIN, "foo")).toBe(foo.symbol_id);
    });

    it("returns null when two wildcard edges reach different symbols for one name", () => {
      const dup_a = create_function_definition("dup", A, 1);
      const dup_b = create_function_definition("dup", B, 5);
      const registry = new ExportRegistry();
      registry.update_file(A, create_definition_registry({ [A]: [dup_a] }));
      registry.update_file(B, create_definition_registry({ [B]: [dup_b] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [
            create_wildcard_reexport_definition(MAIN, "./a", 1),
            create_wildcard_reexport_definition(MAIN, "./b", 2),
          ],
        })
      );

      expect(resolve_named(registry, MAIN, "dup")).toBeNull();
    });

    it("binds a name when every wildcard path reaches the same symbol", () => {
      const shared = create_function_definition("shared", HELPER, 1);
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [shared] }));
      registry.update_file(
        MIDDLE,
        create_definition_registry({
          [MIDDLE]: [create_wildcard_reexport_definition(MIDDLE, "./helper", 1)],
        })
      );
      registry.update_file(
        A,
        create_definition_registry({
          [A]: [create_wildcard_reexport_definition(A, "./helper", 1)],
        })
      );
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [
            create_wildcard_reexport_definition(MAIN, "./middle", 1),
            create_wildcard_reexport_definition(MAIN, "./a", 2),
          ],
        })
      );

      expect(resolve_named(registry, MAIN, "shared")).toBe(shared.symbol_id);
    });

    it("prefers a file's own named export over a name a wildcard edge also provides", () => {
      const own = create_function_definition("foo", MAIN, 5);
      const foreign = create_function_definition("foo", HELPER, 1);
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [foreign] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [own, create_wildcard_reexport_definition(MAIN, "./helper", 1)],
        })
      );

      expect(resolve_named(registry, MAIN, "foo")).toBe(own.symbol_id);
    });

    it("terminates and returns null for mutually star-re-exporting files", () => {
      const registry = new ExportRegistry();
      registry.update_file(
        A,
        create_definition_registry({
          [A]: [create_wildcard_reexport_definition(A, "./b", 1)],
        })
      );
      registry.update_file(
        B,
        create_definition_registry({
          [B]: [create_wildcard_reexport_definition(B, "./a", 1)],
        })
      );

      expect(resolve_named(registry, A, "x")).toBeNull();
    });

    it("finds a real definition inside a wildcard cycle", () => {
      const only_in_b = create_function_definition("only_in_b", B, 5);
      const registry = new ExportRegistry();
      registry.update_file(
        A,
        create_definition_registry({
          [A]: [create_wildcard_reexport_definition(A, "./b", 1)],
        })
      );
      registry.update_file(
        B,
        create_definition_registry({
          [B]: [only_in_b, create_wildcard_reexport_definition(B, "./a", 1)],
        })
      );

      expect(resolve_named(registry, A, "only_in_b")).toBe(only_in_b.symbol_id);
    });

    it("does not fan a wildcard edge out for a default import", () => {
      const dflt = create_function_definition("main_fn", HELPER, 1, {
        is_default: true,
      });
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [dflt] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [create_wildcard_reexport_definition(MAIN, "./helper", 1)],
        })
      );

      expect(
        registry.resolve_export_chain(
          MAIN,
          "" as SymbolName,
          "default",
          ALL_TS,
          ROOT_FOLDER
        )
      ).toBeNull();
    });

    it("still throws for two genuine duplicate non-wildcard names alongside a wildcard edge", () => {
      const first = create_function_definition("dup", MAIN, 1);
      const second = create_function_definition("dup", MAIN, 5);
      const registry = new ExportRegistry();

      expect(() =>
        registry.update_file(
          MAIN,
          create_definition_registry({
            [MAIN]: [
              first,
              second,
              create_wildcard_reexport_definition(MAIN, "./helper", 9),
            ],
          })
        )
      ).toThrow(/Duplicate export name "dup"/);
    });
  });

  describe("resolve_all_exports", () => {
    const MAIN = "main.ts" as FilePath;
    const HELPER = "helper.ts" as FilePath;
    const A = "a.ts" as FilePath;
    const B = "b.ts" as FilePath;

    function all_export_names(registry: ExportRegistry, file: FilePath): string[] {
      return [...registry.resolve_all_exports(file, ALL_TS, ROOT_FOLDER).keys()].sort();
    }

    it("returns every directly exported name resolved to its symbol", () => {
      const foo = create_function_definition("foo", MAIN, 1);
      const bar = create_variable_definition("bar", MAIN, 2);
      const registry = new ExportRegistry();
      registry.update_file(MAIN, create_definition_registry({ [MAIN]: [foo, bar] }));

      expect(registry.resolve_all_exports(MAIN, ALL_TS, ROOT_FOLDER)).toEqual(
        new Map([
          ["foo", foo.symbol_id],
          ["bar", bar.symbol_id],
        ])
      );
    });

    it("includes names reached through a wildcard edge", () => {
      const foo = create_function_definition("foo", HELPER, 1);
      const own = create_function_definition("local_fn", MAIN, 1);
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [foo] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [own, create_wildcard_reexport_definition(MAIN, "./helper", 2)],
        })
      );

      expect(registry.resolve_all_exports(MAIN, ALL_TS, ROOT_FOLDER)).toEqual(
        new Map([
          ["local_fn", own.symbol_id],
          ["foo", foo.symbol_id],
        ])
      );
    });

    it("drops a name two wildcard edges disagree on and keeps the rest", () => {
      const dup_a = create_function_definition("dup", A, 1);
      const keep_a = create_function_definition("keep", A, 2);
      const dup_b = create_function_definition("dup", B, 5);
      const registry = new ExportRegistry();
      registry.update_file(A, create_definition_registry({ [A]: [dup_a, keep_a] }));
      registry.update_file(B, create_definition_registry({ [B]: [dup_b] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [
            create_wildcard_reexport_definition(MAIN, "./a", 1),
            create_wildcard_reexport_definition(MAIN, "./b", 2),
          ],
        })
      );

      expect(all_export_names(registry, MAIN)).toEqual(["keep"]);
    });

    it("returns the updated surface after a wildcard target is re-indexed", () => {
      const old_fn = create_function_definition("old_fn", HELPER, 1);
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [old_fn] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [create_wildcard_reexport_definition(MAIN, "./helper", 1)],
        })
      );
      expect(all_export_names(registry, MAIN)).toEqual(["old_fn"]);

      const new_fn = create_function_definition("new_fn", HELPER, 1);
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [new_fn] }));

      expect(all_export_names(registry, MAIN)).toEqual(["new_fn"]);
    });

    it("returns an empty surface for a wildcard target removed from the registry", () => {
      const gone = create_function_definition("gone", HELPER, 1);
      const registry = new ExportRegistry();
      registry.update_file(HELPER, create_definition_registry({ [HELPER]: [gone] }));
      registry.update_file(
        MAIN,
        create_definition_registry({
          [MAIN]: [create_wildcard_reexport_definition(MAIN, "./helper", 1)],
        })
      );
      expect(all_export_names(registry, MAIN)).toEqual(["gone"]);

      registry.remove_file(HELPER);

      expect(all_export_names(registry, MAIN)).toEqual([]);
    });

    it("returns an empty surface after clear", () => {
      const fn = create_function_definition("fn_a", MAIN, 1);
      const registry = new ExportRegistry();
      registry.update_file(MAIN, create_definition_registry({ [MAIN]: [fn] }));
      expect(all_export_names(registry, MAIN)).toEqual(["fn_a"]);

      registry.clear();

      expect(all_export_names(registry, MAIN)).toEqual([]);
    });
  });
});
