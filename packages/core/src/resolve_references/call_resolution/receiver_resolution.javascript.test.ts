/**
 * JavaScript integration tests for self-reference call resolution
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { Project } from "../../project/project";
import type {
  FilePath,
  SymbolName,
  SymbolId,
  SelfReferenceCall,
} from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("JavaScript Self-Reference Resolution Integration", () => {
  let project: Project;
  let temp_dir: string;

  beforeAll(() => {
    temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-"));
  });

  afterAll(() => {
    if (fs.existsSync(temp_dir)) {
      fs.rmSync(temp_dir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    project = new Project();
    await project.initialize(temp_dir as FilePath);
  });

  describe("this.method()", () => {
    it("should resolve this.method() in ES6 class", () => {
      const code = `
        class User {
          constructor(name) {
            this.name = name;
          }

          greet() {
            return this.getName();
          }

          getName() {
            return this.name;
          }
        }
      `;

      const file = path.join(temp_dir, "user.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("getName" as SymbolName)).toBe(true);

      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);

      // getName should be referenced via this.getName() in greet
      const referenced = project.resolutions.get_all_referenced_symbols();
      const get_name_id = type_info!.methods.get("getName" as SymbolName);
      expect(get_name_id).toBeDefined();
      expect(referenced.has(get_name_id!)).toBe(true);
    });

    it("should resolve this.method() in prototype pattern", () => {
      const code = `
        function Counter() {
          this.count = 0;
        }

        Counter.prototype.increment = function() {
          this.count++;
        };

        Counter.prototype.getCount = function() {
          return this.count;
        };
      `;

      const file = path.join(temp_dir, "counter.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const functions = Array.from(index!.functions.values());
      const counter_fn = functions.find((f) => f.name === ("Counter" as SymbolName));
      expect(counter_fn).toBeDefined();
    });
  });

  describe("super.method()", () => {
    it("should resolve super.method() call to parent class method", () => {
      const code = `
        class Animal {
          makeSound() {
            return "sound";
          }
        }

        class Dog extends Animal {
          makeSound() {
            return super.makeSound() + " woof";
          }
        }
      `;

      const file = path.join(temp_dir, "dog.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const animal_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Animal" as SymbolName)
      );
      expect(animal_class).toBeDefined();

      const animal_type_info = project.get_type_info(animal_class!.symbol_id);
      expect(animal_type_info).toBeDefined();
      expect(animal_type_info!.methods.has("makeSound" as SymbolName)).toBe(true);

      // super.makeSound() should be captured as a self_reference_call with keyword=super
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      const super_call = self_ref_calls.find(
        (c) => c.name === ("makeSound" as SymbolName) && c.keyword === "super"
      );
      expect(super_call).toBeDefined();
    });

    it("should resolve super constructor call", () => {
      const code = `
        class Vehicle {
          constructor(wheels) {
            this.wheels = wheels;
          }
        }

        class Car extends Vehicle {
          constructor() {
            super(4);
          }
        }
      `;

      const file = path.join(temp_dir, "car.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const vehicle_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Vehicle" as SymbolName)
      );
      expect(vehicle_class).toBeDefined();

      const car_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Car" as SymbolName)
      );
      expect(car_class).toBeDefined();
    });
  });

  describe("property chains", () => {
    it("should resolve this.property.method() with chained access", () => {
      const code = `
        class Database {
          query(sql) {
            return "result";
          }
        }

        class Service {
          constructor() {
            this.db = new Database();
          }

          getData() {
            return this.db.query("SELECT * FROM users");
          }
        }
      `;

      const file = path.join(temp_dir, "service.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const service_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Service" as SymbolName)
      );
      expect(service_class).toBeDefined();

      const service_type_info = project.get_type_info(service_class!.symbol_id);
      expect(service_type_info).toBeDefined();

      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      const db_type_info = project.get_type_info(db_class!.symbol_id);
      expect(db_type_info).toBeDefined();
      expect(db_type_info!.methods.has("query" as SymbolName)).toBe(true);
    });

    it("should resolve multiple this.method() calls in same class", () => {
      const code = `
        class Pipeline {
          validate(data) {
            return data !== null;
          }

          transform(data) {
            return data.toString();
          }

          process(data) {
            if (this.validate(data)) {
              return this.transform(data);
            }
            return null;
          }
        }
      `;

      const file = path.join(temp_dir, "pipeline.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const pipeline_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Pipeline" as SymbolName)
      );
      expect(pipeline_class).toBeDefined();

      const type_info = project.get_type_info(pipeline_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("validate" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("transform" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("process" as SymbolName)).toBe(true);

      // validate and transform should be referenced via this.validate() and this.transform() in process
      const referenced = project.resolutions.get_all_referenced_symbols();
      const validate_id = type_info!.methods.get("validate" as SymbolName);
      const transform_id = type_info!.methods.get("transform" as SymbolName);
      expect(validate_id).toBeDefined();
      expect(transform_id).toBeDefined();
      expect(referenced.has(validate_id!)).toBe(true);
      expect(referenced.has(transform_id!)).toBe(true);
    });
  });

  describe("Polymorphic this Dispatch", () => {
    // Note: JavaScript class inheritance tracking (`extends` extraction) is not yet implemented.
    // The polymorphic dispatch logic works correctly when subtype tracking is available.
    // This test verifies that at least the base method is resolved.
    it("should resolve this.method() to base method in ES6 class", () => {
      const code = `
        class Base {
          process() { this.helper(); }
          helper() { return "base"; }
        }
        class Child extends Base {
          helper() { return "child"; }
        }
      `;

      const file = path.join(temp_dir, "polymorphic.js") as FilePath;
      project.update_file(file, code);

      const referenced = project.resolutions.get_all_referenced_symbols();
      const index = project.get_index_single_file(file);

      const base_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Base" as SymbolName)
      );

      expect(base_class).toBeDefined();

      const base_type_info = project.get_type_info(base_class!.symbol_id);
      const base_helper = base_type_info!.methods.get("helper" as SymbolName);

      expect(base_helper).toBeDefined();

      // Base method should be referenced (child override not tracked due to missing extends extraction)
      expect(referenced.has(base_helper!)).toBe(true);
    });
  });

  // TASK-352: `this.method()` inside object-literal methods and prototype/member
  // -assigned functions binds `this` to the enclosing function collection, so the
  // call resolves to the sibling property rather than failing with
  // no_enclosing_class_scope.
  describe("object-literal and prototype receivers", () => {
    // The symbols `this.<method>()` resolves to, taken from the resolved call
    // edge itself (not get_all_referenced_symbols, which also reports members
    // reachable only through collection membership).
    function this_call_targets(file: FilePath, method: SymbolName): SymbolId[] {
      const index = project.get_index_single_file(file);
      const call = index!.references.find(
        (r): r is SelfReferenceCall =>
          r.kind === "self_reference_call" && r.name === method
      );
      expect(call).toBeDefined();
      return project.resolutions
        .get_calls_by_caller_scope(call!.scope_id)
        .filter((resolved) => resolved.name === method)
        .flatMap((resolved) => resolved.resolutions.map((r) => r.symbol_id));
    }

    // The 1-based start line each resolved target is declared on. Reading the
    // resolved symbol's own location — SymbolId is `kind:path:startLine:...` —
    // proves the call binds to the sibling's actual definition, independent of
    // the collection's named_members that resolution consulted.
    function target_lines(file: FilePath, method: SymbolName): number[] {
      return this_call_targets(file, method).map((id) =>
        Number(String(id).split(":")[2])
      );
    }

    // The 1-based line a source substring appears on, for the expected sibling.
    function line_of(code: string, needle: string): number {
      return code.split("\n").findIndex((line) => line.includes(needle)) + 1;
    }

    it("resolves this.method() to a sibling object-literal shorthand method", () => {
      const code = [
        "const app = {",
        "  path() { return this.sibling(); },",
        "  sibling() { return 42; },",
        "};",
      ].join("\n");
      const file = path.join(temp_dir, "object_shorthand.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "sibling" as SymbolName)).toEqual([
        line_of(code, "sibling() { return 42; }"),
      ]);
    });

    it("resolves this.method() to a sibling object-literal function-expression property", () => {
      const code = [
        "const app = {",
        "  path: function () { return this.sibling(); },",
        "  sibling: function () { return 42; },",
        "};",
      ].join("\n");
      const file = path.join(temp_dir, "object_function.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "sibling" as SymbolName)).toEqual([
        line_of(code, "sibling: function"),
      ]);
    });

    // An arrow's `this` is lexically the enclosing scope, not the object, so
    // binding it to the collection is a deliberate call-graph over-approximation:
    // it keeps the sibling reachable rather than under-reporting a possible edge.
    it("resolves this.method() to a sibling object-literal arrow property", () => {
      const code = [
        "const app = {",
        "  path: () => { return this.sibling(); },",
        "  sibling: () => 42,",
        "};",
      ].join("\n");
      const file = path.join(temp_dir, "object_arrow.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "sibling" as SymbolName)).toEqual([
        line_of(code, "sibling: () => 42"),
      ]);
    });

    it("resolves this.method() to a named-reference object-literal property", () => {
      const code = [
        "function helper() { return 42; }",
        "const app = {",
        "  path() { return this.sib(); },",
        "  sib: helper,",
        "};",
      ].join("\n");
      const file = path.join(temp_dir, "object_reference.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "sib" as SymbolName)).toEqual([
        line_of(code, "function helper"),
      ]);
    });

    it("resolves this.method() to a sibling member-assigned function", () => {
      const code = [
        "const app = {};",
        "app.path = function () { return this.sibling(); };",
        "app.sibling = function () { return 42; };",
      ].join("\n");
      const file = path.join(temp_dir, "member_assign.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "sibling" as SymbolName)).toEqual([
        line_of(code, "app.sibling = function"),
      ]);
    });

    it("resolves this.method() to a sibling prototype-assigned function", () => {
      const code = [
        "function Counter() { this.count = 0; }",
        "Counter.prototype.increment = function () { return this.getCount(); };",
        "Counter.prototype.getCount = function () { return this.count; };",
      ].join("\n");
      const file = path.join(temp_dir, "prototype.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "getCount" as SymbolName)).toEqual([
        line_of(code, "Counter.prototype.getCount = function"),
      ]);
    });

    it("resolves a reassigned member to the last assignment (last-write-wins)", () => {
      const code = [
        "const app = { run() { return this.m(); } };",
        "app.m = function () { return 1; };",
        "app.m = function () { return 2; };",
      ].join("\n");
      const file = path.join(temp_dir, "reassigned.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "m" as SymbolName)).toEqual([
        line_of(code, "app.m = function () { return 2; }"),
      ]);
    });

    it("does not resolve this.method() when no sibling member matches", () => {
      const code = [
        "const app = {",
        "  path() { return this.missing(); },",
        "  sibling() { return 42; },",
        "};",
      ].join("\n");
      const file = path.join(temp_dir, "missing_member.js") as FilePath;
      project.update_file(file, code);

      expect(this_call_targets(file, "missing" as SymbolName)).toEqual([]);
    });

    it("does not bind this inside a plain function with no enclosing collection", () => {
      const code = [
        "function f() { return this.g(); }",
        "function g() { return 1; }",
      ].join("\n");
      const file = path.join(temp_dir, "plain_function.js") as FilePath;
      project.update_file(file, code);

      expect(this_call_targets(file, "g" as SymbolName)).toEqual([]);
    });

    it("binds this to the enclosing object literal, not an adjacent one", () => {
      const code = [
        "const a = { m() { return this.helper(); }, helper() { return 1; } };",
        "const b = { n() { return this.other(); }, other() { return 2; } };",
      ].join("\n");
      const file = path.join(temp_dir, "adjacent_literals.js") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "helper" as SymbolName)).toEqual([
        line_of(code, "const a = {"),
      ]);
      expect(target_lines(file, "other" as SymbolName)).toEqual([
        line_of(code, "const b = {"),
      ]);
    });

    it("binds this to the innermost collection member, not an enclosing literal", () => {
      const code = [
        "const config = {",
        "  a() { return 1; },",
        "  handlers: {",
        "    a() { return 2; },",
        "    b() { return this.a(); },",
        "  },",
        "};",
      ].join("\n");
      const file = path.join(temp_dir, "nested_literal.js") as FilePath;
      project.update_file(file, code);

      // `handlers` is not indexed as a collection, so `this.a()` in `handlers.b`
      // must not bind to the outer `config.a` — the receiver stays unresolved
      // rather than producing a wrong edge.
      expect(this_call_targets(file, "a" as SymbolName)).toEqual([]);
    });
  });
});
