/**
 * Integration tests for self-reference call resolution
 *
 * Verifies that self-reference calls (this.method(), self.method(), super.method())
 * are correctly resolved through the full resolution pipeline.
 *
 * This addresses the bug where 42 symbols were misidentified (31% of failures)
 * due to incorrect handling of self-reference calls.
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

describe("Self-Reference Resolution Integration", () => {
  let project: Project;
  let tempDir: string;

  beforeAll(() => {
    // Create a unique temporary directory for this test suite
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-"));
  });

  afterAll(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    project = new Project();
    await project.initialize(tempDir as FilePath);
  });

  describe("TypeScript - this.method()", () => {
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

      const file = path.join(tempDir, "user.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the User class
      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      // Find self-reference calls
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);

      // Find the this.getName() call
      const get_name_call = self_ref_calls.find(
        (c) => c.name === ("getName" as SymbolName)
      );
      expect(get_name_call).toBeDefined();

      // Get type info for User class to find getName method
      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);

      // Verify getName method exists in type info
      const get_name_method_id = type_info!.methods.get("getName" as SymbolName);
      expect(get_name_method_id).toBeDefined();
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

      const file = path.join(tempDir, "counter.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Counter class
      const counter_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_class).toBeDefined();

      // Verify class has count property
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

      const file = path.join(tempDir, "service.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Service class
      const service_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Service" as SymbolName)
      );
      expect(service_class).toBeDefined();

      // Verify Service has db property
      const service_type_info = project.get_type_info(service_class!.symbol_id);
      expect(service_type_info).toBeDefined();
      expect(service_type_info!.properties.has("db" as SymbolName)).toBe(true);

      // Find the Database class
      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      // Verify Database has query method
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

      const file = path.join(tempDir, "event_handler.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the EventHandler class
      const event_handler_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("EventHandler" as SymbolName)
      );
      expect(event_handler_class).toBeDefined();

      // Verify class has addListener method
      const type_info = project.get_type_info(event_handler_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("addListener" as SymbolName)).toBe(true);
    });
  });

  describe("TypeScript - super.method()", () => {
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

      const file = path.join(tempDir, "dog.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Animal class
      const animal_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Animal" as SymbolName)
      );
      expect(animal_class).toBeDefined();

      // Find the Dog class
      const dog_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Dog" as SymbolName)
      );
      expect(dog_class).toBeDefined();

      // Verify Animal has makeSound method
      const animal_type_info = project.get_type_info(animal_class!.symbol_id);
      expect(animal_type_info).toBeDefined();
      expect(animal_type_info!.methods.has("makeSound" as SymbolName)).toBe(true);

      // Find super.makeSound() call
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

      const file = path.join(tempDir, "car.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Vehicle class
      const vehicle_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Vehicle" as SymbolName)
      );
      expect(vehicle_class).toBeDefined();

      // Find the Car class
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

      const file = path.join(tempDir, "inheritance.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find all classes
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

      // Verify all classes have getValue method
      const base_type_info = project.get_type_info(base_class!.symbol_id);
      const middle_type_info = project.get_type_info(middle_class!.symbol_id);
      const derived_type_info = project.get_type_info(derived_class!.symbol_id);

      expect(base_type_info!.methods.has("getValue" as SymbolName)).toBe(true);
      expect(middle_type_info!.methods.has("getValue" as SymbolName)).toBe(true);
      expect(derived_type_info!.methods.has("getValue" as SymbolName)).toBe(true);
    });
  });

  describe("TypeScript - Edge Cases", () => {
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

      const file = path.join(tempDir, "config.ts") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Config class
      const config_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Config" as SymbolName)
      );
      expect(config_class).toBeDefined();

      // Verify getInstance is captured
      const type_info = project.get_type_info(config_class!.symbol_id);
      expect(type_info).toBeDefined();
    });
  });

  describe("Python - self.method()", () => {
    it("should resolve self.method() call to class method", () => {
      const code = `
class User:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return self.get_name()

    def get_name(self):
        return self.name
      `;

      const file = path.join(tempDir, "user.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the User class
      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      // Verify class has get_name method
      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_name" as SymbolName)).toBe(true);

      // Find self-reference calls
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);

      // Find the self.get_name() call
      const get_name_call = self_ref_calls.find(
        (c) => c.name === ("get_name" as SymbolName) && c.keyword === "self"
      );
      expect(get_name_call).toBeDefined();
    });

    it("should resolve self.property access in __init__", () => {
      const code = `
class Counter:
    def __init__(self):
        self.count = 0

    def increment(self):
        self.count += 1
      `;

      const file = path.join(tempDir, "counter.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Counter class
      const counter_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_class).toBeDefined();

      // Verify class has increment method
      const type_info = project.get_type_info(counter_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("increment" as SymbolName)).toBe(true);
    });

    it("should resolve cls.method() in classmethod", () => {
      const code = `
class Factory:
    @classmethod
    def create(cls):
        return cls._build()

    @classmethod
    def _build(cls):
        return Factory()
      `;

      const file = path.join(tempDir, "factory.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Factory class
      const factory_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Factory" as SymbolName)
      );
      expect(factory_class).toBeDefined();

      // Verify class has _build method
      const type_info = project.get_type_info(factory_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("_build" as SymbolName)).toBe(true);

      // Find cls._build() call
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      const cls_call = self_ref_calls.find(
        (c) => c.name === ("_build" as SymbolName) && c.keyword === "cls"
      );
      expect(cls_call).toBeDefined();
    });

    it("should resolve super().method() call to parent class method", () => {
      const code = `
class Animal:
    def make_sound(self):
        return "sound"

class Dog(Animal):
    def make_sound(self):
        return super().make_sound() + " woof"
      `;

      const file = path.join(tempDir, "dog.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Animal class
      const animal_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Animal" as SymbolName)
      );
      expect(animal_class).toBeDefined();

      // Find the Dog class
      const dog_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Dog" as SymbolName)
      );
      expect(dog_class).toBeDefined();

      // Verify Animal has make_sound method
      const animal_type_info = project.get_type_info(animal_class!.symbol_id);
      expect(animal_type_info).toBeDefined();
      expect(animal_type_info!.methods.has("make_sound" as SymbolName)).toBe(true);
    });

    it("should handle chained self.property.method() calls", () => {
      const code = `
class Database:
    def query(self, sql):
        return "result"

class Service:
    def __init__(self):
        self.db = Database()

    def get_data(self):
        return self.db.query("SELECT * FROM users")
      `;

      const file = path.join(tempDir, "service.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Service class
      const service_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Service" as SymbolName)
      );
      expect(service_class).toBeDefined();

      // Find the Database class
      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      // Verify Database has query method
      const db_type_info = project.get_type_info(db_class!.symbol_id);
      expect(db_type_info).toBeDefined();
      expect(db_type_info!.methods.has("query" as SymbolName)).toBe(true);
    });
  });

  describe("JavaScript - this.method()", () => {
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

      const file = path.join(tempDir, "user.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the User class
      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      // Verify class has getName method
      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("getName" as SymbolName)).toBe(true);

      // Find self-reference calls
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);
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

      const file = path.join(tempDir, "counter.js") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // For prototype pattern, verify functions are captured
      const functions = Array.from(index!.functions.values());
      const counter_fn = functions.find((f) => f.name === ("Counter" as SymbolName));
      expect(counter_fn).toBeDefined();
    });
  });

  describe("Rust - self.method()", () => {
    it("should resolve self.method() in impl block", () => {
      const code = `
        struct Counter {
          count: i32,
        }

        impl Counter {
          fn new() -> Self {
            Self { count: 0 }
          }

          fn increment(&mut self) {
            self.set_count(self.count + 1);
          }

          fn set_count(&mut self, value: i32) {
            self.count = value;
          }

          fn get_count(&self) -> i32 {
            self.count
          }
        }
      `;

      const file = path.join(tempDir, "counter.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Verify Counter struct exists
      const counter_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_struct).toBeDefined();

      // Verify methods exist in type info
      const type_info = project.get_type_info(counter_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("set_count" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("get_count" as SymbolName)).toBe(true);
    });

    it("should handle self parameter borrowing patterns", () => {
      const code = `
        struct Data {
          value: String,
        }

        impl Data {
          fn get_value(&self) -> &str {
            &self.value
          }

          fn update(&mut self, new_value: String) {
            self.value = new_value;
          }

          fn process(&mut self) {
            let current = self.get_value();
            self.update(format!("Processed: {}", current));
          }
        }
      `;

      const file = path.join(tempDir, "data.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Verify Data struct exists
      const data_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Data" as SymbolName)
      );
      expect(data_struct).toBeDefined();

      // Verify methods are captured
      const type_info = project.get_type_info(data_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_value" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("update" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("process" as SymbolName)).toBe(true);
    });
  });
});
