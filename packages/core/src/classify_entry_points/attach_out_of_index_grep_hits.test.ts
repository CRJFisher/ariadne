import { describe, it, expect, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import { load_project } from "../project/load_project";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { extract_entry_point_diagnostics } from "./extract_entry_point_diagnostics";
import {
  attach_out_of_index_grep_hits,
  build_class_name_by_constructor_position,
  collect_files_outside_index,
} from "./attach_out_of_index_grep_hits";

const temp_roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temp_roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function write_fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ariadne-out-of-index-"));
  temp_roots.push(root);
  for (const [relative_path, content] of Object.entries(files)) {
    const absolute_path = join(root, relative_path);
    await mkdir(dirname(absolute_path), { recursive: true });
    await writeFile(absolute_path, content, "utf8");
  }
  return root;
}

/**
 * Index with the given scope, then run the out-of-index pass over exactly the
 * residue — the same chain `detect_entrypoints` runs.
 */
async function analyse(
  root: string,
  options: { folders?: string[]; exclude?: string[] } = {},
): Promise<{ entry_points: EnrichedEntryPoint[]; residue: string[] }> {
  const { project, dropped_files } = await load_project({
    project_path: root,
    folders: options.folders,
    exclude: options.exclude,
  });
  const call_graph = trace_call_graph(
    project.definitions,
    project.resolutions,
    project.get_languages(),
    { include_tests: false },
  );
  const entry_points = extract_entry_point_diagnostics(call_graph, project);
  const residue = await collect_files_outside_index(
    root,
    project.get_file_contents(),
    dropped_files,
    [],
  );
  await attach_out_of_index_grep_hits({
    entry_points,
    project_path: root,
    indexed_source_files: project.get_file_contents(),
    dropped_files,
    class_name_by_constructor_position:
      build_class_name_by_constructor_position(project),
    gitignore_patterns: [],
  });
  return {
    entry_points,
    residue: [...residue.keys()].map((f) => f.slice(root.length + 1)).sort(),
  };
}

function entry(entry_points: EnrichedEntryPoint[], name: string): EnrichedEntryPoint {
  const found = entry_points.filter((e) => e.name === name);
  if (found.length !== 1) {
    throw new Error(
      `expected exactly one entry point ${name}, got ${found.length} ` +
        `(${entry_points.map((e) => e.name).join(", ")})`,
    );
  }
  return found[0];
}

describe("the out-of-index set is discovered minus indexed", () => {
  it("finds a caller a config exclude held out (django shape)", async () => {
    const root = await write_fixture({
      "django/db/models/query.py": "def adapt_value(value):\n    return value\n",
      "tests/queries/test_query.py": [
        "from django.db.models.query import adapt_value",
        "",
        "",
        "def test_query():",
        "    return adapt_value(1)",
        "",
      ].join("\n"),
    });

    const { entry_points, residue } = await analyse(root, { exclude: ["tests"] });

    // The exclude removed it from the corpus; it must NOT also remove it from
    // the compensation, or the pass cannot compensate for anything.
    expect(residue).toEqual(["tests/queries/test_query.py"]);
    const adapt_value = entry(entry_points, "adapt_value");
    expect(
      adapt_value.diagnostics.grep_call_sites_outside_index.map((h) => h.content),
    ).toEqual(["return adapt_value(1)"]);
    expect(adapt_value.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
  });

  it("finds a caller a folder scope left outside (celery _LRUpop shape)", async () => {
    const root = await write_fixture({
      "celery/__init__.py": "",
      "celery/utils/__init__.py": "",
      "celery/utils/collections.py": "def _LRUpop(cache):\n    return cache\n",
      "t/__init__.py": "",
      "t/unit/__init__.py": "",
      "t/unit/utils/__init__.py": "",
      "t/unit/utils/test_collections.py": [
        "from celery.utils.collections import _LRUpop",
        "",
        "",
        "def test_lru():",
        "    return _LRUpop(None)",
        "",
      ].join("\n"),
    });

    const { entry_points, residue } = await analyse(root, { folders: ["celery"] });

    // `t/unit/utils` matches no test-directory name — the old segment list
    // could never have reached it.
    expect(residue).toEqual([
      "t/__init__.py",
      "t/unit/__init__.py",
      "t/unit/utils/__init__.py",
      "t/unit/utils/test_collections.py",
    ]);
    const lru = entry(entry_points, "_LRUpop");
    expect(lru.diagnostics.grep_call_sites_outside_index.map((h) => h.content)).toEqual([
      "return _LRUpop(None)",
    ]);
    expect(lru.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
  });

  it("greps a file the loader dropped on an indexing error (express lib/response.js shape)", async () => {
    const root = await write_fixture({
      "lib/utils.js": "export function send_status(code) {\n  return code;\n}\n",
      "lib/response.js": [
        "exports.res = function res() {};",
        "exports.res = function res() {",
        "  return send_status(200);",
        "};",
        "",
      ].join("\n"),
    });

    const { entry_points, residue } = await analyse(root);

    expect(residue).toEqual(["lib/response.js"]);
    const send_status = entry(entry_points, "send_status");
    expect(
      send_status.diagnostics.grep_call_sites_outside_index.map((h) => h.content),
    ).toEqual(["return send_status(200);"]);
    expect(send_status.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
  });

  it("leaves no residue when every discovered file is indexed", async () => {
    const root = await write_fixture({
      "src/a.ts": "export function a(): number {\n  return 1;\n}\n",
      "tests/a.test.ts": [
        "import { a } from \"../src/a\";",
        "",
        "export function covers_a(): number {",
        "  return a();",
        "}",
        "",
      ].join("\n"),
    });

    const { entry_points, residue } = await analyse(root);

    expect(residue).toEqual([]);
    expect(entry_points.map((e) => e.name)).toEqual([]);
  });

  it("does not read a comment or a docstring in a held-out file as a caller", async () => {
    const root = await write_fixture({
      "src/control.py": "def pool_shrink(state):\n    return state\n",
      "tests/notes.py": [
        "# cover pool_shrink() one day",
        "\"\"\"pool_shrink() is documented here.\"\"\"",
        "",
        "VALUE = 1",
        "",
      ].join("\n"),
    });

    const { entry_points } = await analyse(root, { exclude: ["tests"] });

    const pool_shrink = entry(
      entry_points.filter((e) => e.file_path.endsWith("control.py")),
      "pool_shrink",
    );
    expect(pool_shrink.diagnostics.grep_call_sites_outside_index).toEqual([]);
    expect(pool_shrink.diagnostics.diagnosis).toEqual("no-textual-callers");
  });

  it("cannot tell a declaration in a held-out file from a call to it", async () => {
    // The declaration rule keys on `Project.definitions`, and a file that was
    // never indexed contributes none — so a held-out module that redeclares the
    // name reads as a caller. Comment and string qualification still apply
    // (they need only the text), which is why the case above passes. Closing
    // this needs the residue parsed, which is precisely what not indexing it
    // avoided; recorded as a known limit rather than papered over with a
    // `def `/`function ` regex.
    const root = await write_fixture({
      "src/control.py": "def pool_shrink(state):\n    return state\n",
      "tests/stub.py": "def pool_shrink(state):\n    return None\n",
    });

    const { entry_points } = await analyse(root, { exclude: ["tests"] });

    const pool_shrink = entry(
      entry_points.filter((e) => e.file_path.endsWith("control.py")),
      "pool_shrink",
    );
    expect(
      pool_shrink.diagnostics.grep_call_sites_outside_index.map((h) => h.content),
    ).toEqual(["def pool_shrink(state):"]);
    expect(pool_shrink.diagnostics.diagnosis).toEqual("callers-outside-indexed-corpus");
  });

  it("does not read a minified bundle as a caller", async () => {
    // django's bundled `jquery.min.js` fails to index, so it lands in the
    // residue; one enormous line then matches every identifier in it and
    // attributes each as a caller. Skipping it is loud, not silent.
    const minified = `!function(){${"a".repeat(2100)};send_status(1)}();`;
    const root = await write_fixture({
      "lib/utils.js": "export function send_status(code) {\n  return code;\n}\n",
      "vendor/jquery.min.js": minified,
    });

    const { entry_points } = await analyse(root, { exclude: ["vendor"] });

    const send_status = entry(entry_points, "send_status");
    expect(send_status.diagnostics.grep_call_sites_outside_index).toEqual([]);
    expect(send_status.diagnostics.diagnosis).toEqual("no-textual-callers");
  });

  it("caps out-of-index hits per name", async () => {
    const callers: Record<string, string> = {
      "src/target.py": "def widget():\n    return 1\n",
    };
    for (let i = 0; i < 15; i++) {
      callers[`tests/caller_${i}.py`] = `def use_${i}():\n    return widget()\n`;
    }
    const root = await write_fixture(callers);

    const { entry_points } = await analyse(root, { exclude: ["tests"] });

    const widget = entry(
      entry_points.filter((e) => e.file_path.endsWith("target.py")),
      "widget",
    );
    expect(widget.diagnostics.grep_call_sites_outside_index).toHaveLength(10);
  });

  it("greps a constructor by class name", async () => {
    const root = await write_fixture({
      "src/foo.ts": "export class Foo {\n  constructor() {}\n}\n",
      "tests/foo.test.ts": "new Foo();\n",
    });

    const { entry_points } = await analyse(root, { exclude: ["tests"] });
    const ctor = entry_points.find((e) => e.kind === "constructor");
    if (ctor === undefined) throw new Error("expected a constructor entry point");

    expect(ctor.diagnostics.grep_call_sites_outside_index.map((h) => h.content)).toEqual([
      "new Foo();",
    ]);
  });
});
