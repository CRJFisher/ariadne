/**
 * JavaScript multi-file integration tests for resolve_references
 *
 * Verifies cross-file import resolution and call detection through the full
 * pipeline using real files in temp directories.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { Project } from "../project/project";
import {
  find_caller_node,
  is_entry_point,
} from "./resolve_references.test";
import type { CallGraph, FilePath, SymbolName } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Helper to set up a project with files already on disk before initialization.
 * The Project scans the file tree at initialize() time, so files must exist first.
 */
async function setup_project(
  files: Record<string, string>
): Promise<{
  project: Project;
  temp_dir: string;
  file_paths: Record<string, FilePath>;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-js-resolve-"));

  const file_paths: Record<string, FilePath> = {};
  for (const [relative_path, content] of Object.entries(files)) {
    const abs_path = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs_path), { recursive: true });
    fs.writeFileSync(abs_path, content);
    file_paths[relative_path] = abs_path as FilePath;
  }

  const project = new Project();
  await project.initialize(temp_dir as FilePath);

  for (const [relative_path, content] of Object.entries(files)) {
    project.update_file(file_paths[relative_path], content);
  }

  return { project, temp_dir, file_paths };
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("JavaScript Multi-File Resolve References Integration", () => {
  describe("cross-file named import + function call", () => {
    it("should resolve named import function call across files", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "utils.js": `export function formatName(name) {
  return name.toUpperCase();
}
`,
        "main.js": `import { formatName } from "./utils";

export function greet(user) {
  return "Hello, " + formatName(user);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // formatName should NOT be an entry point (it's called from main.js)
      const format_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("formatName" as SymbolName) &&
          node.location.file_path === file_paths["utils.js"]
        );
      });
      expect(format_entry).toBeUndefined();
    });

    it("should resolve multiple named imports from the same file", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "math.js": `export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
`,
        "calc.js": `import { add, multiply } from "./math";

export function compute(x, y) {
  return add(x, y) + multiply(x, y);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // Both add and multiply should NOT be entry points
      for (const fn_name of ["add", "multiply"]) {
        const entry = call_graph.entry_points.find((ep) => {
          const node = call_graph.nodes.get(ep);
          return (
            node?.name === (fn_name as SymbolName) &&
            node.location.file_path === file_paths["math.js"]
          );
        });
        expect(entry).toBeUndefined();
      }
    });
  });

  describe("cross-file default export + import", () => {
    it("should resolve default export function call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "parser.js": `export default function parse(input) {
  return input.split(",");
}
`,
        "consumer.js": `import parse from "./parser";

export function processInput(raw) {
  return parse(raw);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // parse should NOT be an entry point
      const parse_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("parse" as SymbolName) &&
          node.location.file_path === file_paths["parser.js"]
        );
      });
      expect(parse_entry).toBeUndefined();
    });
  });

  describe("cross-file re-export chain", () => {
    it("should resolve through barrel file re-exports", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib/helpers.js": `export function helper(x) {
  return x + 1;
}
`,
        "lib/index.js": `export { helper } from "./helpers";
`,
        "app.js": `import { helper } from "./lib/index";

export function run(val) {
  return helper(val);
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      const helper_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("helper" as SymbolName) &&
          node.location.file_path === file_paths["lib/helpers.js"]
        );
      });
      expect(helper_entry).toBeUndefined();
    });
  });

  describe("cross-file class instantiation", () => {
    it("should resolve cross-file constructor call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "models/user.js": `export class User {
  constructor(name) {
    this.name = name;
  }

  greet() {
    return "Hi, " + this.name;
  }
}
`,
        "service.js": `import { User } from "./models/user";

export function createUser(name) {
  const user = new User(name);
  return user.greet();
}
`,
      });
      temp_dirs.push(temp_dir);

      // Verify the import resolves in name resolution
      const service_scope = project.scopes.get_file_root_scope(
        file_paths["service.js"]
      );
      expect(service_scope).toBeDefined();

      const resolved_user = project.resolutions.resolve(
        service_scope!.id,
        "User" as SymbolName
      );
      expect(resolved_user).not.toBeNull();
      expect(resolved_user).toContain("User");
    });
  });

  describe("cross-file method call via imported object", () => {
    it("should resolve method calls on imported class instances", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "logger.js": `export class Logger {
  log(msg) {
    console.log(msg);
  }

  warn(msg) {
    console.warn(msg);
  }
}
`,
        "app.js": `import { Logger } from "./logger";

const logger = new Logger();

export function doWork() {
  logger.log("starting");
  logger.warn("done");
}
`,
      });
      temp_dirs.push(temp_dir);

      // The Logger class methods should be detectable via type info
      const logger_index = project.get_index_single_file(file_paths["logger.js"]);
      expect(logger_index).toBeDefined();

      const logger_class = Array.from(logger_index!.classes.values()).find(
        (c) => c.name === ("Logger" as SymbolName)
      );
      expect(logger_class).toBeDefined();

      const type_info = project.get_type_info(logger_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("log" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("warn" as SymbolName)).toBe(true);
    });
  });

  // Same-file binding gaps (task-349.3, Change C): a function declaration hoists
  // out of a nested block to the sibling scopes that lexically reach it.
  describe("hoisted function declarations", () => {
    it("resolves a call to a function hoisted out of a sibling block", async () => {
      // A `function cleanup` declared inside an `if` block is hoisted to the
      // enclosing function scope, so the sibling arrow `() => cleanup()` reaches
      // it. Without hoisting the call would fail with `name_not_in_scope`.
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `export function run(cond) {
  const done = () => cleanup();
  done();
  if (cond) {
    function cleanup() {
      return 1;
    }
  }
}
`,
      });
      temp_dirs.push(temp_dir);

      const cleanup_fn = project.definitions
        .get_definitions_by_name("cleanup" as SymbolName)
        .find((def) => def.location.file_path === file_paths["mod.js"]);
      expect(cleanup_fn).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["mod.js"])
        .find((c) => c.name === ("cleanup" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        cleanup_fn!.symbol_id,
      ]);

      const entry = project
        .get_call_graph()
        .entry_points.find((ep) => ep === cleanup_fn!.symbol_id);
      expect(entry).toBeUndefined();
    });

    it("hoists a function declared several blocks deep", async () => {
      // `deep` is two blocks down (if/if); it still hoists to the function
      // scope so the sibling arrow reaches it.
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `export function run(a, b) {
  const probe = () => deep();
  probe();
  if (a) {
    if (b) {
      function deep() {
        return 1;
      }
    }
  }
}
`,
      });
      temp_dirs.push(temp_dir);

      const deep_fn = project.definitions
        .get_definitions_by_name("deep" as SymbolName)
        .find((def) => def.location.file_path === file_paths["mod.js"]);
      expect(deep_fn).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["mod.js"])
        .find((c) => c.name === ("deep" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        deep_fn!.symbol_id,
      ]);
    });

    it("does not hoist a function across a nested function boundary", async () => {
      // `inner_only` is declared inside `wrapper`'s body — a function scope, not
      // a block. It must NOT hoist into `run`, so the sibling arrow cannot reach
      // it and `inner_only` stays an entry point. This pins the stop-at-function
      // boundary that keeps hoisting from over-reaching.
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `export function run() {
  const probe = () => inner_only();
  probe();
  function wrapper() {
    function inner_only() {
      return 1;
    }
  }
}
`,
      });
      temp_dirs.push(temp_dir);

      const inner_fn = project.definitions
        .get_definitions_by_name("inner_only" as SymbolName)
        .find((def) => def.location.file_path === file_paths["mod.js"]);
      expect(inner_fn).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["mod.js"])
        .find((c) => c.name === ("inner_only" as SymbolName));
      expect(call!.resolutions).toEqual([]);
      expect(call!.resolution_failure?.reason).toEqual("name_not_in_scope");

      const entry = project
        .get_call_graph()
        .entry_points.find((ep) => ep === inner_fn!.symbol_id);
      expect(entry).toEqual(inner_fn!.symbol_id);
    });
  });

  // Variable-bound named function expression (task-355): `var X = function X(){}`
  // registers the outer `X` in the enclosing scope, so intra-file references
  // resolve and `X` is not surfaced as a spurious entry point.
  describe("variable-bound named function expression", () => {
    it("resolves an intra-file bare-name call to the outer function binding", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `var X = function X() {
  return 1;
};

export function run() {
  return X();
}
`,
      });
      temp_dirs.push(temp_dir);

      const call = project.resolutions
        .get_calls_for_file(file_paths["mod.js"])
        .find((c) => c.name === ("X" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.length).toEqual(1);

      // The call resolves to a `X` function definition in this file (the outer
      // var binding registered in the module scope).
      const x_def_ids = project.definitions
        .get_definitions_by_name("X" as SymbolName)
        .filter((def) => def.location.file_path === file_paths["mod.js"])
        .map((def) => def.symbol_id);
      expect(x_def_ids).toContain(call!.resolutions[0].symbol_id);

      const x_entries = project.get_call_graph().entry_points.filter((ep) => {
        const node = project.get_call_graph().nodes.get(ep);
        return (
          node?.name === ("X" as SymbolName) &&
          node.location.file_path === file_paths["mod.js"]
        );
      });
      expect(x_entries).toEqual([]);
    });

    it("keeps a constructor-only var-bound function off the entry-point set", async () => {
      // `Widget` is used only via `new Widget()`. The `new` site's name-resolved
      // read reaches the outer binding, so `Widget` is reachable and not a
      // spurious entry point — the false positive this task removes.
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `var Widget = function Widget() {
  return { ok: true };
};

export function main() {
  return new Widget();
}
`,
      });
      temp_dirs.push(temp_dir);

      // The `new Widget()` site is captured as exactly one call reference.
      const widget_calls = project.resolutions
        .get_calls_for_file(file_paths["mod.js"])
        .filter((c) => c.name === ("Widget" as SymbolName));
      expect(widget_calls.length).toEqual(1);

      const call_graph = project.get_call_graph();
      // The outer binding is a real call-graph node (so the empty entry-point
      // result below is non-vacuous), and it is reachable — not an entry point.
      const widget_nodes = Array.from(call_graph.nodes.values()).filter(
        (n) =>
          n.name === ("Widget" as SymbolName) &&
          n.location.file_path === file_paths["mod.js"],
      );
      expect(widget_nodes.length).toEqual(1);
      const widget_entries = call_graph.entry_points.filter((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("Widget" as SymbolName) &&
          node.location.file_path === file_paths["mod.js"]
        );
      });
      expect(widget_entries).toEqual([]);
    });

    it("resolves the self-reference and the outer binding for a distinct inner name", async () => {
      // Inner (`fact`) differs from outer (`factorial`); the body scope is named
      // after the outer var so the outer symbol still owns it. The in-body
      // self-call resolves to the inner expression name.
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `const factorial = function fact(n) {
  return n <= 1 ? 1 : n * fact(n - 1);
};

export function run() {
  return factorial(5);
}
`,
      });
      temp_dirs.push(temp_dir);

      const calls = project.resolutions.get_calls_for_file(file_paths["mod.js"]);
      const outer_call = calls.find(
        (c) => c.name === ("factorial" as SymbolName),
      );
      expect(outer_call!.resolution_failure).toBeUndefined();
      expect(outer_call!.resolutions.length).toEqual(1);
      const self_call = calls.find((c) => c.name === ("fact" as SymbolName));
      expect(self_call!.resolution_failure).toBeUndefined();
      expect(self_call!.resolutions.length).toEqual(1);

      const call_graph = project.get_call_graph();
      const factorial_nodes = Array.from(call_graph.nodes.values()).filter(
        (n) =>
          n.name === ("factorial" as SymbolName) &&
          n.location.file_path === file_paths["mod.js"],
      );
      expect(factorial_nodes.length).toEqual(1);
      const stray_entries = call_graph.entry_points.filter((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          (node?.name === ("factorial" as SymbolName) ||
            node?.name === ("fact" as SymbolName)) &&
          node.location.file_path === file_paths["mod.js"]
        );
      });
      expect(stray_entries).toEqual([]);
    });

    it("indexes an exported binding without a duplicate-export error and exports only the outer name", async () => {
      // The inner expression name is body-local; registering it as an export
      // would collide with the outer name in the export registry and abort
      // indexing. Only the outer name is the module export.
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `export const X = function X() {
  return 1;
};
`,
        "use.js": `import { X } from "./mod.js";

export function run() {
  return X();
}
`,
      });
      temp_dirs.push(temp_dir);

      const call = project.resolutions
        .get_calls_for_file(file_paths["use.js"])
        .find((c) => c.name === ("X" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.length).toEqual(1);
    });

    it("does not export the inner expression name of an exported binding", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `export const outer = function inner() {
  return 1;
};
`,
        "use.js": `import { inner } from "./mod.js";

export function run() {
  return inner();
}
`,
      });
      temp_dirs.push(temp_dir);

      // `inner` is body-local, never a module export, so the import does not
      // resolve to it.
      const call = project.resolutions
        .get_calls_for_file(file_paths["use.js"])
        .find((c) => c.name === ("inner" as SymbolName));
      expect(call!.resolutions).toEqual([]);
      expect(call!.resolution_failure?.reason).toEqual("name_not_in_scope");
    });
  });

  // Self-initializer (task-349.3, Change C.1): a `const x = x(…)` binding does
  // not shadow its own import for the call inside its initializer.
  describe("self-initializer binding", () => {
    it("resolves a self-initializer call to the import, not the local", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "mod.js": `import { has_flatten } from "./helpers.js";

export function build(fields) {
  const has_flatten = has_flatten(fields);
  return has_flatten;
}
`,
        "helpers.js": `export function has_flatten(fields) {
  return fields.length > 0;
}
`,
      });
      temp_dirs.push(temp_dir);

      const imported_fn = project.definitions
        .get_definitions_by_name("has_flatten" as SymbolName)
        .find((def) => def.location.file_path === file_paths["helpers.js"]);
      expect(imported_fn).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["mod.js"])
        .find((c) => c.name === ("has_flatten" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        imported_fn!.symbol_id,
      ]);

      const entry = project
        .get_call_graph()
        .entry_points.find((ep) => ep === imported_fn!.symbol_id);
      expect(entry).toBeUndefined();
    });
  });

  describe("CommonJS response-object methods (expressjs lib/response.js shape)", () => {
    const FIXTURE = path.join(
      __dirname,
      "../../tests/fixtures/javascript/code/integration/commonjs_response_object/response.js"
    );
    let call_graph: CallGraph;
    let file: FilePath;

    beforeAll(async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "response.js": fs.readFileSync(FIXTURE, "utf-8"),
      });
      temp_dirs.push(temp_dir);
      file = file_paths["response.js"];
      call_graph = project.get_call_graph();
    });

    it("marks sendFile reachable through the module.exports read of the res collection", () => {
      const node = find_caller_node(call_graph, "sendFile", file);
      expect(
        call_graph.indirect_reachability?.get(node!.symbol_id)?.reason.type
      ).toEqual("collection_read");
      expect(is_entry_point(call_graph, "sendFile", file)).toEqual(false);
    });

    it("marks append reachable through the module.exports read of the res collection", () => {
      const node = find_caller_node(call_graph, "append", file);
      expect(
        call_graph.indirect_reachability?.get(node!.symbol_id)?.reason.type
      ).toEqual("collection_read");
      expect(is_entry_point(call_graph, "append", file)).toEqual(false);
    });

    it("marks location reachable through the module.exports read of the res collection", () => {
      const node = find_caller_node(call_graph, "location", file);
      expect(
        call_graph.indirect_reachability?.get(node!.symbol_id)?.reason.type
      ).toEqual("collection_read");
      expect(is_entry_point(call_graph, "location", file)).toEqual(false);
    });

    it("resolves the sendfile helper from sendFile and keeps both sendfile callables off the entry-point list", () => {
      const send_file = find_caller_node(call_graph, "sendFile", file);
      const helper = [...call_graph.nodes.values()].find(
        (n) =>
          n.name === ("sendfile" as SymbolName) &&
          n.location.file_path === file &&
          n.location.start_line === 36
      );
      const helper_call = send_file?.enclosed_calls.find(
        (c) => c.name === ("sendfile" as SymbolName)
      );
      expect(helper_call?.resolutions.map((r) => r.symbol_id)).toEqual([
        helper?.symbol_id,
      ]);
      expect(is_entry_point(call_graph, "sendfile", file)).toEqual(false);
    });

    it("resolves the stringify call inside json to the module-scope stringify", () => {
      const json = find_caller_node(call_graph, "json", file);
      const module_stringify = [...call_graph.nodes.values()].find(
        (n) =>
          n.name === ("stringify" as SymbolName) && n.location.file_path === file
      );
      const stringify_call = json?.enclosed_calls.find(
        (c) => c.name === ("stringify" as SymbolName)
      );
      expect(stringify_call?.resolutions.map((r) => r.symbol_id)).toEqual([
        module_stringify?.symbol_id,
      ]);
      expect(is_entry_point(call_graph, "stringify", file)).toEqual(false);
    });
  });

  describe("Value-position callables", () => {
    const ROUTE_FILES = {
      "user.js": [
        "exports.list = function list(req, res) { return res; };",
        "exports.edit = function edit(req, res) { return res; };",
      ].join("\n"),
      "post.js": ["exports.list = function list(req, res) { return res; };"].join(
        "\n"
      ),
      "app.js": [
        "var user = require('./user');",
        "var post = require('./post');",
        "app.get('/users', user.list);",
        "app.get('/user/:id/edit', user.edit);",
        "app.get('/posts', post.list);",
      ].join("\n"),
    };

    it("records a weak edge from a route registration to user.list", async () => {
      const { project, temp_dir, file_paths } = await setup_project(ROUTE_FILES);
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const list = find_caller_node(cg, "list", file_paths["user.js"]);
      expect(
        cg.indirect_reachability?.get(list!.symbol_id)?.reason.type
      ).toEqual("function_reference");
      expect(is_entry_point(cg, "list", file_paths["user.js"])).toEqual(false);
    });

    it("records a weak edge from a route registration to user.edit", async () => {
      const { project, temp_dir, file_paths } = await setup_project(ROUTE_FILES);
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      expect(is_entry_point(cg, "edit", file_paths["user.js"])).toEqual(false);
    });

    it("records a weak edge from a route registration to post.list", async () => {
      const { project, temp_dir, file_paths } = await setup_project(ROUTE_FILES);
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      expect(is_entry_point(cg, "list", file_paths["post.js"])).toEqual(false);
    });

    it("records no call edge for a route handler", async () => {
      const { project, temp_dir, file_paths } = await setup_project(ROUTE_FILES);
      temp_dirs.push(temp_dir);
      const resolved = project.resolutions.get_calls_for_file(
        file_paths["app.js"]
      );
      expect(
        resolved.map((c) => c.name).filter((n) => n !== "require")
      ).toEqual(["get", "get", "get"]);
    });

    it("records a weak edge to a named function expression passed as an argument", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "getter.js": [
          "function defineGetter(obj, name, getter) { return getter; }",
          "defineGetter(req, 'query', function query() { return 1; });",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const file = file_paths["getter.js"];
      const query = find_caller_node(cg, "query", file);
      expect(
        cg.indirect_reachability?.get(query!.symbol_id)?.reason.type
      ).toEqual("function_reference");
      expect(is_entry_point(cg, "query", file)).toEqual(false);
    });

    it("records a weak edge for an object-literal member callable", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "user.js": "exports.list = function list(req, res) { return res; };",
        "routes.js": [
          "var user = require('./user');",
          "register({ handler: user.list });",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      expect(is_entry_point(cg, "list", file_paths["user.js"])).toEqual(false);
    });

    it("records no weak edge for a non-callable member argument", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "config.js": "exports.timeout = 30;",
        "app.js": [
          "var config = require('./config');",
          "app.use(config.timeout);",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const reachable = [...(cg.indirect_reachability?.keys() ?? [])].filter(
        (id) => String(id).includes("config.js")
      );
      expect(reachable).toEqual([]);
    });

    it("keeps a bare identifier callback reachable through exactly one entry", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "cb.js": [
          "function apply(fn, x) { return fn(x); }",
          "function doubler(n) { return n * 2; }",
          "apply(doubler, 21);",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const file = file_paths["cb.js"];
      const doubler = find_caller_node(cg, "doubler", file);
      const entries = [...(cg.indirect_reachability?.keys() ?? [])].filter(
        (id) => id === doubler!.symbol_id
      );
      expect(entries).toEqual([doubler!.symbol_id]);
      expect(is_entry_point(cg, "doubler", file)).toEqual(false);
    });
  });

  describe("parameters of positionally-bound callables reach the receiver", () => {
    function method_call_failure(
      project: Project,
      file: FilePath,
      call_name: string
    ): string | undefined {
      const call = project.resolutions
        .get_calls_for_file(file)
        .find((c) => c.name === (call_name as SymbolName));
      expect(call).toBeDefined();
      return call!.resolution_failure?.reason;
    }

    it("binds a declarator arrow's parameter so a call on it leaves name resolution", async () => {
      // webpack lib/ids/IdHelpers.js:148 — chunkGraph.getChunkRootModules(chunk)
      // inside `const getShortChunkName = (chunk, chunkGraph, …) => {…}`.
      const { project, temp_dir, file_paths } = await setup_project({
        "IdHelpers.js": `const getShortChunkName = (chunk, chunkGraph) => {
  const modules = chunkGraph.getChunkRootModules(chunk);
  return modules;
};

export { getShortChunkName };
`,
      });
      temp_dirs.push(temp_dir);

      expect(
        method_call_failure(project, file_paths["IdHelpers.js"], "getChunkRootModules")
      ).not.toEqual("name_not_in_scope");
    });

    it("binds a whole-module CommonJS export's parameter so a call on it leaves name resolution", async () => {
      // mocha lib/interfaces/common.js:75 — suites[0].beforeEach(name, fn)
      // inside `module.exports = function (suites, context) {…}`.
      const { project, temp_dir, file_paths } = await setup_project({
        "common.js": `module.exports = function (suites, context) {
  suites[0].beforeEach(context);
};
`,
      });
      temp_dirs.push(temp_dir);

      expect(
        method_call_failure(project, file_paths["common.js"], "beforeEach")
      ).not.toEqual("name_not_in_scope");
    });

    it("binds a loop-head name so a call on it resolves", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "loop.js": `export class Handle {
  close() {
    return 1;
  }
}

export function close_all(ps) {
  for (const p of ps) {
    p.close();
  }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect(
        method_call_failure(project, file_paths["loop.js"], "close")
      ).not.toEqual("name_not_in_scope");
    });
  });

  describe("object-literal shorthand methods", () => {
    it("an object-literal method is no callable's own name, so it is not an entry point", async () => {
      const { project, temp_dir } = await setup_project({
        "routes.js": `const routes = { index(req) {}, show(req) {} };
export default routes;
`,
      });
      temp_dirs.push(temp_dir);

      const graph = await project.get_call_graph();
      expect(
        Array.from(graph.nodes.keys())
          .map(String)
          .filter((id) => id.startsWith("function:"))
      ).toEqual([]);
      expect(graph.entry_points).toHaveLength(0);
    });

    it("an object-literal method does not take a same-named import's call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "render.js": `export function render(a) {
  return a;
}
`,
        "app.js": `import { render } from './render.js';
const spec = { render(a) { return a; } };
render(1);
`,
      });
      temp_dirs.push(temp_dir);

      const call = project.resolutions
        .get_calls_for_file(file_paths["app.js"])
        .find((c) => c.name === ("render" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions).toHaveLength(1);
      expect(String(call!.resolutions[0].symbol_id)).toContain("render.js");
    });
  });
});
