import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { ExportMetadata, FilePath } from "@ariadnejs/types";
import { build_index_single_file } from "../../index_single_file";
import type { ParsedFile } from "../../parsed_file";

type ImportShape = {
  name: string;
  import_path: string;
  import_kind: "named" | "default" | "namespace" | "wildcard";
  original_name: string | undefined;
  export: ExportMetadata | undefined;
};

let parser: Parser;

beforeAll(() => {
  parser = new Parser();
  parser.setLanguage(Python);
});

function index_from_code(code: string) {
  const tree = parser.parse(code);
  const lines = code.split("\n");
  const parsed_file: ParsedFile = {
    file_path: "test.py" as FilePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length ?? 0,
    tree,
    lang: "python",
    source: code,
  };
  return build_index_single_file(parsed_file, tree, "python");
}

function index_imports(code: string): ImportShape[] {
  const index = index_from_code(code);
  return Array.from(index.imported_symbols.values()).map((i) => ({
    name: i.name,
    import_path: i.import_path,
    import_kind: i.import_kind,
    original_name: i.original_name,
    export: i.export,
  }));
}

describe("Python plain imports", () => {
  it("produces a namespace re-export for `import module`", () => {
    expect(index_imports("import os")).toEqual([
      {
        name: "os",
        import_path: "os",
        import_kind: "namespace",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps the full dotted path as name and module_path for `import a.b.c`", () => {
    expect(index_imports("import a.b.c")).toEqual([
      {
        name: "a.b.c",
        import_path: "a.b.c",
        import_kind: "namespace",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("binds the alias and records the source module for `import module as alias`", () => {
    expect(index_imports("import numpy as np")).toEqual([
      {
        name: "np",
        import_path: "numpy",
        import_kind: "namespace",
        original_name: "numpy",
        export: { is_reexport: true },
      },
    ]);
  });

  it("binds the alias for an aliased dotted import `import a.b.c as abc`", () => {
    expect(index_imports("import a.b.c as abc")).toEqual([
      {
        name: "abc",
        import_path: "a.b.c",
        import_kind: "namespace",
        original_name: "a.b.c",
        export: { is_reexport: true },
      },
    ]);
  });
});

describe("Python from-imports", () => {
  it("produces a named import for `from module import name`", () => {
    expect(index_imports("from os import path")).toEqual([
      {
        name: "path",
        import_path: "os",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("binds the alias and records the source name for `from module import name as alias`", () => {
    expect(index_imports("from os import path as p")).toEqual([
      {
        name: "p",
        import_path: "os",
        import_kind: "named",
        original_name: "path",
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps the dotted package path for `from package.module import name`", () => {
    expect(index_imports("from os.path import join")).toEqual([
      {
        name: "join",
        import_path: "os.path",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("produces one symbol per name in a parenthesized import list", () => {
    expect(index_imports("from mod import (a, b, c)")).toEqual([
      {
        name: "a",
        import_path: "mod",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
      {
        name: "b",
        import_path: "mod",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
      {
        name: "c",
        import_path: "mod",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("produces a symbol per name mixing plain and aliased in one statement", () => {
    expect(index_imports("from os import a, b as bb")).toEqual([
      {
        name: "a",
        import_path: "os",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
      {
        name: "bb",
        import_path: "os",
        import_kind: "named",
        original_name: "b",
        export: { is_reexport: true },
      },
    ]);
  });
});

describe("Python relative imports", () => {
  it("keeps a bare dot as module_path for `from . import name`", () => {
    expect(index_imports("from . import x")).toEqual([
      {
        name: "x",
        import_path: ".",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps double dots as module_path for `from .. import name`", () => {
    expect(index_imports("from .. import y")).toEqual([
      {
        name: "y",
        import_path: "..",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps the dot-prefixed package as module_path for `from .pkg import name`", () => {
    expect(index_imports("from .utils import helper")).toEqual([
      {
        name: "helper",
        import_path: ".utils",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps two-level relative package for `from ..pkg import name`", () => {
    expect(index_imports("from ..pkg import y")).toEqual([
      {
        name: "y",
        import_path: "..pkg",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("preserves every leading dot for a deeply relative import", () => {
    expect(index_imports("from ...deep.pkg import z")).toEqual([
      {
        name: "z",
        import_path: "...deep.pkg",
        import_kind: "named",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });
});

describe("Python star imports", () => {
  it("names a star import for its module and marks it a wildcard edge", () => {
    expect(index_imports("from os import *")).toEqual([
      {
        name: "os",
        import_path: "os",
        import_kind: "wildcard",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("names a relative star import for its last segment and keeps the relative module_path", () => {
    expect(index_imports("from .pkg import *")).toEqual([
      {
        name: "pkg",
        import_path: ".pkg",
        import_kind: "wildcard",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps a bare dot as both module_path and name for a current-package star import", () => {
    expect(index_imports("from . import *")).toEqual([
      {
        name: ".",
        import_path: ".",
        import_kind: "wildcard",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("keeps the re-export marking on a star import of an underscore-prefixed module", () => {
    expect(index_imports("from ._lib import *")).toEqual([
      {
        name: "_lib",
        import_path: "._lib",
        import_kind: "wildcard",
        original_name: undefined,
        export: { is_reexport: true },
      },
    ]);
  });

  it("does not mark a star import inside a function as a re-export", () => {
    expect(index_imports("def f():\n    from os import *")).toEqual([
      {
        name: "os",
        import_path: "os",
        import_kind: "wildcard",
        original_name: undefined,
        export: undefined,
      },
    ]);
  });

  it("keys the wildcard symbol_id on the derived module name", () => {
    const index = index_from_code("from os import *");
    const import_def = Array.from(index.imported_symbols.values())[0]!;

    expect(import_def.symbol_id).toBe("variable:test.py:1:16:1:16:os");
  });
});

describe("Python import export metadata", () => {
  it("does not re-export an underscore-prefixed imported name", () => {
    expect(index_imports("from mod import _private")).toEqual([
      {
        name: "_private",
        import_path: "mod",
        import_kind: "named",
        original_name: undefined,
        export: undefined,
      },
    ]);
  });

  it("does not re-export an import nested inside a function", () => {
    expect(index_imports("def f():\n    import inner")).toEqual([
      {
        name: "inner",
        import_path: "inner",
        import_kind: "namespace",
        original_name: undefined,
        export: undefined,
      },
    ]);
  });
});

describe("Python aliased import symbol identity", () => {
  it("keys the symbol_id and location on the alias, not the source module", () => {
    const index = index_from_code("import numpy as np");
    const import_def = Array.from(index.imported_symbols.values())[0]!;

    expect(import_def.symbol_id).toBe("variable:test.py:1:17:1:18:np");
    expect(import_def.location.start_line).toBe(1);
    expect(import_def.location.start_column).toBe(17);
  });
});
