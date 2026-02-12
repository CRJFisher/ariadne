/**
 * TypeScript integration tests for self-reference call resolution
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { Project } from "../../project/project";
import type {
  FilePath,
  SymbolName,
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

      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);
      expect(type_info!.methods.get("getName" as SymbolName)).toBeDefined();
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

      const type_info = project.get_type_info(counter_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.properties.has("count" as SymbolName)).toBe(true);
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

      const service_type_info = project.get_type_info(service_class!.symbol_id);
      expect(service_type_info).toBeDefined();
      expect(service_type_info!.properties.has("db" as SymbolName)).toBe(true);

      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      const db_type_info = project.get_type_info(db_class!.symbol_id);
      expect(db_type_info).toBeDefined();
      expect(db_type_info!.methods.has("query" as SymbolName)).toBe(true);
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

      const type_info = project.get_type_info(event_handler_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("addListener" as SymbolName)).toBe(true);
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

      const animal_type_info = project.get_type_info(animal_class!.symbol_id);
      expect(animal_type_info).toBeDefined();
      expect(animal_type_info!.methods.has("makeSound" as SymbolName)).toBe(true);

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

      const base_type_info = project.get_type_info(base_class!.symbol_id);
      const middle_type_info = project.get_type_info(middle_class!.symbol_id);
      const derived_type_info = project.get_type_info(derived_class!.symbol_id);

      expect(base_type_info!.methods.has("getValue" as SymbolName)).toBe(true);
      expect(middle_type_info!.methods.has("getValue" as SymbolName)).toBe(true);
      expect(derived_type_info!.methods.has("getValue" as SymbolName)).toBe(true);
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

      const type_info = project.get_type_info(config_class!.symbol_id);
      expect(type_info).toBeDefined();
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

      const base_type_info = project.get_type_info(base_class!.symbol_id);
      const child_type_info = project.get_type_info(child_class!.symbol_id);

      const base_helper = base_type_info!.methods.get("helper" as SymbolName);
      const child_helper = child_type_info!.methods.get("helper" as SymbolName);

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
        const type_info = project.get_type_info(cls.symbol_id);
        const helper_id = type_info!.methods.get("helper" as SymbolName);
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

      const parent_type_info = project.get_type_info(parent_class!.symbol_id);
      expect(parent_type_info!.methods.has("method" as SymbolName)).toBe(true);
    });
  });
});
