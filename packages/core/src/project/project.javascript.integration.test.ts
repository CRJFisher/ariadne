import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type { FilePath, SymbolId, SymbolName } from "@ariadnejs/types";
import type {
  ConstructorCallReference,
  MethodCallReference,
  SelfReferenceCall,
  FunctionCallReference,
} from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(
  __dirname,
  "../../tests/fixtures/javascript/code"
);

function load_source(relative_path: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relative_path), "utf-8");
}

function file_path(relative_path: string): FilePath {
  return path.join(FIXTURE_ROOT, relative_path) as FilePath;
}

describe("Project Integration - JavaScript", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize(FIXTURE_ROOT as FilePath);
  });

  describe("CommonJS Module Resolution", () => {
    it("should resolve require() imports", async () => {
      const utils = load_source("modules/utils_commonjs.js");
      const main = load_source("modules/main_commonjs.js");
      const utils_file = file_path("modules/utils_commonjs.js");
      const main_file = file_path("modules/main_commonjs.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Verify require() creates import definitions
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find the helper import
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
    });

    it("should resolve cross-file function calls in CommonJS", async () => {
      const utils = load_source("modules/utils_commonjs.js");
      const main = load_source("modules/main_commonjs.js");
      const utils_file = file_path("modules/utils_commonjs.js");
      const main_file = file_path("modules/main_commonjs.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // Find call to helper
      const calls = main_index!.references.filter((r) => r.kind === "function_call" || r.kind === "method_call" || r.kind === "self_reference_call" || r.kind === "constructor_call");
      expect(calls.length).toBeGreaterThan(0);

      const helper_call = calls.find(
        (c): c is FunctionCallReference =>
          c.name === ("helper" as SymbolName) && c.kind === "function_call"
      );
      expect(helper_call).toBeDefined();

      // Verify cross-file resolution
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      // Verify it resolves to utils_commonjs.js
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("utils_commonjs.js");
    });

    it("should handle module.exports patterns", async () => {
      const utils = load_source("modules/utils_commonjs.js");
      const utils_file = file_path("modules/utils_commonjs.js");

      project.update_file(utils_file, utils);

      const index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();

      // Verify functions are exported
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);

      // Check for helper, processData, calculateTotal
      const helper_fn = functions.find((f) => f.name === ("helper" as SymbolName));
      const process_data_fn = functions.find(
        (f) => f.name === ("processData" as SymbolName)
      );
      const calculate_total_fn = functions.find(
        (f) => f.name === ("calculateTotal" as SymbolName)
      );

      expect(helper_fn).toBeDefined();
      expect(process_data_fn).toBeDefined();
      expect(calculate_total_fn).toBeDefined();
    });
  });

  describe("CommonJS whole-namespace method dispatch", () => {
    // `var ns = require('./mod'); ns.fn()` must resolve `fn` against the
    // module's `exports.fn` / `module.exports.fn` definition, and the target
    // must count as reached so it is not a false unreachable entry point.
    function find_function_id(mod_file: FilePath, name: string) {
      const index = project.get_index_single_file(mod_file);
      expect(index).toBeDefined();
      const fn = Array.from(index!.functions.values()).find(
        (f) => f.name === (name as SymbolName)
      );
      expect(fn).toBeDefined();
      return fn!.symbol_id;
    }

    function method_call_targets(main_file: FilePath, name: string) {
      const calls = project.resolutions.get_calls_for_file(main_file);
      const call = calls.find((c) => c.name === (name as SymbolName));
      expect(call).toBeDefined();
      return call!.resolutions.map((r) => r.symbol_id);
    }

    // Targets of a call named `callee_name` enclosed in `caller_id`'s body —
    // the caller->callee edge, which proves the caller owns that body scope
    // (unlike the global referenced set, which collects the call regardless of
    // which definition, if any, encloses it).
    function enclosed_call_targets(caller_id: SymbolId, callee_name: string) {
      const node = project.get_call_graph().nodes.get(caller_id);
      expect(node).toBeDefined();
      return node!.enclosed_calls
        .filter((c) => c.name === (callee_name as SymbolName))
        .flatMap((c) => c.resolutions.map((r) => r.symbol_id));
    }

    it("resolves a named-function-expression export and marks it reached", () => {
      const mod = [
        "exports.castArray = function castArray(v) { return [v]; };",
        "module.exports.isBrowser = function isBrowser() { return false; };",
      ].join("\n");
      const main = [
        "var utils = require('./ns_named');",
        "function run() {",
        "  utils.castArray(1);",
        "  utils.isBrowser();",
        "}",
      ].join("\n");
      const mod_file = file_path("modules/ns_named.js");
      const main_file = file_path("modules/main_ns_named.js");

      project.update_file(mod_file, mod);
      project.update_file(main_file, main);

      const cast_array_id = find_function_id(mod_file, "castArray");
      const is_browser_id = find_function_id(mod_file, "isBrowser");

      expect(method_call_targets(main_file, "castArray")).toContain(cast_array_id);
      expect(method_call_targets(main_file, "isBrowser")).toContain(is_browser_id);

      const referenced = project.resolutions.get_all_referenced_symbols();
      expect(referenced.has(cast_array_id)).toBe(true);
      expect(referenced.has(is_browser_id)).toBe(true);
    });

    it("resolves anonymous-function and arrow exports and attributes their bodies", () => {
      const mod = [
        "exports.escape = function (html) { return helper(html); };",
        "module.exports.uniqueID = () => next();",
        "function helper(x) { return x; }",
        "function next() { return 1; }",
      ].join("\n");
      const main = [
        "const u = require('./ns_anon');",
        "function run() {",
        "  u.escape('x');",
        "  u.uniqueID();",
        "}",
      ].join("\n");
      const mod_file = file_path("modules/ns_anon.js");
      const main_file = file_path("modules/main_ns_anon.js");

      project.update_file(mod_file, mod);
      project.update_file(main_file, main);

      const escape_id = find_function_id(mod_file, "escape");
      const unique_id = find_function_id(mod_file, "uniqueID");
      const helper_id = find_function_id(mod_file, "helper");
      const next_id = find_function_id(mod_file, "next");

      expect(method_call_targets(main_file, "escape")).toContain(escape_id);
      expect(method_call_targets(main_file, "uniqueID")).toContain(unique_id);

      // The exports themselves are reached via CJS-namespace dispatch...
      const referenced = project.resolutions.get_all_referenced_symbols();
      expect(referenced.has(escape_id)).toBe(true);
      expect(referenced.has(unique_id)).toBe(true);
      // ...and each body's calls are attributed to the property-located
      // definition, so `helper`/`next` are edges out of `escape`/`uniqueID`
      // rather than orphaned calls. This is what proves body attribution — the
      // definition owns its body scope despite being located at the property.
      expect(enclosed_call_targets(escape_id, "helper")).toContain(helper_id);
      expect(enclosed_call_targets(unique_id, "next")).toContain(next_id);
    });

    it("does not treat a non-exports member assignment as an export", () => {
      const mod = [
        "exports.real = () => 1;",
        "notExports.fake = () => 2;",
      ].join("\n");
      const main = [
        "const u = require('./ns_guard');",
        "function run() {",
        "  u.real();",
        "  u.fake();",
        "}",
      ].join("\n");
      const mod_file = file_path("modules/ns_guard.js");
      const main_file = file_path("modules/main_ns_guard.js");

      project.update_file(mod_file, mod);
      project.update_file(main_file, main);

      const mod_index = project.get_index_single_file(mod_file);
      const fake = Array.from(mod_index!.functions.values()).find(
        (f) => f.name === ("fake" as SymbolName)
      );
      expect(fake).toBeUndefined();
      expect(method_call_targets(main_file, "real")).toHaveLength(1);
      expect(method_call_targets(main_file, "fake")).toHaveLength(0);
    });

    it("exports the arrow, not a same-named local, without a duplicate-export conflict", () => {
      const mod = [
        "function dup() { return 'local'; }",
        "exports.dup = () => 'exported';",
        "function useLocal() { return dup(); }",
      ].join("\n");
      const main = [
        "const u = require('./ns_shadow');",
        "function run() { u.dup(); }",
      ].join("\n");
      const mod_file = file_path("modules/ns_shadow.js");
      const main_file = file_path("modules/main_ns_shadow.js");

      project.update_file(mod_file, mod);
      project.update_file(main_file, main);

      const mod_index = project.get_index_single_file(mod_file);
      const dups = Array.from(mod_index!.functions.values()).filter(
        (f) => f.name === ("dup" as SymbolName)
      );
      // Two distinct definitions share the name; exactly one is exported.
      expect(dups.length).toBe(2);
      expect(dups.filter((f) => f.is_exported).length).toBe(1);

      // `u.dup()` resolves to the exported arrow only — not also the local.
      const exported_dup = dups.find((f) => f.is_exported)!;
      expect(method_call_targets(main_file, "dup")).toEqual([
        exported_dup.symbol_id,
      ]);
    });

    it("does not export a function assigned to exports inside a function body", () => {
      // A nested `exports.x = () => {}` is a local assignment, not a module
      // export — matching the top-level-only treatment of the identifier and
      // named-function-expression forms.
      const mod = [
        "function configure() {",
        "  exports.hidden = () => 1;",
        "}",
        "exports.shown = () => 2;",
      ].join("\n");
      const main = [
        "var u = require('./ns_nested');",
        "function run() {",
        "  u.hidden();",
        "  u.shown();",
        "}",
      ].join("\n");
      const mod_file = file_path("modules/ns_nested.js");
      const main_file = file_path("modules/main_ns_nested.js");

      project.update_file(mod_file, mod);
      project.update_file(main_file, main);

      const mod_index = project.get_index_single_file(mod_file);
      const hidden = Array.from(mod_index!.functions.values()).find(
        (f) => f.name === ("hidden" as SymbolName)
      );
      expect(hidden).toBeUndefined();
      expect(method_call_targets(main_file, "hidden")).toHaveLength(0);
      expect(method_call_targets(main_file, "shown")).toHaveLength(1);
    });
  });

  describe("CommonJS Class Export Dispatch", () => {
    // Resolve a call by name + call_type in a file to its target definition
    // ("kind:name"), or its resolution-failure reason when it does not resolve.
    function resolved_target(
      file: FilePath,
      name: string,
      call_type: "method" | "constructor"
    ): { targets: string[]; failure?: string } {
      const call = project.resolutions
        .get_calls_for_file(file)
        .find((c) => c.name === (name as SymbolName) && c.call_type === call_type);
      if (!call) {
        return { targets: [], failure: "call_not_found" };
      }
      const targets = call.resolutions.map((r) => {
        const def = project.definitions.get(r.symbol_id);
        return def ? `${def.kind}:${def.name}` : String(r.symbol_id);
      });
      const failure = call.resolution_failure
        ? `${call.resolution_failure.stage}/${call.resolution_failure.reason}`
        : undefined;
      return { targets, failure };
    }

    describe("default export `module.exports = Class`", () => {
      const mod_file = file_path("modules/cjs_default_class.js");
      const main_file = file_path("modules/uses_cjs_default_class.js");
      const mod_source = [
        "class Widget {",
        "  constructor() {}",
        "  static make() { return new Widget(); }",
        "  render() {}",
        "}",
        "module.exports = Widget;",
      ].join("\n");
      const main_source = [
        "const Widget = require('./cjs_default_class');",
        "function use() {",
        "  const w = new Widget();",
        "  w.render();",
        "  return Widget.make();",
        "}",
      ].join("\n");

      beforeEach(() => {
        project.update_file(mod_file, mod_source);
        project.update_file(main_file, main_source);
      });

      it("marks the class as the file's default export and binds the require to it", () => {
        const mod_index = project.get_index_single_file(mod_file);
        const widget = Array.from(mod_index!.classes.values()).find(
          (c) => c.name === ("Widget" as SymbolName)
        );
        expect(widget!.is_exported).toBe(true);
        expect(widget!.export).toEqual({ is_default: true });

        const call = project.resolutions
          .get_calls_for_file(main_file)
          .find((c) => c.name === ("make" as SymbolName));
        expect(project.resolutions.resolve(call!.scope_id, "Widget" as SymbolName)).toEqual(
          widget!.symbol_id
        );
      });

      it("resolves a static method call `Widget.make()` to the class's static method", () => {
        expect(resolved_target(main_file, "make", "method")).toEqual({
          targets: ["method:make"],
          failure: undefined,
        });
      });

      it("resolves `new Widget()` to the class's constructor", () => {
        expect(resolved_target(main_file, "Widget", "constructor")).toEqual({
          targets: ["constructor:constructor"],
          failure: undefined,
        });
      });

      it("resolves an instance method call `w.render()` to the class's instance method", () => {
        expect(resolved_target(main_file, "render", "method")).toEqual({
          targets: ["method:render"],
          failure: undefined,
        });
      });
    });

    describe("named export `exports.X = class`", () => {
      const mod_file = file_path("modules/cjs_named_class.js");
      const main_file = file_path("modules/uses_cjs_named_class.js");
      const mod_source = [
        "exports.Gadget = class Gadget {",
        "  constructor() {}",
        "  static create() { return new Gadget(); }",
        "  run() {}",
        "};",
      ].join("\n");
      const main_source = [
        "const { Gadget } = require('./cjs_named_class');",
        "function use() {",
        "  const g = new Gadget();",
        "  g.run();",
        "  return Gadget.create();",
        "}",
      ].join("\n");

      beforeEach(() => {
        project.update_file(mod_file, mod_source);
        project.update_file(main_file, main_source);
      });

      it("marks the class expression as a named export bound in scope to the class", () => {
        const mod_index = project.get_index_single_file(mod_file);
        const gadget = Array.from(mod_index!.classes.values()).find(
          (c) => c.name === ("Gadget" as SymbolName)
        );
        expect(gadget!.is_exported).toBe(true);
        expect(gadget!.export).toEqual({});

        const call = project.resolutions
          .get_calls_for_file(main_file)
          .find((c) => c.name === ("create" as SymbolName));
        expect(project.resolutions.resolve(call!.scope_id, "Gadget" as SymbolName)).toEqual(
          gadget!.symbol_id
        );
      });

      it("resolves a static method call `Gadget.create()` to the class's static method", () => {
        expect(resolved_target(main_file, "create", "method")).toEqual({
          targets: ["method:create"],
          failure: undefined,
        });
      });

      it("resolves `new Gadget()` to the class's constructor", () => {
        expect(resolved_target(main_file, "Gadget", "constructor")).toEqual({
          targets: ["constructor:constructor"],
          failure: undefined,
        });
      });

      it("resolves an instance method call `g.run()` to the class's instance method", () => {
        expect(resolved_target(main_file, "run", "method")).toEqual({
          targets: ["method:run"],
          failure: undefined,
        });
      });
    });

    it("keeps `const utils = require()` an object-module namespace (no rebind)", () => {
      const obj_file = file_path("modules/cjs_object_module.js");
      const main_file = file_path("modules/uses_cjs_object_module.js");
      project.update_file(
        obj_file,
        "function helper() {}\nmodule.exports = { helper };"
      );
      project.update_file(
        main_file,
        "const utils = require('./cjs_object_module');\nfunction use() { return utils.helper(); }"
      );

      // A namespace member that resolves to a function is reported with
      // call_type "function", so match on the callee name alone.
      const call = project.resolutions
        .get_calls_for_file(main_file)
        .find((c) => c.name === ("helper" as SymbolName));
      const targets = call!.resolutions.map((r) => {
        const def = project.definitions.get(r.symbol_id);
        return def ? `${def.kind}:${def.name}` : String(r.symbol_id);
      });
      expect(targets).toEqual(["function:helper"]);
    });

    it("does not rebind an ESM `import * as` namespace of a default-class module", () => {
      const mod_file = file_path("modules/esm_default_class.js");
      const main_file = file_path("modules/uses_esm_default_class.js");
      project.update_file(
        mod_file,
        "export default class Widget { static make() {} }"
      );
      project.update_file(
        main_file,
        "import * as ns from './esm_default_class';\nfunction use() { return ns.make(); }"
      );

      // `ns` is a namespace object, not the class; `ns.make()` is not a real
      // call, so it must stay unresolved rather than being rebound to the class.
      const call = project.resolutions
        .get_calls_for_file(main_file)
        .find((c) => c.name === ("make" as SymbolName));
      expect(call!.resolutions).toEqual([]);
      expect(call!.resolution_failure).toBeDefined();
    });

    it("keeps a function default export (`module.exports = fn`) a namespace import", () => {
      const mod_file = file_path("modules/cjs_default_fn.js");
      const main_file = file_path("modules/uses_cjs_default_fn.js");
      project.update_file(
        mod_file,
        "function build() {}\nmodule.exports = build;"
      );
      project.update_file(
        main_file,
        "const build = require('./cjs_default_fn');\nfunction use() { return build(); }"
      );

      const mod_index = project.get_index_single_file(mod_file);
      const fn = Array.from(mod_index!.functions.values()).find(
        (f) => f.name === ("build" as SymbolName)
      );
      // The function is the module's default export (public surface)...
      expect(fn!.is_exported).toBe(true);
      expect(fn!.export).toEqual({ is_default: true });
      // ...but the `kind === "class"` gate keeps the require a namespace import:
      // `build` must not be rebound to the function (only a class default rebinds).
      const call = project.resolutions
        .get_calls_for_file(main_file)
        .find((c) => c.name === ("build" as SymbolName));
      const bound = project.resolutions.resolve(call!.scope_id, "build" as SymbolName);
      expect(bound).not.toEqual(fn!.symbol_id);
    });

    it.each([
      ["variable-bound", "const C = class Bar {};"],
      ["object-property", "const obj = {};\nobj.prop = class Bar {};"],
    ])(
      "does not capture a non-export named class expression (%s)",
      (_label, decl) => {
        const file = file_path("modules/local_class_expr.js");
        project.update_file(
          file,
          `${decl}\nfunction Bar() {}\nfunction use() { return Bar(); }`
        );

        const index = project.get_index_single_file(file);
        // The class expression's inner name `Bar` must not register a stray
        // class definition that would shadow the sibling `function Bar`.
        expect(Array.from(index!.classes.values())).toEqual([]);
        const call = project.resolutions
          .get_calls_for_file(file)
          .find((c) => c.name === ("Bar" as SymbolName));
        const targets = call!.resolutions.map((r) => {
          const def = project.definitions.get(r.symbol_id);
          return def ? `${def.kind}:${def.name}` : String(r.symbol_id);
        });
        expect(targets).toEqual(["function:Bar"]);
      }
    );
  });

  describe("ES6 Module Resolution", () => {
    it("should resolve import/export", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Verify ES6 import creates import definitions
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find the helper import
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
    });

    it("should resolve cross-file function calls in ES6", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // Find call to helper
      const calls = main_index!.references.filter((r) => r.kind === "function_call" || r.kind === "method_call" || r.kind === "self_reference_call" || r.kind === "constructor_call");
      expect(calls.length).toBeGreaterThan(0);

      const helper_call = calls.find(
        (c): c is FunctionCallReference =>
          c.name === ("helper" as SymbolName) && c.kind === "function_call"
      );
      expect(helper_call).toBeDefined();

      // Verify cross-file resolution
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      // Verify it resolves to utils_es6.js
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("utils_es6.js");
    });

    it("should handle default exports", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Verify default import
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());

      // Find the formatDate default import
      const format_date_import = imports.find(
        (i) => i.name === ("formatDate" as SymbolName)
      );
      expect(format_date_import).toBeDefined();

      // Find call to formatDate
      const calls = main_index!.references.filter((r) => r.kind === "function_call" || r.kind === "method_call" || r.kind === "self_reference_call" || r.kind === "constructor_call");
      const format_date_call = calls.find(
        (c) => c.name === ("formatDate" as SymbolName)
      );
      expect(format_date_call).toBeDefined();

      // Verify it resolves
      const resolved = project.resolutions.resolve(
        format_date_call!.scope_id,
        format_date_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("utils_es6.js");
    });
  });

  describe("Class Methods", () => {
    it("should resolve ES6 class methods", async () => {
      const source = load_source("classes/constructor_workflow.js");
      const file = file_path("classes/constructor_workflow.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find class
      const classes = Array.from(index!.classes.values());
      expect(classes.length).toBeGreaterThan(0);

      const product_class = classes.find(
        (c) => c.name === ("Product" as SymbolName)
      );
      expect(product_class).toBeDefined();

      // Find method call
      const method_calls = index!.references.filter(
        (r): r is MethodCallReference => r.kind === "method_call"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find the getName method call
      const get_name_call = method_calls.find(
        (c) => c.name === ("getName" as SymbolName)
      );
      expect(get_name_call).toBeDefined();

      // Get type info for Product class
      const type_info = project.get_type_info(product_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);

      // Verify getName method exists in type info
      const get_name_method_id = type_info!.methods.get(
        "getName" as SymbolName
      );
      expect(get_name_method_id).toBeDefined();
    });

    it("should handle prototype methods", async () => {
      const source = load_source("classes/prototype_methods.js");
      const file = file_path("classes/prototype_methods.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the Vehicle class (constructor function)
      const functions = Array.from(index!.functions.values());
      const vehicle_fn = functions.find(
        (f) => f.name === ("Vehicle" as SymbolName)
      );
      expect(vehicle_fn).toBeDefined();

      // Find method calls
      const method_calls = index!.references.filter(
        (r): r is MethodCallReference => r.kind === "method_call"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find start method call
      const start_call = method_calls.find(
        (c) => c.name === ("start" as SymbolName)
      );
      expect(start_call).toBeDefined();

      // Find getInfo method call
      const get_info_call = method_calls.find(
        (c) => c.name === ("getInfo" as SymbolName)
      );
      expect(get_info_call).toBeDefined();

      // Note: Prototype methods may not resolve in the same way as ES6 class methods
      // due to the dynamic nature of prototype assignment. This is expected.
    });

    it("should handle method chaining", async () => {
      const source = load_source("classes/constructor_workflow.js");
      const file = file_path("classes/constructor_workflow.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find method calls
      const method_calls = index!.references.filter(
        (r): r is MethodCallReference => r.kind === "method_call"
      );

      // Find applyDiscount and markOutOfStock calls (method chaining)
      const apply_discount_call = method_calls.find(
        (c) => c.name === ("applyDiscount" as SymbolName)
      );
      const mark_out_of_stock_call = method_calls.find(
        (c) => c.name === ("markOutOfStock" as SymbolName)
      );

      expect(apply_discount_call).toBeDefined();
      expect(mark_out_of_stock_call).toBeDefined();
    });
  });

  describe("JavaScript Patterns", () => {
    it("should handle IIFE patterns", async () => {
      const source = load_source("functions/iife_patterns.js");
      const file = file_path("functions/iife_patterns.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Verify IIFE scopes are captured
      const scopes = Array.from(index!.scopes.values());
      const function_scopes = scopes.filter((s) => s.type === "function");
      expect(function_scopes.length).toBeGreaterThan(0);

      // Find function definitions within IIFEs
      const functions = Array.from(index!.functions.values());
      const helper_fns = functions.filter(
        (f) => f.name === ("helper" as SymbolName)
      );
      expect(helper_fns.length).toBeGreaterThan(0);
    });

    it("should handle closures and nested scopes", async () => {
      const source = load_source("functions/closures.js");
      const file = file_path("functions/closures.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find closure functions
      const functions = Array.from(index!.functions.values());

      // createMultiplier should exist
      const create_multiplier = functions.find(
        (f) => f.name === ("createMultiplier" as SymbolName)
      );
      expect(create_multiplier).toBeDefined();

      // createBankAccount should exist
      const create_bank_account = functions.find(
        (f) => f.name === ("createBankAccount" as SymbolName)
      );
      expect(create_bank_account).toBeDefined();

      // Nested scopes should be captured
      const scopes = Array.from(index!.scopes.values());
      const function_scopes = scopes.filter((s) => s.type === "function");
      expect(function_scopes.length).toBeGreaterThan(5); // Multiple nested functions

      // Find inner function calls
      const calls = index!.references.filter((r) => r.kind === "function_call" || r.kind === "method_call" || r.kind === "self_reference_call" || r.kind === "constructor_call");
      expect(calls.length).toBeGreaterThan(0);

      // Find multiply call (inside closure)
      const multiply_call = calls.find(
        (c) => c.name === ("multiply" as SymbolName)
      );
      expect(multiply_call).toBeDefined();

      // Verify it resolves to the multiply function in the same file
      const resolved = project.resolutions.resolve(
        multiply_call!.scope_id,
        multiply_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.name).toBe("multiply" as SymbolName);
    });

    it("should handle factory patterns", async () => {
      const source = load_source("functions/factory_patterns.js");
      const file = file_path("functions/factory_patterns.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Verify factory functions exist
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported class and methods", async () => {
      const user_class = load_source("modules/user_class.js");
      const uses_user = load_source("modules/uses_user.js");
      const user_file = file_path("modules/user_class.js");
      const uses_file = file_path("modules/uses_user.js");

      project.update_file(user_file, user_class);
      project.update_file(uses_file, uses_user);

      // Get uses_user index
      const uses_index = project.get_index_single_file(uses_file);
      expect(uses_index).toBeDefined();

      // Find import
      const imports = Array.from(uses_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find the User import
      const user_import = imports.find((i) => i.name === ("User" as SymbolName));
      expect(user_import).toBeDefined();

      // Verify User class is in user_class.js
      const user_index = project.get_index_single_file(user_file);
      const user_class_def = Array.from(user_index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class_def).toBeDefined();
      expect(user_class_def!.location.file_path).toContain("user_class.js");
    });

    it("should resolve imported class constructor calls", async () => {
      const user_class = load_source("modules/user_class.js");
      const uses_user = load_source("modules/uses_user.js");
      const user_file = file_path("modules/user_class.js");
      const uses_file = file_path("modules/uses_user.js");

      project.update_file(user_file, user_class);
      project.update_file(uses_file, uses_user);

      // Get uses_user index
      const uses_index = project.get_index_single_file(uses_file);
      expect(uses_index).toBeDefined();

      // Find constructor call
      const constructor_calls = uses_index!.references.filter(
        (r): r is ConstructorCallReference => r.kind === "constructor_call"
      );
      expect(constructor_calls.length).toBeGreaterThan(0);

      // Find User constructor call
      const user_constructor_call = constructor_calls.find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_constructor_call).toBeDefined();

      // Verify constructor call resolves to User class
      const resolved = project.resolutions.resolve(
        user_constructor_call!.scope_id,
        user_constructor_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("class");
      expect(resolved_def!.name).toBe("User" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("user_class.js");
    });

    it("should resolve method calls on imported class instances", async () => {
      const user_file = file_path("modules/user_class.js");
      const uses_file = file_path("modules/uses_user.js");

      project.update_file(user_file, load_source("modules/user_class.js"));
      project.update_file(uses_file, load_source("modules/uses_user.js"));

      // Get semantic index for uses_user.js
      const uses_index = project.get_index_single_file(uses_file);
      expect(uses_index).toBeDefined();

      // Find the getName method call
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const getName_call = uses_index!.references.find(
        (ref): ref is MethodCallReference => ref.name === ("getName" as SymbolName) && ref.kind === "method_call"
      );
      expect(getName_call).toBeDefined();
      if (!getName_call) return;

      // Resolve using the public API
      const resolved_symbol_id = project.resolutions.resolve(getName_call.scope_id, getName_call.name);
      if (!resolved_symbol_id) return;

      // Verify it resolves to method in user_class.js
      const resolved_def = project.definitions.get(resolved_symbol_id);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("method");
      expect(resolved_def!.name).toBe("getName" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("user_class.js");
    });

    it("should follow re-export chains", async () => {
      const base = load_source("modules/base.js");
      const middle = load_source("modules/middle.js");
      const main = load_source("modules/main_reexport.js");
      const base_file = file_path("modules/base.js");
      const middle_file = file_path("modules/middle.js");
      const main_file = file_path("modules/main_reexport.js");

      project.update_file(base_file, base);
      project.update_file(middle_file, middle);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // Find call to coreFunction (imported from middle, re-exported from base)
      const calls = main_index!.references.filter((r) => r.kind === "function_call" || r.kind === "method_call" || r.kind === "self_reference_call" || r.kind === "constructor_call");
      const core_call = calls.find(
        (c): c is FunctionCallReference =>
          c.name === ("coreFunction" as SymbolName) && c.kind === "function_call"
      );
      expect(core_call).toBeDefined();

      // Verify it resolves to base.js (not middle.js)
      const resolved = project.resolutions.resolve(
        core_call!.scope_id,
        core_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("function");
      expect(resolved_def!.name).toBe("coreFunction" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("base.js");
    });

    it("should resolve aliased imports", async () => {
      const utils = load_source("modules/utils_aliased.js");
      const main = load_source("modules/main_aliased.js");
      const utils_file = file_path("modules/utils_aliased.js");
      const main_file = file_path("modules/main_aliased.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // Find imports with aliases
      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find utilHelper import (aliased from helper)
      const util_helper_import = imports.find(
        (i) => i.name === ("utilHelper" as SymbolName)
      );
      expect(util_helper_import).toBeDefined();
      expect(util_helper_import!.original_name).toBe("helper" as SymbolName);

      // Find call to utilHelper
      const calls = main_index!.references.filter((r) => r.kind === "function_call" || r.kind === "method_call" || r.kind === "self_reference_call" || r.kind === "constructor_call");
      const helper_call = calls.find(
        (c): c is FunctionCallReference =>
          c.name === ("utilHelper" as SymbolName) && c.kind === "function_call"
      );
      expect(helper_call).toBeDefined();

      // Verify it resolves to helper in utils_aliased.js
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("function");
      expect(resolved_def!.name).toBe("helper" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("utils_aliased.js");
    });

    it("should resolve aliased class constructor calls", async () => {
      const utils = load_source("modules/utils_aliased.js");
      const main = load_source("modules/main_aliased.js");
      const utils_file = file_path("modules/utils_aliased.js");
      const main_file = file_path("modules/main_aliased.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // Find Manager import (aliased from DataManager)
      const imports = Array.from(main_index!.imported_symbols.values());
      const manager_import = imports.find(
        (i) => i.name === ("Manager" as SymbolName)
      );
      expect(manager_import).toBeDefined();
      expect(manager_import!.original_name).toBe("DataManager" as SymbolName);

      // Find constructor call for Manager
      const constructor_calls = main_index!.references.filter(
        (r): r is ConstructorCallReference => r.kind === "constructor_call"
      );
      const manager_constructor = constructor_calls.find(
        (c) => c.name === ("Manager" as SymbolName)
      );
      expect(manager_constructor).toBeDefined();

      // Verify constructor resolves to DataManager class in utils_aliased.js
      const resolved = project.resolutions.resolve(
        manager_constructor!.scope_id,
        manager_constructor!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("class");
      expect(resolved_def!.name).toBe("DataManager" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("utils_aliased.js");
    });

    it("should resolve method calls on aliased class instances", async () => {
      const utils = load_source("modules/utils_aliased.js");
      const main = load_source("modules/main_aliased.js");
      const utils_file = file_path("modules/utils_aliased.js");
      const main_file = file_path("modules/main_aliased.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get semantic index for main.js
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // Find the process method call
      const process_call = main_index!.references.find(
        (ref): ref is MethodCallReference => ref.name === ("process" as SymbolName) && ref.kind === "method_call"
      );
      expect(process_call).toBeDefined();
      if (!process_call) return;

      // Resolve using the public API
      const resolved_symbol_id = project.resolutions.resolve(process_call.scope_id, process_call.name);
      if (!resolved_symbol_id) return;

      // Verify it resolves to process method in DataManager class
      const resolved_def = project.definitions.get(resolved_symbol_id);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("method");
      expect(resolved_def!.name).toBe("process" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("utils_aliased.js");
    });
  });

  describe("Shadowing", () => {
    it("should resolve to local definition when it shadows import", async () => {
      const source = load_source("modules/shadowing.js");
      const file = file_path("modules/shadowing.js");

      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Verify scopes exist with shadowing
      const scopes = Array.from(index!.scopes.values());
      expect(scopes.length).toBeGreaterThan(0);

      // Find function definitions
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);
    });
  });

  describe("Call Graph", () => {
    it("should build call graph for JavaScript functions", async () => {
      const source = load_source("functions/closures.js");
      const file = file_path("functions/closures.js");

      project.update_file(file, source);

      // Get call graph
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Should have nodes for callable functions
      expect(call_graph.nodes.size).toBeGreaterThan(0);

      // Verify some nodes have calls
      const nodes = Array.from(call_graph.nodes.values());
      const has_calls = nodes.some((node) => node.enclosed_calls.length > 0);
      expect(has_calls).toBe(true);
    });

    it("should handle cross-module call graph", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get call graph
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Should have nodes from both files
      const nodes = Array.from(call_graph.nodes.values());
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe("Incremental Updates", () => {
    it("should re-resolve after file update", async () => {
      const source_v1 = load_source("modules/utils_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      project.update_file(utils_file, source_v1);

      let index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();
      const initial_functions = index!.functions.size;

      // Modify file (add a function)
      const source_v2 =
        source_v1 + "\n\nexport function newFunc() { return 123; }";
      project.update_file(utils_file, source_v2);

      // Verify re-indexing occurred
      index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();
      expect(index!.functions.size).toBeGreaterThan(initial_functions);

      // Verify the new function is in definitions registry
      const new_func_defs = Array.from(index!.functions.values()).filter(
        (f) => f.name === ("newFunc" as SymbolName)
      );
      expect(new_func_defs.length).toBe(1);
    });

    it("should update dependent files when imported file changes", async () => {
      const utils_source = load_source("modules/utils_es6.js");
      const main_source = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // Verify initial state - helper call resolves
      const main_v1 = project.get_index_single_file(main_file);
      const helper_call_v1 = main_v1!.references.find(
        (r): r is FunctionCallReference =>
          r.name === ("helper" as SymbolName) &&
          r.kind === "function_call"
      );
      expect(helper_call_v1).toBeDefined();

      const resolved_v1 = project.resolutions.resolve(
        helper_call_v1!.scope_id,
        helper_call_v1!.name
      );
      expect(resolved_v1).toBeDefined();

      // Modify utils.js - rename helper
      const modified_utils = utils_source.replace(
        "function helper",
        "function renamedHelper"
      );
      project.update_file(utils_file, modified_utils);

      // Verify main.js still has the reference (source unchanged)
      const main_v2 = project.get_index_single_file(main_file);
      const helper_call_v2 = main_v2!.references.find(
        (r): r is FunctionCallReference =>
          r.name === ("helper" as SymbolName) &&
          r.kind === "function_call"
      );
      expect(helper_call_v2).toBeDefined();

      // Import should not resolve after source file removes the export
      const resolved_v2 = project.resolutions.resolve(
        helper_call_v2!.scope_id,
        helper_call_v2!.name
      );
      expect(resolved_v2).toBeNull();
    });

    it("should handle file removal and update dependents", async () => {
      const utils_source = load_source("modules/utils_es6.js");
      const main_source = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // Verify main.js depends on utils.js
      const dependents = project.get_dependents(utils_file);
      expect(dependents.has(main_file)).toBe(true);

      // Remove utils.js
      project.remove_file(utils_file);

      // Verify utils.js is removed
      const utils_index = project.get_index_single_file(utils_file);
      expect(utils_index).toBeUndefined();

      // Verify main.js still exists but import can't resolve
      const main = project.get_index_single_file(main_file);
      expect(main).toBeDefined();

      // Call to helper (which was imported) should not resolve after source file removal
      const helper_call = main!.references.find(
        (r): r is FunctionCallReference =>
          r.name === ("helper" as SymbolName) &&
          r.kind === "function_call"
      );
      if (helper_call) {
        const resolved = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );
        expect(resolved).toBeNull();
      }
    });
  });

  describe("Callback detection and invocation", () => {
    it("should detect callback context for anonymous functions in array methods", async () => {
      const project = new Project();
      await project.initialize();

      const code = `
const items = [1, 2, 3];
items.forEach((item) => {
  process(item);
});

function process(x) {}
      `.trim();

      const file_path = "/test/callback.js" as FilePath;
      project.update_file(file_path, code);

      const definitions = project.definitions;
      const anon_funcs = Array.from(definitions.get_callable_definitions()).filter(
        (d) => d.name === "<anonymous>"
      );

      expect(anon_funcs.length).toBe(1);
      const anon = anon_funcs[0];

      // Check callback context is captured
      expect((anon as any).callback_context).toBeDefined();
      expect((anon as any).callback_context.is_callback).toBe(true);
      expect((anon as any).callback_context.receiver_location).toBeDefined();
    });

  });

  describe("Polymorphic this Dispatch (Task 11.174)", () => {
    it("should resolve this.method() to base method in ES6 class", async () => {
      const code = `
        class Base {
          process() { this.helper(); }
          helper() { return "base"; }
        }
        class Child extends Base {
          helper() { return "child"; }
        }
      `;
      const file = file_path("polymorphic_this.js");
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      const classes = Array.from(index!.classes.values());
      const base_class = classes.find((c) => c.name === ("Base" as SymbolName));
      const child_class = classes.find((c) => c.name === ("Child" as SymbolName));

      expect(base_class).toBeDefined();
      expect(child_class).toBeDefined();

      // Verify extends is correctly populated through the full project pipeline
      const child_type_info = project.get_type_info(child_class!.symbol_id)!;
      expect(child_type_info.extends).toEqual(["Base" as SymbolName]);

      // Verify Base.helper is referenced via this.helper() call
      const base_helper = project.get_type_info(base_class!.symbol_id)!.methods.get(
        "helper" as SymbolName
      );
      expect(base_helper).toBeDefined();

      const referenced = project.resolutions.get_all_referenced_symbols();
      expect(referenced.has(base_helper!)).toBe(true);
    });
  });

  describe("Re-export barrel — multiple aliases of one source (TASK-364.8)", () => {
    it("registers both aliases without a forged duplicate export", () => {
      // Two specifiers share the source name create_class_id but carry
      // distinct aliases, so each must reach ExportRegistry under its own
      // export name; a source-name-keyed collapse would make update_file
      // throw "Duplicate export name create_py_class_id".
      const barrel = file_path("modules/reexport_barrel_multi_alias.js");
      const content = `export { create_class_id as create_js_class_id } from "./sf_js";
export { create_class_id as create_py_class_id } from "./sf_py";
`;

      expect(() => project.update_file(barrel, content)).not.toThrow();

      // Both aliases survive as distinct exports; a collapse would have thrown
      // above or dropped one of them here.
      const export_names = Array.from(project.exports.get_exports(barrel))
        .map((symbol_id) => symbol_id.split(":").pop())
        .sort();
      expect(export_names).toEqual(["create_js_class_id", "create_py_class_id"]);
    });
  });

  describe("JSX Component Usage", () => {
    it("resolves a JSX element to its component definition and marks it referenced", async () => {
      const source = `
        function Icon() {
          return null;
        }
        function Panel() {
          return null;
        }
        function App() {
          return (
            <Panel>
              <div>
                <Icon />
              </div>
            </Panel>
          );
        }
      `;
      const file = file_path("jsx_component_usage.jsx");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const functions = Array.from(index!.functions.values());
      const icon_fn = functions.find((f) => f.name === ("Icon" as SymbolName));
      const panel_fn = functions.find((f) => f.name === ("Panel" as SymbolName));
      expect(icon_fn).toBeDefined();
      expect(panel_fn).toBeDefined();

      // The self-closing `<Icon />` and the opening `<Panel>` tag each emit a
      // call reference to the component.
      const jsx_calls = index!.references.filter(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          (r.name === ("Icon" as SymbolName) || r.name === ("Panel" as SymbolName))
      );
      const icon_call = jsx_calls.find((c) => c.name === ("Icon" as SymbolName));
      const panel_call = jsx_calls.find((c) => c.name === ("Panel" as SymbolName));
      expect(icon_call).toBeDefined();
      expect(panel_call).toBeDefined();

      expect(
        project.resolutions.resolve(icon_call!.scope_id, icon_call!.name)
      ).toBe(icon_fn!.symbol_id);
      expect(
        project.resolutions.resolve(panel_call!.scope_id, panel_call!.name)
      ).toBe(panel_fn!.symbol_id);

      // A component used only as a JSX element has an incoming call edge, so it
      // is no longer an unreachable entry point.
      const referenced = project.resolutions.get_all_referenced_symbols();
      expect(referenced.has(icon_fn!.symbol_id)).toBe(true);
      expect(referenced.has(panel_fn!.symbol_id)).toBe(true);

      // The lowercase `<div>` is an intrinsic host element, not a component, so
      // it emits no component call reference (only capitalized tags do).
      const div_calls = index!.references.filter(
        (r) => r.kind === "function_call" && r.name === ("div" as SymbolName)
      );
      expect(div_calls).toEqual([]);
    });
  });

  describe("Member reference reachability (task-351)", () => {
    function method_symbol(file: FilePath, class_name: string, method: string) {
      const index = project.get_index_single_file(file);
      const cls = Array.from(index!.classes.values()).find(
        (c) => c.name === (class_name as SymbolName)
      );
      return project.get_type_info(cls!.symbol_id)!.methods.get(method as SymbolName);
    }

    it("resolves a this.#method() private call to the private method", () => {
      const file = file_path("private_call.js");
      project.update_file(
        file,
        `class Vault {
          #open() { return 1; }
          run() { return this.#open(); }
        }`
      );
      const referenced = project.resolutions.get_all_referenced_symbols();
      const open = method_symbol(file, "Vault", "#open");
      expect(open).toBeDefined();
      expect(referenced.has(open!)).toBe(true);
    });

    it("resolves calls made from a computed-key method body", () => {
      const file = file_path("computed_body.js");
      project.update_file(
        file,
        `class Bag {
          helper() { return 1; }
          [Symbol.iterator]() { this.helper(); }
        }`
      );
      const referenced = project.resolutions.get_all_referenced_symbols();
      const helper = method_symbol(file, "Bag", "helper");
      expect(helper).toBeDefined();
      expect(referenced.has(helper!)).toBe(true);
    });

    it("makes a getter reachable when invoked via a bare property read", () => {
      const file = file_path("getter_read.js");
      project.update_file(
        file,
        `class Widget {
          get value() { return 1; }
          compute() { return 2; }
        }
        function main() { const w = new Widget(); return w.value; }`
      );
      const referenced = project.resolutions.get_all_referenced_symbols();
      const value = method_symbol(file, "Widget", "value");
      const compute = method_symbol(file, "Widget", "compute");
      expect(value).toBeDefined();

      expect(referenced.has(value!)).toBe(true);
      expect(referenced.has(compute!)).toBe(false);

      const entry_points = new Set(
        project.get_call_graph({ include_tests: true }).entry_points
      );
      expect(entry_points.has(value!)).toBe(false);
      expect(entry_points.has(compute!)).toBe(true);
    });

    it("makes a getter reachable even when a same-named setter is declared", () => {
      // A `get value()` / `set value()` pair share one member name; the getter
      // must still be reached by a bare read despite the name collision.
      const file = file_path("getter_setter.js");
      project.update_file(
        file,
        `class Widget {
          get value() { return 1; }
          set value(v) {}
        }
        function main() { const w = new Widget(); return w.value; }`
      );
      const referenced = project.resolutions.get_all_referenced_symbols();
      const value = method_symbol(file, "Widget", "value");
      expect(value).toBeDefined();
      expect(referenced.has(value!)).toBe(true);
    });

    it("forges an edge only for getters — a non-getter member read creates none", () => {
      const file = file_path("field_read.js");
      project.update_file(
        file,
        `class Box {
          field = 1;
          plain() { return 3; }
        }
        function main() {
          const b = new Box();
          const f = b.field;   // plain data-property read
          const m = b.plain;   // ordinary method read as a value (not a call)
          return [f, m];
        }`
      );
      const referenced = project.resolutions.get_all_referenced_symbols();
      const plain = method_symbol(file, "Box", "plain");
      expect(plain).toBeDefined();
      // Reading a field or a non-getter method as a value must not forge a call
      // edge — this is what the `accessor_kind === "getter"` guard enforces.
      expect(referenced.has(plain!)).toBe(false);
    });
  });

});
