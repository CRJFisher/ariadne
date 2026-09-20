import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../../project/project";
import type { FilePath, IndirectReachability, Location, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * What a binding holds, end to end: index → registries → value source → the
 * receiver, construction, bare call or member read that consumes it. Every case
 * is an evidence shape — sqlalchemy's `mapper_cls = Mapper`, pandas'
 * `_parser_dispatch` factory, celery's `orig = BaseTask.__call__`,
 * `Info=TraceInfo` and `loops.synloop`, django's class-object attributes — and
 * each shape the channel deliberately leaves alone is asserted beside them:
 * a rebinding after the read, a class handed in as an argument, a
 * framework-invoked receiver, an instance called through `__call__`.
 */
describe("value sources through the project pipeline", () => {
  const FIXTURES_ROOT = path.resolve(__dirname, "../../../tests/fixtures");
  const temp_dirs: string[] = [];

  afterAll(() => {
    for (const dir of temp_dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  interface LoadedFixture {
    readonly project: Project;
    readonly paths: Readonly<Record<string, FilePath>>;
    readonly sources: Readonly<Record<string, string>>;
  }

  /**
   * How a project takes in its files: one `update_file` at a time in listed or
   * reversed order, or every file ingested before one `resolve_corpus`.
   */
  type LoadOrder = "listed" | "reversed" | "bulk";

  /** `sources`, keyed by relative path, written to a fresh directory and loaded into one project. */
  async function load_sources(sources: Record<string, string>, order: LoadOrder = "listed"): Promise<LoadedFixture> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "value-sources-")));
    temp_dirs.push(dir);
    const paths: Record<string, FilePath> = {};
    for (const [name, source] of Object.entries(sources)) {
      paths[name] = path.join(dir, name) as FilePath;
      fs.mkdirSync(path.dirname(paths[name]), { recursive: true });
      fs.writeFileSync(paths[name], source);
    }
    const project = new Project();
    await project.initialize(dir as FilePath);
    const entries = Object.entries(sources);
    if (order === "bulk") {
      for (const [name, source] of entries) {
        project.ingest_file(paths[name], source);
      }
      project.resolve_corpus();
    } else {
      for (const [name, source] of order === "reversed" ? entries.reverse() : entries) {
        project.update_file(paths[name], source);
      }
    }
    return { project, paths, sources };
  }

  /** Every file of the `value_source` fixture for `language`, keyed by path relative to the fixture root. */
  async function load_fixture(language: string, order: LoadOrder = "listed"): Promise<LoadedFixture> {
    const root = path.join(FIXTURES_ROOT, language, "code", "integration", "value_source");
    const sources: Record<string, string> = {};
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          sources[path.relative(root, full)] = fs.readFileSync(full, "utf-8");
        }
      }
    };
    walk(root);
    return load_sources(sources, order);
  }

  function line_of(source: string, text: string): number {
    const lines = source.split("\n").flatMap((line, index) => (line.includes(text) ? [index + 1] : []));
    expect(lines.length).toBe(1);
    return lines[0];
  }

  /**
   * What the one call to `name` on the one line of `file` containing `text`
   * resolved to: its targets, and the stage and reason it failed at.
   */
  function call_on_line(
    { project, paths, sources }: LoadedFixture,
    file: string,
    name: string,
    text: string
  ): { targets: readonly SymbolId[]; failed_at: string | undefined } {
    const line = line_of(sources[file], text);
    const calls = project.resolutions
      .get_calls_for_file(paths[file])
      .filter((call) => call.name === name && call.location.start_line === line);
    expect(calls.length).toBe(1);
    const failure = calls[0].resolution_failure;
    return {
      targets: calls[0].resolutions.map((resolution) => resolution.symbol_id),
      failed_at: failure ? `${failure.stage}/${failure.reason}` : undefined,
    };
  }

  function resolved_to(...targets: SymbolId[]): { targets: readonly SymbolId[]; failed_at: undefined } {
    return { targets, failed_at: undefined };
  }

  function class_of({ project, paths }: LoadedFixture, file: string, class_name: string): SymbolId {
    const found = [...(project.get_index_single_file(paths[file])?.classes.values() ?? [])].find(
      (definition) => definition.name === class_name
    );
    if (!found) throw new Error(`${file} declares no class ${class_name}`);
    return found.symbol_id;
  }

  function member_of(fixture: LoadedFixture, file: string, class_name: string, member: string): SymbolId {
    const member_id = fixture.project.definitions
      .get_member_index()
      .get(class_of(fixture, file, class_name))
      ?.get(member as SymbolName);
    if (!member_id) throw new Error(`${class_name} has no member ${member}`);
    return member_id;
  }

  function function_of({ project, paths }: LoadedFixture, file: string, function_name: string): SymbolId {
    const found = [...(project.get_index_single_file(paths[file])?.functions.values() ?? [])].find(
      (definition) => definition.name === function_name
    );
    if (!found) throw new Error(`${file} declares no function ${function_name}`);
    return found.symbol_id;
  }

  /** The binding named `name` that `file` declares on the one line containing `text`. */
  function binding_on_line(fixture: LoadedFixture, file: string, name: string, text: string): SymbolId {
    const line = line_of(fixture.sources[file], text);
    const found = [...(fixture.project.get_index_single_file(fixture.paths[file])?.variables.values() ?? [])].find(
      (definition) => definition.name === name && definition.location.start_line === line
    );
    if (!found) throw new Error(`${file} binds no ${name} on line ${line}`);
    return found.symbol_id;
  }

  describe("python", () => {
    it("constructs the class a local alias holds, for the call the alias reaches before it is rebound", async () => {
      const fixture = await load_fixture("python");

      expect(call_on_line(fixture, "decl_base.py", "mapper_cls", "mapped = mapper_cls(cls, table)")).toEqual(
        resolved_to(class_of(fixture, "decl_base.py", "Mapper"), member_of(fixture, "decl_base.py", "Mapper", "__init__"))
      );
    });

    it("constructs through `cls = Parser` and types the instance the call returns", async () => {
      const fixture = await load_fixture("python");

      expect({
        construction: call_on_line(fixture, "decl_base.py", "cls", "aliased = cls(source)"),
        instance: call_on_line(fixture, "decl_base.py", "parse", "aliased.parse()"),
      }).toEqual({
        construction: resolved_to(
          class_of(fixture, "decl_base.py", "Parser"),
          member_of(fixture, "decl_base.py", "Parser", "__init__")
        ),
        instance: resolved_to(member_of(fixture, "decl_base.py", "Parser", "parse")),
      });
    });

    it("types what calling a `-> type[Parser]` factory's result constructs, and keeps `p: Parser = make()` a Parser", async () => {
      const fixture = await load_fixture("python");
      const parse = member_of(fixture, "decl_base.py", "Parser", "parse");

      expect({
        factory_product: call_on_line(fixture, "decl_base.py", "parse", "produced.parse()"),
        annotated: call_on_line(fixture, "decl_base.py", "parse", "annotated.parse()"),
      }).toEqual({ factory_product: resolved_to(parse), annotated: resolved_to(parse) });
    });

    it("still calls an instance through its `__call__`", async () => {
      const fixture = await load_fixture("python");

      expect(call_on_line(fixture, "decl_base.py", "processor", "return processor(data)")).toEqual(
        resolved_to(member_of(fixture, "decl_base.py", "Processor", "__call__"))
      );
    });

    it("calls the method `orig = BaseTask.__call__` reads, rather than the alias itself", async () => {
      const fixture = await load_fixture("python");

      expect(call_on_line(fixture, "app/trace.py", "orig", "return orig(self")).toEqual(
        resolved_to(member_of(fixture, "app/task.py", "BaseTask", "__call__"))
      );
    });

    it("constructs the class a parameter's default names and types the instance", async () => {
      const fixture = await load_fixture("python");

      expect({
        construction: call_on_line(fixture, "app/trace.py", "Info", "info = Info(\"FAILURE\")"),
        instance: call_on_line(fixture, "app/trace.py", "handle_error_state", "info.handle_error_state(task)"),
      }).toEqual({
        construction: resolved_to(
          class_of(fixture, "app/trace.py", "TraceInfo"),
          member_of(fixture, "app/trace.py", "TraceInfo", "__init__")
        ),
        instance: resolved_to(member_of(fixture, "app/trace.py", "TraceInfo", "handle_error_state")),
      });
    });

    it("types what a class-object attribute constructs, through a module alias, beside `self.session = Store()`", async () => {
      const fixture = await load_fixture("python");

      expect({
        aliased_attribute: call_on_line(fixture, "syndication/views.py", "add_item", "feed.add_item(\"title\")"),
        named_attribute: call_on_line(fixture, "syndication/views.py", "save", "store.save()"),
        constructed_attribute: call_on_line(fixture, "syndication/views.py", "save", "self.session.save()"),
      }).toEqual({
        aliased_attribute: resolved_to(member_of(fixture, "syndication/feedgenerator.py", "SyndicationFeed", "add_item")),
        named_attribute: resolved_to(member_of(fixture, "syndication/views.py", "Store", "save")),
        constructed_attribute: resolved_to(member_of(fixture, "syndication/views.py", "Store", "save")),
      });
    });

    it("keeps `loops.synloop` reachable through the member read, with no call edge for the framework-invoked `c.loop()`", async () => {
      const fixture = await load_fixture("python");
      const reachability = fixture.project.get_call_graph().indirect_reachability;
      const read_of = (member: string): Location => {
        const line = line_of(fixture.sources["worker/consumer.py"], "self.loop = loops");
        const column = fixture.sources["worker/consumer.py"].split("\n")[line - 1].indexOf(`loops.${member}`) + 1;
        return {
          file_path: fixture.paths["worker/consumer.py"],
          start_line: line,
          start_column: column,
          end_line: line,
          end_column: column + `loops.${member}`.length - 1,
        };
      };

      expect({
        synloop: reachability?.get(function_of(fixture, "worker/loops.py", "synloop")),
        asynloop: reachability?.get(function_of(fixture, "worker/loops.py", "asynloop")),
        framework_call: call_on_line(fixture, "worker/consumer.py", "loop", "c.loop("),
      }).toEqual({
        synloop: { reason: { type: "function_reference", read_location: read_of("synloop") } } satisfies IndirectReachability,
        asynloop: { reason: { type: "function_reference", read_location: read_of("asynloop") } } satisfies IndirectReachability,
        framework_call: { targets: [], failed_at: "type_inference/receiver_type_unknown" },
      });
    });

    it("leaves `form_class(**defaults)` at its binding: a class handed in as an argument, then rebound under conditions", async () => {
      const fixture = await load_fixture("python");
      const formfield = [...fixture.project.get_index_single_file(fixture.paths["fields.py"])!.classes.values()]
        .find((definition) => definition.name === "Field")!
        .methods.find((method) => method.name === "formfield")!;
      const form_class_parameter = formfield.parameters.find((parameter) => parameter.name === "form_class")!;

      expect(call_on_line(fixture, "fields.py", "form_class", "return form_class(**defaults)")).toEqual(
        resolved_to(form_class_parameter.symbol_id)
      );
    });

    it("follows the one binding before a rebinding, and neither once the rebinding also precedes the read", async () => {
      const fixture = await load_sources({
        "rebound.py": `class Mapper:
    def __init__(self):
        pass

class ClassicMapper:
    def __init__(self):
        pass

def map_twice():
    mapper_cls = Mapper
    first = mapper_cls()
    mapper_cls = ClassicMapper
    second = mapper_cls()
`,
      });
      const later_binding = binding_on_line(fixture, "rebound.py", "mapper_cls", "mapper_cls = ClassicMapper");

      expect({
        before_rebinding: call_on_line(fixture, "rebound.py", "mapper_cls", "first = mapper_cls()"),
        after_rebinding: call_on_line(fixture, "rebound.py", "mapper_cls", "second = mapper_cls()"),
      }).toEqual({
        before_rebinding: resolved_to(
          class_of(fixture, "rebound.py", "Mapper"),
          member_of(fixture, "rebound.py", "Mapper", "__init__")
        ),
        after_rebinding: resolved_to(later_binding),
      });
    });
  });

  describe("load order", () => {
    /** Every call of the fixture as `file:line name -> targets`, and every indirectly reachable symbol. */
    function resolution_snapshot({ project, paths }: LoadedFixture): { calls: string[]; reachable: string[] } {
      const root = path.dirname(paths["decl_base.py"]);
      const relative = (text: string) => text.split(root + path.sep).join("");
      const calls = Object.entries(paths).flatMap(([name, file]) =>
        project.resolutions
          .get_calls_for_file(file)
          .map(
            (call) =>
              `${name}:${call.location.start_line} ${call.name} -> ${relative(call.resolutions.map((r) => r.symbol_id).join(","))}`
          )
      );
      const reachable = [...(project.get_call_graph().indirect_reachability?.keys() ?? [])].map(relative);
      return { calls: calls.sort(), reachable: reachable.sort() };
    }

    it("resolves the python fixture alike file by file in either order and in bulk", async () => {
      const listed = resolution_snapshot(await load_fixture("python", "listed"));

      expect({
        reversed: resolution_snapshot(await load_fixture("python", "reversed")),
        bulk: resolution_snapshot(await load_fixture("python", "bulk")),
      }).toEqual({ reversed: listed, bulk: listed });
    });
  });

  describe("typescript", () => {
    it("constructs through `const cls = Parser` and types the instance", async () => {
      const fixture = await load_fixture("typescript");

      expect({
        construction: call_on_line(fixture, "parsers.ts", "cls", "new cls(source)"),
        instance: call_on_line(fixture, "parsers.ts", "parse", "return p.parse()"),
      }).toEqual({
        construction: resolved_to(member_of(fixture, "parsers.ts", "Parser", "constructor")),
        instance: resolved_to(member_of(fixture, "parsers.ts", "Parser", "parse")),
      });
    });

    it("constructs the class a `typeof Lexer` factory returns and types the instance", async () => {
      const fixture = await load_fixture("typescript");

      expect({
        construction: call_on_line(fixture, "parsers.ts", "lexer_cls", "new lexer_cls()"),
        instance: call_on_line(fixture, "parsers.ts", "tokenize", "lexer.tokenize()"),
      }).toEqual({
        construction: resolved_to(class_of(fixture, "parsers.ts", "Lexer")),
        instance: resolved_to(member_of(fixture, "parsers.ts", "Lexer", "tokenize")),
      });
    });

    it("types a module member a factory call initialises, reached as a chain hop", async () => {
      const fixture = await load_sources({
        "svc.ts": `export class Svc { run(): void {} }
export function make(): Svc { return new Svc(); }
export const svc = make();
`,
        "app.ts": `import * as registry from "./svc";
export function go(): void { registry.svc.run(); }
`,
      });

      expect(call_on_line(fixture, "app.ts", "run", "registry.svc.run()")).toEqual(
        resolved_to(member_of(fixture, "svc.ts", "Svc", "run"))
      );
    });

    it("types a sequence literal's element when one factory binding fills it twice", async () => {
      const fixture = await load_sources({
        "suites.ts": `class Suite { run(): void {} }
function make(): Suite { return new Suite(); }
export function go(): void {
  const suite = make();
  const suites = [suite, suite];
  suites[0].run();
}
`,
      });

      expect(call_on_line(fixture, "suites.ts", "run", "suites[0].run()")).toEqual(
        resolved_to(member_of(fixture, "suites.ts", "Suite", "run"))
      );
    });

    it("leaves a construction through an unannotated parameter unresolved", async () => {
      const fixture = await load_sources({
        "build.ts": `class Parser { parse(): void {} }
export function build(cls: any): void {
  const p = new cls();
  p.parse();
}
export function run(): void { build(Parser); }
`,
      });

      expect({
        construction: call_on_line(fixture, "build.ts", "cls", "new cls()"),
        instance: call_on_line(fixture, "build.ts", "parse", "p.parse()"),
      }).toEqual({
        construction: {
          targets: [],
          failed_at: "constructor_lookup/constructor_target_not_a_class",
        },
        instance: { targets: [], failed_at: "type_inference/receiver_type_unknown" },
      });
    });
  });
});
