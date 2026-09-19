/**
 * One end-to-end case per evidence corpus, at the `Project` tier.
 *
 * The ten corpora under `~/.ariadne/triage-entrypoints/repos/` are where this
 * pipeline's resolution defects were found, and `benchmark_corpus_load`'s
 * recorded rows pin what each of them resolves as a whole. A count cannot say
 * which shape moved, and a corpus cannot be loaded in a unit test, so each
 * corpus is also represented here by the one construct its false positives
 * came from, reduced to the smallest project that still exercises it.
 *
 * A case names its corpus and the file the shape was read from. When the shape
 * needs more than one file it comes from a committed fixture directory, so the
 * source a reader compares against the real corpus is on disk rather than
 * inside an assertion.
 */

import { describe, it, expect, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Project } from "./project";
import type { FilePath, SymbolId } from "@ariadnejs/types";

const FIXTURES_ROOT = path.join(__dirname, "../../tests/fixtures");

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** A project on disk, ingested in bulk, which is the driver a corpus load uses. */
async function load_project(
  files: Readonly<Record<string, string>>
): Promise<{ project: Project; paths: Record<string, FilePath> }> {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "corpus-evidence-")));
  temp_dirs.push(dir);
  const paths: Record<string, FilePath> = {};
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(dir, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
    paths[relative] = absolute as FilePath;
  }
  const project = new Project();
  await project.initialize(dir as FilePath);
  for (const [relative, content] of Object.entries(files)) {
    project.ingest_file(paths[relative], content);
  }
  project.resolve_corpus();
  return { project, paths };
}

/** Every file of a committed fixture directory, keyed by its path inside it. */
function read_fixture(language: string, name: string): Record<string, string> {
  const root = path.join(FIXTURES_ROOT, language, "code", "integration", name);
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files[path.relative(root, absolute)] = fs.readFileSync(absolute, "utf-8");
    }
  };
  walk(root);
  return files;
}

/** One committed fixture file, under the name a case gives it in its project. */
function read_fixture_file(language: string, relative: string): string {
  return fs.readFileSync(
    path.join(FIXTURES_ROOT, language, "code", "integration", relative),
    "utf-8"
  );
}

/**
 * The targets of the one call to `name` on 1-based `line`, named by the last
 * segment of the symbol id and the file it is defined in — which is what a
 * reader checks against the corpus, where two files often declare the name.
 */
function targets_of(
  project: Project,
  file: FilePath,
  name: string,
  line: number
): readonly string[] {
  const calls = project.resolutions
    .get_calls_for_file(file)
    .filter((call) => call.name === name && call.location.start_line === line);
  expect(calls.length).toBe(1);
  return calls[0].resolutions.map((resolution) => name_of(resolution.symbol_id)).sort();
}

/** Every target of every call to `name` in `file`, deduplicated and sorted. */
function all_targets_of(project: Project, file: FilePath, name: string): readonly string[] {
  const targets = new Set<string>();
  for (const call of project.resolutions.get_calls_for_file(file)) {
    if (call.name !== name) continue;
    for (const resolution of call.resolutions) targets.add(name_of(resolution.symbol_id));
  }
  return [...targets].sort();
}

/** `<file>:<name>` — the two fields that identify a definition to a reader. */
function name_of(symbol_id: SymbolId): string {
  const parts = String(symbol_id).split(":");
  const name = parts[parts.length - 1];
  const file = path.basename(parts.slice(1, -5).join(":"));
  return `${file}:${name}`;
}

/** Whether the graph still reports `name`, defined in `file`, as an entry point. */
function is_entry_point(project: Project, file: FilePath, name: string): boolean {
  return project
    .get_call_graph()
    .entry_points.some((id) => name_of(id) === `${path.basename(file)}:${name}`);
}

describe("the evidence corpora, one shape each", () => {
  it("angular: every implementer of an interface named through a namespace import answers its dispatch", async () => {
    // compiler/src/output/abstract_emitter.ts — `implements o.TypeVisitor`,
    // where no file names `TypeVisitor` unqualified.
    const files = read_fixture("typescript", "heritage_namespace_visitor");
    const { project, paths } = await load_project(files);

    expect(targets_of(project, paths["output_ast.ts"], "visitBuiltinType", 15)).toEqual([
      "abstract_emitter.ts:visitBuiltinType",
      "output_ast.ts:visitBuiltinType",
      "translator.ts:visitBuiltinType",
      "type_translator.ts:visitBuiltinType",
    ]);
  });

  it("rustc: a crate-root type's methods are reached from the submodule impl blocks that declare them", async () => {
    // rustc_ast_lowering — `LoweringContext` in the crate root, `impl
    // LoweringContext` in path.rs, the caller in a third file.
    const files = read_fixture("rust", "cross_file_impl_lowering");
    const { project, paths } = await load_project(files);

    expect(targets_of(project, paths["visit.rs"], "lower_path", 8)).toEqual(["path.rs:lower_path"]);
    expect(targets_of(project, paths["visit.rs"], "resolve", 9)).toEqual(["path.rs:resolve"]);
    expect(is_entry_point(project, paths["path.rs"], "lower_path")).toBe(false);
  });

  it("tokio and sqlx: a self receiver hops through two types' impl blocks", async () => {
    // sqlx-postgres/src/types/cube.rs — `self.header().encoded_size()`, each
    // method declared in its own type's impl block.
    const { project, paths } = await load_project({
      "lib.rs": "mod cube;\n",
      "cube.rs": `pub struct PgCube {
    dims: u8,
}

impl PgCube {
    fn header(&self) -> Header {
        Header { size: self.dims }
    }

    pub fn total(&self) -> u8 {
        self.header().encoded_size()
    }
}

pub struct Header {
    size: u8,
}

impl Header {
    fn encoded_size(&self) -> u8 {
        self.size
    }
}
`,
    });

    expect(targets_of(project, paths["cube.rs"], "header", 11)).toEqual(["cube.rs:header"]);
    expect(targets_of(project, paths["cube.rs"], "encoded_size", 11)).toEqual([
      "cube.rs:encoded_size",
    ]);
  });

  it("TypeScript: a parameter annotated through a namespace barrel answers its method call", async () => {
    // A `vfs.FileSystem` annotation whose declaration is two `export *` hops
    // away, and the same type named by an inline `import("…")` annotation.
    const files = read_fixture("typescript", "annotation_namespace_barrel");
    const { project, paths } = await load_project(files);

    expect(targets_of(project, paths["consumer.ts"], "read_file", 7)).toEqual([
      "leaf.ts:read_file",
    ]);
    expect(targets_of(project, paths["consumer.ts"], "read_file", 11)).toEqual([
      "leaf.ts:read_file",
    ]);
  });

  it("django: a construction types its variable and dispatches to the constructor that runs", async () => {
    // A class declaring no `__init__` of its own: the construction names the
    // inherited one, and the variable still answers the subclass's methods.
    const { project, paths } = await load_project({
      "forms.py": `class BaseForm:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    def is_valid(self):
        return True


class ContactForm(BaseForm):
    def clean(self):
        return {}
`,
      "views.py": `from forms import ContactForm


def post():
    form = ContactForm(data={})
    form.clean()
    form.is_valid()
`,
    });

    expect(targets_of(project, paths["views.py"], "ContactForm", 5)).toEqual([
      "forms.py:__init__",
    ]);
    expect(targets_of(project, paths["views.py"], "clean", 6)).toEqual(["forms.py:clean"]);
    expect(targets_of(project, paths["views.py"], "is_valid", 7)).toEqual(["forms.py:is_valid"]);
  });

  it("pandas: a factory's declared class return types the variable it is constructed from", async () => {
    // pandas/io/html.py — `parser = _parser_dispatch(flavor); p = parser(io)`,
    // where the factory is annotated `-> type[_HtmlFrameParser]`.
    const source = read_fixture_file("python", "initialiser_capture/html.py");
    const { project, paths } = await load_project({ "html.py": source });

    expect(targets_of(project, paths["html.py"], "parse_tables", 38)).toEqual([
      "html.py:parse_tables",
    ]);
    expect(targets_of(project, paths["html.py"], "execute", 43)).toEqual(["html.py:execute"]);
  });

  it("celery: a function held on an attribute is reachable through the attribute that carries it", async () => {
    // celery/worker/consumer/consumer.py — `self.loop = loops.asynloop if hub
    // else loops.synloop`, called as `c.loop(...)` from another class.
    const files = read_fixture("python", "value_source");
    const { project, paths } = await load_project(files);

    expect(is_entry_point(project, paths["worker/loops.py"], "synloop")).toBe(false);
    expect(is_entry_point(project, paths["worker/loops.py"], "asynloop")).toBe(false);
  });

  it("celery: a class declaring only a constructor is found from the scope its constructor body opens", async () => {
    // celery/security/certificate.py:100 — the enclosing class is reached from
    // a constructor body, which contributes no member to the member index.
    const { project, paths } = await load_project({
      "certificate.py": `class CertStore:
    def __init__(self):
        self._certs = {}
        self.add_cert(None)

    def add_cert(self, cert):
        self._certs[cert] = cert
`,
    });

    expect(targets_of(project, paths["certificate.py"], "add_cert", 4)).toEqual([
      "certificate.py:add_cert",
    ]);
  });

  it("express: methods assigned onto an exported object are reached through the object", async () => {
    // lib/application.js:294 — `app.engine = function engine(…)`, dispatched
    // as `app.engine(…)` after the object has been exported whole.
    const source = read_fixture_file("javascript", "express_application.js");
    const { project, paths } = await load_project({ "application.js": source });

    expect(all_targets_of(project, paths["application.js"], "engine")).toEqual([
      "application.js:engine",
    ]);
    expect(is_entry_point(project, paths["application.js"], "engine")).toBe(false);
  });

  it("express: a prototype mixed into a function keeps the mixed-in members reachable", async () => {
    // lib/express.js — `var proto = require('./application'); mixin(app, proto,
    // false)`, after which nothing names the mixed-in methods directly.
    const files = {
      "mixin_express.js": read_fixture_file("javascript", "mixin_express.js"),
      "mixin_application.js": read_fixture_file("javascript", "mixin_application.js"),
    };
    const { project, paths } = await load_project(files);

    expect(is_entry_point(project, paths["mixin_application.js"], "engine")).toBe(false);
  });

  it("mocha: a method call on one element of a JSDoc-typed array answers the element's type", async () => {
    // lib/interfaces/common.js — `@param {Suite[]} suites` with
    // `suites[0].afterEach(fn)`, and bdd.js's `var s = suites[0]` hop.
    const files = read_fixture("javascript", "container_elements");
    const { project, paths } = await load_project(files);

    expect(targets_of(project, paths["common.js"], "afterEach", 12)).toEqual([
      "suite.js:afterEach",
    ]);
    expect(targets_of(project, paths["bdd.js"], "addTest", 14)).toEqual(["suite.js:addTest"]);
  });

  it("webpack: a private field's initialiser types the receiver of its method call", async () => {
    // lib/Compilation.js — `#tm = new TransactionManager()` reached as
    // `this.#tm.getTransaction()`, beside the plain-field constructor form.
    const source = read_fixture_file("javascript", "initialiser_capture/compilation.js");
    const { project, paths } = await load_project({ "compilation.js": source });

    expect(targets_of(project, paths["compilation.js"], "getTransaction", 24)).toEqual([
      "compilation.js:getTransaction",
    ]);
    expect(targets_of(project, paths["compilation.js"], "split", 25)).toEqual([
      "compilation.js:split",
    ]);
    expect(targets_of(project, paths["compilation.js"], "connect", 26)).toEqual([
      "compilation.js:connect",
    ]);
  });
});
