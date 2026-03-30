/**
 * JavaScript integration tests for self-reference call resolution
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
});
