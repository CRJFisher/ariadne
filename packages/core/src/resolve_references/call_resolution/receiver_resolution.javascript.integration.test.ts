/**
 * Integration tests for TASK-350.1 — JavaScript parameters typed only through a
 * JSDoc `@param {T} name` tag as method-call receivers.
 *
 * The evidence case reproduces webpack's buildChunkGraph: a function parameter
 * carries its declared type purely in a JSDoc `@param {ModuleGraph} g` tag (pure
 * JS has no `: T` annotation). Before the fix the parameter's declared type was
 * dropped at indexing time, the receiver call `g.getParentBlockIndex()` could not
 * resolve, and the called member was reported as an unreachable entry point (a
 * false positive). These tests assert the member is reachable now that the JSDoc
 * param type survives indexing — and they fail if the core fix is reverted, since
 * the member would reappear as an entry point.
 *
 * The fixtures live under
 * tests/fixtures/javascript/code/integration/jsdoc_param_types/ and span two
 * files that import each other, copied into an isolated temp dir per test to keep
 * cross-file resolution self-contained.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../../project/project";
import type { FilePath, SymbolName, CallGraph } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const FIXTURE_DIR = path.join(
  __dirname,
  "../../../tests/fixtures/javascript/code/integration/jsdoc_param_types"
);

function load_fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

/**
 * Writes the named fixtures into a temp dir, then loads them into a Project so
 * cross-file imports resolve against an isolated tree.
 */
async function project_from_fixtures(
  names: string[]
): Promise<{ project: Project; file_paths: Record<string, FilePath> }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-task350-1-"));
  temp_dirs.push(temp_dir);

  const file_paths: Record<string, FilePath> = {};
  for (const name of names) {
    const abs_path = path.join(temp_dir, name);
    fs.writeFileSync(abs_path, load_fixture(name));
    file_paths[name] = abs_path as FilePath;
  }

  const project = new Project();
  await project.initialize(temp_dir as FilePath);
  for (const name of names) {
    project.update_file(file_paths[name], load_fixture(name));
  }

  return { project, file_paths };
}

/**
 * An entry point is a false positive here iff the named member in the given file
 * is reported as uncalled. Returns the matching entry point's SymbolId, or
 * undefined when the member is reachable (the post-fix expectation).
 */
function entry_point_for(
  call_graph: CallGraph,
  member: string,
  file: FilePath
): string | undefined {
  return call_graph.entry_points.find((ep) => {
    const node = call_graph.nodes.get(ep);
    return (
      node?.name === (member as SymbolName) &&
      node.location.file_path === file
    );
  });
}

/**
 * Asserts the member is a real graph node AND is not reported as an entry
 * point. The node-presence guard stops the entry-point check from passing
 * vacuously if the member ever disappears from the graph entirely.
 */
function assert_member_reachable(
  call_graph: CallGraph,
  member: string,
  file: FilePath
): void {
  const node_present = Array.from(call_graph.nodes.values()).some(
    (n) => n.name === (member as SymbolName) && n.location.file_path === file
  );
  expect(node_present).toBe(true);
  expect(entry_point_for(call_graph, member, file)).toBeUndefined();
}

/**
 * Loads one inline JavaScript source into an isolated Project, so a snippet
 * exercises the full index → resolve → call-graph pipeline without a committed
 * fixture.
 */
async function project_from_inline(
  source: string
): Promise<{ project: Project; file: FilePath }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-task376-5-"));
  temp_dirs.push(temp_dir);
  const file = path.join(temp_dir, "subject.js") as FilePath;
  fs.writeFileSync(file, source);

  const project = new Project();
  await project.initialize(temp_dir as FilePath);
  project.update_file(file, source);
  return { project, file };
}

/**
 * The self type is read off the scope tree, so a `this` receiver names its class
 * whatever the class body holds and wherever in the body the call sits. Each
 * case here is a shape that left the type unnameable while it was inferred by
 * scanning the class's members back through the name-keyed member index.
 */
describe("JavaScript this-receiver resolution through the scope's self type (TASK-376.5)", () => {
  // webpack lib/Module.js:304/:317 — the accessor pair lands in the by-scope
  // index under one name, so the member the pair shadowed decided the answer.
  it("resolves this.method() in a class whose accessor pair precedes the caller", async () => {
    const { project, file } = await project_from_inline(`
class Module {
  get needBuild() {
    return this._needBuild;
  }
  set needBuild(value) {
    this._needBuild = value;
  }
  build() {
    this.doBuild();
  }
  doBuild() {}
}

new Module().build();
`);

    assert_member_reachable(project.get_call_graph(), "doBuild", file);
  });

  // TASK-374.6 item 1 — a constructor body is not a member body, so no scan seed
  // covered it.
  it("resolves this.method() called from a constructor body", async () => {
    const { project, file } = await project_from_inline(`
class Runner {
  constructor() {
    this.start();
  }
  start() {}
}

new Runner();
`);

    assert_member_reachable(project.get_call_graph(), "start", file);
  });

  it("does not bind a constructor's this.method() to a same-named method of an unrelated class", async () => {
    const { project, file } = await project_from_inline(`
class Runner {
  constructor() {
    this.start();
  }
  start() {}
}

class Unrelated {
  start() {}
}

new Runner();
`);
    const call_graph = project.get_call_graph();

    const starts = Array.from(call_graph.nodes.values())
      .filter(
        (n) =>
          n.name === ("start" as SymbolName) &&
          n.location.file_path === file
      )
      .sort((a, b) => a.location.start_line - b.location.start_line);
    expect(starts.length).toBe(2);
    const [runner_start, unrelated_start] = starts;

    const constructor_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("constructor" as SymbolName) && n.location.file_path === file
    );
    expect(constructor_node).toBeDefined();
    const start_call = constructor_node!.enclosed_calls.find(
      (c) => c.name === ("start" as SymbolName)
    );
    expect(start_call).toBeDefined();

    expect(start_call!.resolutions.map((r) => r.symbol_id)).toEqual([
      runner_start.symbol_id,
    ]);
    expect(call_graph.entry_points).toContain(unrelated_start.symbol_id);
  });

  // TASK-374.6 item 2 — a field initialiser runs in the class body scope, which
  // the scan reached only through a member it did not have.
  it("resolves this.method() inside a class-field initialiser", async () => {
    const { project, file } = await project_from_inline(`
class Config {
  value = this.compute();
  compute() {
    return 1;
  }
}

new Config();
`);

    assert_member_reachable(project.get_call_graph(), "compute", file);
  });

  // A type is declared outside the body that records its name, so a member
  // named after its own class can only shadow the declaration. Resolving the
  // recorded name from inside the body would bind `this` to the member.
  it("resolves this.method() in a class with a field named after the class", async () => {
    const { project, file } = await project_from_inline(`
class Foo {
  Foo = 5;
  method() {
    this.other();
  }
  other() {}
}

new Foo().method();
`);

    assert_member_reachable(project.get_call_graph(), "other", file);
  });

  it("resolves this.method() in a class with a method named after the class", async () => {
    const { project, file } = await project_from_inline(`
class Foo {
  Foo() {}
  method() {
    this.other();
  }
  other() {}
}

new Foo().method();
`);

    assert_member_reachable(project.get_call_graph(), "other", file);
  });

  // express lib/view.js — the members are folded onto the holder, but the call
  // sits in the holder's own body rather than in any member's, so binding this
  // to the collection needs the holder itself.
  it("resolves this.method() in a constructor function whose members are prototype-assigned", async () => {
    const { project, file } = await project_from_inline(`
function View(name) {
  this.lookup(name);
}

View.prototype.lookup = function (name) {
  return name;
};

new View("index");
`);
    const call_graph = project.get_call_graph();

    // The assigned function is the collection member, and it is a graph node
    // under its own anonymous identity rather than under the property name.
    const assigned = Array.from(call_graph.nodes.values()).find(
      (n) => n.location.file_path === file && n.location.start_line === 6
    );
    expect(assigned).toBeDefined();

    const view = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("View" as SymbolName) && n.location.file_path === file
    );
    expect(view).toBeDefined();
    const lookup_call = view!.enclosed_calls.find(
      (c) => c.name === ("lookup" as SymbolName)
    );
    expect(lookup_call).toBeDefined();

    expect(lookup_call!.resolutions.map((r) => r.symbol_id)).toEqual([
      assigned!.symbol_id,
    ]);
    expect(call_graph.entry_points).not.toContain(assigned!.symbol_id);
  });
});

describe("JavaScript JSDoc @param receiver resolution (TASK-350.1)", () => {
  it("getParentBlockIndex is reachable via a JSDoc @param {ModuleGraph}-typed receiver", async () => {
    const { project, file_paths } = await project_from_fixtures([
      "module_graph.js",
      "build_chunk_graph.js",
    ]);
    const call_graph = project.get_call_graph();

    assert_member_reachable(
      call_graph,
      "getParentBlockIndex",
      file_paths["module_graph.js"]
    );
  });

  it("buildChunkGraph's g.getParentBlockIndex() call resolves to the ModuleGraph method", async () => {
    const { project, file_paths } = await project_from_fixtures([
      "module_graph.js",
      "build_chunk_graph.js",
    ]);
    const call_graph = project.get_call_graph();

    const caller = Array.from(call_graph.nodes.values()).find(
      (n) =>
        n.name === ("buildChunkGraph" as SymbolName) &&
        n.location.file_path === file_paths["build_chunk_graph.js"]
    );
    expect(caller).toBeDefined();

    const target = Array.from(call_graph.nodes.values()).find(
      (n) =>
        n.name === ("getParentBlockIndex" as SymbolName) &&
        n.location.file_path === file_paths["module_graph.js"]
    );
    expect(target).toBeDefined();

    const call = caller!.enclosed_calls.find(
      (c) => c.name === ("getParentBlockIndex" as SymbolName)
    );
    expect(call).toBeDefined();
    expect(
      call!.resolutions.some((r) => r.symbol_id === target!.symbol_id)
    ).toBe(true);
  });
});
