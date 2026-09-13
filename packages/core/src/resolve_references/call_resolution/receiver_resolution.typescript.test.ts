/**
 * TypeScript integration tests for self-reference call resolution
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

describe("TypeScript Self-Reference Resolution Integration", () => {
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
    it("should resolve this.method() call to class method", () => {
      const code = `
        class User {
          name: string;

          constructor(name: string) {
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

      const file = path.join(temp_dir, "user.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);

      const get_name_call = self_ref_calls.find(
        (c) => c.name === ("getName" as SymbolName)
      );
      expect(get_name_call).toBeDefined();

      const user_members = project.definitions
        .get_member_index()
        .get(user_class!.symbol_id);
      expect(user_members?.get("getName" as SymbolName)).toBe(
        user_class!.methods.find((m) => m.name === ("getName" as SymbolName))!.symbol_id
      );
    });

    it("should resolve this.property access in constructor", () => {
      const code = `
        class Counter {
          count: number;

          constructor() {
            this.count = 0;
          }

          increment() {
            this.count++;
          }
        }
      `;

      const file = path.join(temp_dir, "counter.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const counter_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_class).toBeDefined();

      const counter_members = project.definitions
        .get_member_index()
        .get(counter_class!.symbol_id);
      expect(counter_members?.get("count" as SymbolName)).toBe(
        counter_class!.properties.find((p) => p.name === ("count" as SymbolName))!.symbol_id
      );
    });

    it("should resolve chained this.property.method() calls", () => {
      const code = `
        class Database {
          query(sql: string): string {
            return "result";
          }
        }

        class Service {
          db: Database;

          constructor() {
            this.db = new Database();
          }

          getData() {
            return this.db.query("SELECT * FROM users");
          }
        }
      `;

      const file = path.join(temp_dir, "service.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const service_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Service" as SymbolName)
      );
      expect(service_class).toBeDefined();

      const service_members = project.definitions
        .get_member_index()
        .get(service_class!.symbol_id);
      expect(service_members?.get("db" as SymbolName)).toBe(
        service_class!.properties.find((p) => p.name === ("db" as SymbolName))!.symbol_id
      );

      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      const db_members = project.definitions.get_member_index().get(db_class!.symbol_id);
      expect(db_members?.get("query" as SymbolName)).toBe(
        db_class!.methods.find((m) => m.name === ("query" as SymbolName))!.symbol_id
      );
    });

    it("should resolve this in nested arrow functions (lexical this)", () => {
      const code = `
        class EventHandler {
          listeners: Array<() => void>;

          constructor() {
            this.listeners = [];
          }

          addListener(fn: () => void) {
            this.listeners.push(fn);
          }

          setupListeners() {
            const handler = () => {
              this.addListener(() => {
                console.log("nested");
              });
            };
            handler();
          }
        }
      `;

      const file = path.join(temp_dir, "event_handler.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const event_handler_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("EventHandler" as SymbolName)
      );
      expect(event_handler_class).toBeDefined();

      const event_handler_members = project.definitions
        .get_member_index()
        .get(event_handler_class!.symbol_id);
      expect(event_handler_members?.get("addListener" as SymbolName)).toBe(
        event_handler_class!.methods.find((m) => m.name === ("addListener" as SymbolName))!
          .symbol_id
      );
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

      const file = path.join(temp_dir, "dog.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const animal_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Animal" as SymbolName)
      );
      expect(animal_class).toBeDefined();

      const dog_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Dog" as SymbolName)
      );
      expect(dog_class).toBeDefined();

      const animal_members = project.definitions
        .get_member_index()
        .get(animal_class!.symbol_id);
      expect(animal_members?.get("makeSound" as SymbolName)).toBe(
        animal_class!.methods.find((m) => m.name === ("makeSound" as SymbolName))!.symbol_id
      );

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
          constructor(public wheels: number) {}
        }

        class Car extends Vehicle {
          constructor() {
            super(4);
          }
        }
      `;

      const file = path.join(temp_dir, "car.ts") as FilePath;
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

    it("should handle multi-level inheritance with super", () => {
      const code = `
        class Base {
          getValue() {
            return 1;
          }
        }

        class Middle extends Base {
          getValue() {
            return super.getValue() + 1;
          }
        }

        class Derived extends Middle {
          getValue() {
            return super.getValue() + 1;
          }
        }
      `;

      const file = path.join(temp_dir, "inheritance.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const base_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Base" as SymbolName)
      );
      const middle_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Middle" as SymbolName)
      );
      const derived_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Derived" as SymbolName)
      );

      expect(base_class).toBeDefined();
      expect(middle_class).toBeDefined();
      expect(derived_class).toBeDefined();

      const base_members = project.definitions
        .get_member_index()
        .get(base_class!.symbol_id);
      const middle_members = project.definitions
        .get_member_index()
        .get(middle_class!.symbol_id);
      const derived_members = project.definitions
        .get_member_index()
        .get(derived_class!.symbol_id);

      expect(base_members?.get("getValue" as SymbolName)).toBe(
        base_class!.methods.find((m) => m.name === ("getValue" as SymbolName))!.symbol_id
      );
      expect(middle_members?.get("getValue" as SymbolName)).toBe(
        middle_class!.methods.find((m) => m.name === ("getValue" as SymbolName))!.symbol_id
      );
      expect(derived_members?.get("getValue" as SymbolName)).toBe(
        derived_class!.methods.find((m) => m.name === ("getValue" as SymbolName))!.symbol_id
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle this in static methods (referring to class itself)", () => {
      const code = `
        class Config {
          static instance: Config;

          static getInstance() {
            if (!this.instance) {
              this.instance = new Config();
            }
            return this.instance;
          }
        }
      `;

      const file = path.join(temp_dir, "config.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const config_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Config" as SymbolName)
      );
      expect(config_class).toBeDefined();

      const config_members = project.definitions
        .get_member_index()
        .get(config_class!.symbol_id);
      expect(config_members?.get("getInstance" as SymbolName)).toBe(
        config_class!.methods.find((m) => m.name === ("getInstance" as SymbolName))!.symbol_id
      );
    });
  });

  describe("Polymorphic this Dispatch", () => {
    it("should resolve this.method() to both base and child override", () => {
      const code = `
        class Base {
          process() { this.helper(); }
          helper() { return "base"; }
        }
        class Child extends Base {
          helper() { return "child"; }
        }
      `;

      const file = path.join(temp_dir, "polymorphic.ts") as FilePath;
      project.update_file(file, code);

      const referenced = project.resolutions.get_all_referenced_symbols();
      const index = project.get_index_single_file(file);

      const base_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Base" as SymbolName)
      );
      const child_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Child" as SymbolName)
      );

      expect(base_class).toBeDefined();
      expect(child_class).toBeDefined();

      const base_members = project.definitions
        .get_member_index()
        .get(base_class!.symbol_id);
      const child_members = project.definitions
        .get_member_index()
        .get(child_class!.symbol_id);

      const base_helper = base_members?.get("helper" as SymbolName);
      const child_helper = child_members?.get("helper" as SymbolName);

      expect(base_helper).toBeDefined();
      expect(child_helper).toBeDefined();

      expect(referenced.has(base_helper!)).toBe(true);
      expect(referenced.has(child_helper!)).toBe(true);
    });

    it("should resolve multi-level inheritance", () => {
      const code = `
        class A {
          process() { this.helper(); }
          helper() {}
        }
        class B extends A {
          helper() {}
        }
        class C extends B {
          helper() {}
        }
      `;

      const file = path.join(temp_dir, "multilevel.ts") as FilePath;
      project.update_file(file, code);

      const referenced = project.resolutions.get_all_referenced_symbols();
      const index = project.get_index_single_file(file);

      const classes = Array.from(index!.classes.values());
      expect(classes).toHaveLength(3);

      for (const cls of classes) {
        const helper_id = project.definitions
          .get_member_index()
          .get(cls.symbol_id)
          ?.get("helper" as SymbolName);
        expect(helper_id).toBeDefined();
        expect(referenced.has(helper_id!)).toBe(true);
      }
    });

    it("super.method() resolves to parent only", () => {
      const code = `
        class Parent {
          method() { return "parent"; }
        }
        class Child extends Parent {
          method() {
            super.method();
            return "child";
          }
        }
        class GrandChild extends Child {
          method() { return "grandchild"; }
        }
      `;

      const file = path.join(temp_dir, "super_ts.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      const super_calls = index!.references.filter(
        (r): r is SelfReferenceCall =>
          r.kind === "self_reference_call" && r.keyword === "super"
      );

      expect(super_calls.length).toBeGreaterThan(0);
      const super_method_call = super_calls.find(
        (c) => c.name === ("method" as SymbolName)
      );
      expect(super_method_call).toBeDefined();

      const parent_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Parent" as SymbolName)
      );
      expect(parent_class).toBeDefined();

      const parent_members = project.definitions
        .get_member_index()
        .get(parent_class!.symbol_id);
      expect(parent_members?.get("method" as SymbolName)).toBe(
        parent_class!.methods.find((m) => m.name === ("method" as SymbolName))!.symbol_id
      );
    });
  });

  // TASK-352: `this.method()` inside object-literal methods and prototype/member
  // -assigned functions binds `this` to the enclosing function collection.
  describe("object-literal and prototype receivers", () => {
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

    // The resolved target's own declaration line (SymbolId is `kind:path:line:...`),
    // an oracle independent of the collection's named_members.
    function target_lines(file: FilePath, method: SymbolName): number[] {
      return this_call_targets(file, method).map((id) =>
        Number(String(id).split(":")[2])
      );
    }

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
      const file = path.join(temp_dir, "ts_object_shorthand.ts") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "sibling" as SymbolName)).toEqual([
        line_of(code, "sibling() { return 42; }"),
      ]);
    });

    it("resolves this.method() to a sibling member-assigned function", () => {
      const code = [
        "const app: Record<string, unknown> = {};",
        "app.path = function () { return this.sibling(); };",
        "app.sibling = function () { return 42; };",
      ].join("\n");
      const file = path.join(temp_dir, "ts_member_assign.ts") as FilePath;
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
      const file = path.join(temp_dir, "ts_prototype.ts") as FilePath;
      project.update_file(file, code);

      expect(target_lines(file, "getCount" as SymbolName)).toEqual([
        line_of(code, "Counter.prototype.getCount = function"),
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
      const file = path.join(temp_dir, "ts_nested_literal.ts") as FilePath;
      project.update_file(file, code);

      expect(this_call_targets(file, "a" as SymbolName)).toEqual([]);
    });
  });
});
