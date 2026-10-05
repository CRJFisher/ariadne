import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../../project/project";
import type { FilePath, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * A call on one element of a container resolves against the element's type,
 * end to end: index → TypeRegistry element fact → element read → call edge.
 * Every case is an evidence shape: mocha's suite stacks, vscode's
 * `DisposableMap<string, IEditorContribution>`, a Python list and dict, a Rust
 * `Vec` and `HashMap`. Each unresolved case is a read that yields no element —
 * a non-literal key, a key, an entry — or a container that is not its element.
 */
describe("container element receivers through the project pipeline", () => {
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

  /** `sources`, keyed by file name, written to a fresh directory and loaded into one project. */
  async function load_sources(sources: Record<string, string>): Promise<LoadedFixture> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "container-elements-")));
    temp_dirs.push(dir);
    const paths: Record<string, FilePath> = {};
    for (const [name, source] of Object.entries(sources)) {
      paths[name] = path.join(dir, name) as FilePath;
      fs.writeFileSync(paths[name], source);
    }
    const project = new Project();
    await project.initialize(dir as FilePath);
    for (const [name, source] of Object.entries(sources)) {
      project.update_file(paths[name], source);
    }
    return { project, paths, sources };
  }

  /** Every file of the `container_elements` fixture for `language`, loaded into one project. */
  async function load_fixture(language: string): Promise<LoadedFixture> {
    const root = path.join(FIXTURES_ROOT, language, "code", "integration", "container_elements");
    const sources: Record<string, string> = {};
    for (const name of fs.readdirSync(root)) {
      sources[name] = fs.readFileSync(path.join(root, name), "utf-8");
    }
    return load_sources(sources);
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
    const lines = sources[file]
      .split("\n")
      .flatMap((line, index) => (line.includes(text) ? [index + 1] : []));
    expect(lines.length).toBe(1);
    const calls = project.resolutions
      .get_calls_for_file(paths[file])
      .filter((call) => call.name === name && call.location.start_line === lines[0]);
    expect(calls.length).toBe(1);
    const failure = calls[0].resolution_failure;
    return {
      targets: calls[0].resolutions.map((resolution) => resolution.symbol_id),
      failed_at: failure ? `${failure.stage}/${failure.reason}` : undefined,
    };
  }

  /** The member `member` of the class or interface `type_name` that `file` declares. */
  function member_of({ project, paths }: LoadedFixture, file: string, type_name: string, member: string): SymbolId {
    const index = project.get_index_single_file(paths[file]);
    const type = [...(index?.classes.values() ?? []), ...(index?.interfaces.values() ?? [])].find(
      (definition) => definition.name === type_name
    );
    const member_id = type
      ? project.definitions.get_member_index().get(type.symbol_id)?.get(member as SymbolName)
      : undefined;
    if (!member_id) throw new Error(`${type_name} has no member ${member}`);
    return member_id;
  }

  function resolved_to(...targets: SymbolId[]): { targets: readonly SymbolId[]; failed_at: undefined } {
    return { targets, failed_at: undefined };
  }

  const UNRESOLVED = { targets: [], failed_at: "type_inference/receiver_type_unknown" };

  describe("javascript (mocha)", () => {
    it("resolves suites[0].afterEach() through a `@param {Suite[]} suites` element", async () => {
      const fixture = await load_fixture("javascript");

      expect(call_on_line(fixture, "common.js", "afterEach", "suites[0].afterEach")).toEqual(
        resolved_to(member_of(fixture, "suite.js", "Suite", "afterEach"))
      );
    });

    it("leaves suites[index].afterEach() unresolved: a non-literal key is dynamic dispatch", async () => {
      const fixture = await load_fixture("javascript");

      expect(call_on_line(fixture, "common.js", "afterEach", "suites[index].afterEach")).toEqual(UNRESOLVED);
    });

    it("resolves suites[0].beforeAll() through the element `var suites = [suite]` holds", async () => {
      const fixture = await load_fixture("javascript");

      expect(call_on_line(fixture, "exports.js", "beforeAll", "suites[0].beforeAll")).toEqual(
        resolved_to(member_of(fixture, "suite.js", "Suite", "beforeAll"))
      );
    });

    it("resolves `var s = suites[0]; s.addTest(t)` to Suite.addTest, with no edge to the element identifier", async () => {
      const fixture = await load_fixture("javascript");

      expect(call_on_line(fixture, "bdd.js", "addTest", "s.addTest")).toEqual(
        resolved_to(member_of(fixture, "suite.js", "Suite", "addTest"))
      );
    });

    it("types `var suites = [new Suite('root')]` as holding Suites, never as a Suite", async () => {
      const fixture = await load_fixture("javascript");
      const { project, paths } = fixture;
      const suite_id = [...project.get_index_single_file(paths["suite.js"])!.classes.values()][0].symbol_id;
      const suites_id = [...project.get_index_single_file(paths["root.js"])!.variables.values()].find(
        (variable) => variable.name === "suites"
      )!.symbol_id;

      expect({
        type: project.types.get_symbol_type(suites_id),
        element: project.types.get_container_element(suites_id),
        before_all: call_on_line(fixture, "root.js", "beforeAll", "suites[0].beforeAll"),
        push: call_on_line(fixture, "root.js", "push", "suites.push"),
      }).toEqual({
        type: null,
        element: { shape: "sequence", element: suite_id },
        before_all: resolved_to(member_of(fixture, "suite.js", "Suite", "beforeAll")),
        push: UNRESOLVED,
      });
    });
  });

  describe("typescript (vscode DisposableMap)", () => {
    function dispose_targets(fixture: LoadedFixture): readonly SymbolId[] {
      return [
        member_of(fixture, "contributions.ts", "IEditorContribution", "dispose"),
        member_of(fixture, "contributions.ts", "MarkerDecorations", "dispose"),
      ];
    }

    it("disposes the value half of each entry a `DisposableMap<string, IEditorContribution>` member iterates", async () => {
      const fixture = await load_fixture("typescript");

      expect(call_on_line(fixture, "contributions.ts", "dispose", "instance.dispose()")).toEqual(
        resolved_to(...dispose_targets(fixture))
      );
    });

    it("disposes the element get() reads off a `DisposableMap` member", async () => {
      const fixture = await load_fixture("typescript");

      expect(call_on_line(fixture, "contributions.ts", "dispose", "this._instances.get(id)!.dispose()")).toEqual(
        resolved_to(...dispose_targets(fixture))
      );
    });

    it("disposes each value of a `Map<string, IEditorContribution>` and the element get() reads", async () => {
      const fixture = await load_fixture("typescript");

      expect({
        values: call_on_line(fixture, "contributions.ts", "dispose", "pending.dispose()"),
        get: call_on_line(fixture, "contributions.ts", "dispose", "contributions.get(id)!.dispose()"),
      }).toEqual({
        values: resolved_to(...dispose_targets(fixture)),
        get: resolved_to(...dispose_targets(fixture)),
      });
    });

    it("resolves this.cursors[0] through the element a field's array literal constructs, leaving a computed index unresolved", async () => {
      const fixture = await load_fixture("typescript");

      expect({
        literal: call_on_line(fixture, "cursors.ts", "asCursorState", "this.cursors[0].asCursorState()"),
        computed: call_on_line(fixture, "cursors.ts", "setState", "this.cursors[index + 1].setState()"),
      }).toEqual({
        literal: resolved_to(member_of(fixture, "cursors.ts", "Cursor", "asCursorState")),
        computed: UNRESOLVED,
      });
    });

    it("leaves an entry a Map iterates untyped: an entry is not the element", async () => {
      const fixture = await load_fixture("typescript");

      expect(call_on_line(fixture, "contributions.ts", "toString", "entry.toString()")).toEqual(UNRESOLVED);
    });
  });

  describe("python", () => {
    it("resolves a list[Suite] element read by index, by iteration and through enumerate()", async () => {
      const fixture = await load_fixture("python");

      expect({
        index: call_on_line(fixture, "suites.py", "run", "suites[0].run()"),
        loop: call_on_line(fixture, "suites.py", "close", "suite.close()"),
        enumerated: call_on_line(fixture, "suites.py", "reset", "counted.reset()"),
      }).toEqual({
        index: resolved_to(member_of(fixture, "suites.py", "Suite", "run")),
        loop: resolved_to(member_of(fixture, "suites.py", "Suite", "close")),
        enumerated: resolved_to(member_of(fixture, "suites.py", "Suite", "reset")),
      });
    });

    it("resolves a dict[str, Suite] element read by literal key, values(), items() and get()", async () => {
      const fixture = await load_fixture("python");

      expect({
        key: call_on_line(fixture, "suites.py", "reset", "named[\"root\"].reset()"),
        values: call_on_line(fixture, "suites.py", "resume", "each_value.resume()"),
        items: call_on_line(fixture, "suites.py", "report", "entry_value.report()"),
        get: call_on_line(fixture, "suites.py", "run", "found.run()"),
      }).toEqual({
        key: resolved_to(member_of(fixture, "suites.py", "Suite", "reset")),
        values: resolved_to(member_of(fixture, "suites.py", "Suite", "resume")),
        items: resolved_to(member_of(fixture, "suites.py", "Suite", "report")),
        get: resolved_to(member_of(fixture, "suites.py", "Suite", "run")),
      });
    });

    it("leaves a non-literal key and a dict's own iteration, which yields keys, unresolved", async () => {
      const fixture = await load_fixture("python");

      expect({
        dynamic_key: call_on_line(fixture, "suites.py", "pause", "named[key].pause()"),
        key_loop: call_on_line(fixture, "suites.py", "close", "each_key.close()"),
      }).toEqual({ dynamic_key: UNRESOLVED, key_loop: UNRESOLVED });
    });

    it("types `literal = [Suite()]` as holding Suites, never as a Suite", async () => {
      const fixture = await load_fixture("python");
      const { project, paths } = fixture;
      const suite_id = [...project.get_index_single_file(paths["suites.py"])!.classes.values()][0].symbol_id;
      const literal_id = [...project.get_index_single_file(paths["suites.py"])!.variables.values()].find(
        (variable) => variable.name === "literal"
      )!.symbol_id;

      expect({
        type: project.types.get_symbol_type(literal_id),
        element: project.types.get_container_element(literal_id),
        element_call: call_on_line(fixture, "suites.py", "reset", "literal[0].reset()"),
        container_call: call_on_line(fixture, "suites.py", "append", "literal.append(Suite())"),
      }).toEqual({
        type: null,
        element: { shape: "sequence", element: suite_id },
        element_call: resolved_to(member_of(fixture, "suites.py", "Suite", "reset")),
        container_call: UNRESOLVED,
      });
    });

    it("types a list of namespace constructions by the class the chain names, never by a function it names", async () => {
      const fixture = await load_sources({
        "models.py": `class User:
    def greet(self):
        pass

def make():
    return User("made")
`,
        "main.py": `import models

users = [models.User("a"), models.User("b")]
made = [models.make()]
mixed = [models.User("a"), models.make()]
users[0].greet()
made[0].greet()
mixed[0].greet()
`,
      });

      expect({
        users: call_on_line(fixture, "main.py", "greet", "users[0].greet()"),
        made: call_on_line(fixture, "main.py", "greet", "made[0].greet()"),
        mixed: call_on_line(fixture, "main.py", "greet", "mixed[0].greet()"),
      }).toEqual({
        users: resolved_to(member_of(fixture, "models.py", "User", "greet")),
        made: UNRESOLVED,
        mixed: UNRESOLVED,
      });
    });
  });

  describe("rust", () => {
    it("resolves a Vec<Layer> element a loop takes by reference, from a field, through iter() or through enumerate()", async () => {
      const fixture = await load_fixture("rust");
      const apply = member_of(fixture, "layers.rs", "Layer", "apply");

      expect({
        field: call_on_line(fixture, "layers.rs", "apply", "by_ref.apply()"),
        iter: call_on_line(fixture, "layers.rs", "apply", "by_iter.apply()"),
        enumerated: call_on_line(fixture, "layers.rs", "apply", "counted.apply()"),
      }).toEqual({ field: resolved_to(apply), iter: resolved_to(apply), enumerated: resolved_to(apply) });
    });

    it("resolves a HashMap<String, Layer> entry's value and values(), leaving the entry itself unresolved", async () => {
      const fixture = await load_fixture("rust");
      const apply = member_of(fixture, "layers.rs", "Layer", "apply");

      expect({
        entry_value: call_on_line(fixture, "layers.rs", "apply", "entry.apply()"),
        values: call_on_line(fixture, "layers.rs", "apply", "value.apply()"),
        entry: call_on_line(fixture, "layers.rs", "apply", "pair.apply()"),
      }).toEqual({ entry_value: resolved_to(apply), values: resolved_to(apply), entry: UNRESOLVED });
    });
  });

  describe("binding and file lifecycle", () => {
    it("leaves every element unresolved when its literal mixes a construction with a name, and types an all-names literal", async () => {
      const fixture = await load_sources({
        "mixed.ts": `class Suite { run(): void {} }
class Layer { run(): void {} }
function make_layer(): Layer { return new Layer(); }
const layer = make_layer();
const items = [new Suite(), layer];
items[0].run();
items[1].run();
const layers = [layer];
layers[0].run();
`,
      });

      expect({
        constructed: call_on_line(fixture, "mixed.ts", "run", "items[0].run()"),
        named: call_on_line(fixture, "mixed.ts", "run", "items[1].run()"),
        all_names: call_on_line(fixture, "mixed.ts", "run", "layers[0].run()"),
      }).toEqual({
        constructed: UNRESOLVED,
        named: UNRESOLVED,
        all_names: resolved_to(member_of(fixture, "mixed.ts", "Layer", "run")),
      });
    });

    it("stops rather than recurring on a loop binding whose container chain starts at itself", async () => {
      const fixture = await load_sources({
        "walk.js": `function walk(node) {
  for (node of node.children) {
    node.visit();
  }
}
`,
      });

      expect(call_on_line(fixture, "walk.js", "visit", "node.visit()")).toEqual(UNRESOLVED);
    });

    it("re-derives a container's element when the file declaring its annotation is edited", async () => {
      const before = `class Suite { run(): void {} }
class Layer { run(): void {} }
export function run_all(items: Suite[]): void {
  for (const item of items) {
    item.run();
  }
}
`;
      const fixture = await load_sources({ "run_all.ts": before });
      const { project, paths } = fixture;
      const item_run = (source: string) =>
        call_on_line({ ...fixture, sources: { "run_all.ts": source } }, "run_all.ts", "run", "item.run()");
      const initial = item_run(before);

      const retyped = before.replace("items: Suite[]", "items: Layer[]");
      project.update_file(paths["run_all.ts"], retyped);
      const retargeted = item_run(retyped);
      const layer_run = member_of(fixture, "run_all.ts", "Layer", "run");

      const untyped_source = before.replace("items: Suite[]", "items: unknown");
      project.update_file(paths["run_all.ts"], untyped_source);
      const untyped = item_run(untyped_source);

      project.update_file(paths["run_all.ts"], before);

      expect({ initial, retargeted, untyped }).toEqual({
        initial: resolved_to(member_of(fixture, "run_all.ts", "Suite", "run")),
        retargeted: resolved_to(layer_run),
        untyped: UNRESOLVED,
      });
    });
  });
});
