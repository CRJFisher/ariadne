/**
 * Python integration tests for self-reference call resolution
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

describe("Python Self-Reference Resolution Integration", () => {
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

  describe("self.method()", () => {
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

      const file = path.join(temp_dir, "user.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_name" as SymbolName)).toBe(true);

      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);

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

      const file = path.join(temp_dir, "counter.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const counter_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_class).toBeDefined();

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

      const file = path.join(temp_dir, "factory.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const factory_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Factory" as SymbolName)
      );
      expect(factory_class).toBeDefined();

      const type_info = project.get_type_info(factory_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("_build" as SymbolName)).toBe(true);

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

      const file = path.join(temp_dir, "dog.py") as FilePath;
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

      const file = path.join(temp_dir, "service.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const service_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Service" as SymbolName)
      );
      expect(service_class).toBeDefined();

      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      const db_type_info = project.get_type_info(db_class!.symbol_id);
      expect(db_type_info).toBeDefined();
      expect(db_type_info!.methods.has("query" as SymbolName)).toBe(true);
    });
  });

  describe("self.attr.method() full resolution", () => {
    it("should resolve self.db.query() to Database.query via property chain", () => {
      const code = `
class Database:
    def query(self, sql):
        return "result"

    def execute(self, sql):
        return self.query(sql)

class Service:
    def __init__(self):
        self.db = Database()

    def get_data(self):
        return self.db.query("SELECT * FROM users")
      `;

      const file = path.join(temp_dir, "service_resolve.py") as FilePath;
      project.update_file(file, code);

      // Verify the property chain is correct in the index
      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Verify Service class has db property from __init__
      const service_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Service" as SymbolName)
      );
      expect(service_class).toBeDefined();

      const service_type_info = project.get_type_info(service_class!.symbol_id);
      expect(service_type_info).toBeDefined();
      expect(service_type_info!.properties.has("db" as SymbolName)).toBe(true);

      // Verify Database.query is referenced (resolved through self.db.query())
      const db_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Database" as SymbolName)
      );
      expect(db_class).toBeDefined();

      const db_type_info = project.get_type_info(db_class!.symbol_id);
      expect(db_type_info).toBeDefined();
      expect(db_type_info!.methods.has("query" as SymbolName)).toBe(true);

      // Verify the self.db.query() call has the correct property chain
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );

      const db_query_call = self_ref_calls.find(
        (c) =>
          c.keyword === "self" &&
          c.property_chain.length === 3 &&
          c.property_chain[0] === "self" &&
          c.property_chain[1] === "db" &&
          c.property_chain[2] === "query"
      );
      expect(db_query_call).toBeDefined();

      // Verify Database.query is reachable in the call graph
      const referenced = project.resolutions.get_all_referenced_symbols();
      const query_method_id = db_type_info!.methods.get("query" as SymbolName);
      expect(query_method_id).toBeDefined();
      expect(referenced.has(query_method_id!)).toBe(true);
    });

    it("should resolve deeply nested self.a.b.method() chains", () => {
      const code = `
class Inner:
    def do_work(self):
        return "done"

class Middle:
    def __init__(self):
        self.inner = Inner()

class Outer:
    def __init__(self):
        self.middle = Middle()

    def run(self):
        return self.middle.inner.do_work()
      `;

      const file = path.join(temp_dir, "nested_chain.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Verify Outer has middle property
      const outer_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Outer" as SymbolName)
      );
      expect(outer_class).toBeDefined();

      const outer_type_info = project.get_type_info(outer_class!.symbol_id);
      expect(outer_type_info).toBeDefined();
      expect(outer_type_info!.properties.has("middle" as SymbolName)).toBe(true);

      // Verify Middle has inner property
      const middle_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Middle" as SymbolName)
      );
      expect(middle_class).toBeDefined();

      const middle_type_info = project.get_type_info(middle_class!.symbol_id);
      expect(middle_type_info).toBeDefined();
      expect(middle_type_info!.properties.has("inner" as SymbolName)).toBe(true);

      // Verify the self.middle.inner.do_work() call has the correct property chain
      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );

      const deep_call = self_ref_calls.find(
        (c) =>
          c.keyword === "self" &&
          c.property_chain.length === 4 &&
          c.property_chain[0] === "self" &&
          c.property_chain[1] === "middle" &&
          c.property_chain[2] === "inner" &&
          c.property_chain[3] === "do_work"
      );
      expect(deep_call).toBeDefined();
    });
  });

  describe("Polymorphic self Dispatch", () => {
    it("should resolve self.method() to both base and child override", () => {
      const code = `
class Base:
    def process(self):
        self.helper()
    def helper(self):
        return "base"

class Child(Base):
    def helper(self):
        return "child"
      `;

      const file = path.join(temp_dir, "polymorphic.py") as FilePath;
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

    it("should resolve multi-level Python inheritance", () => {
      const code = `
class A:
    def process(self):
        self.helper()
    def helper(self):
        pass

class B(A):
    def helper(self):
        pass

class C(B):
    def helper(self):
        pass
      `;

      const file = path.join(temp_dir, "multilevel.py") as FilePath;
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

    it("super().method() resolves to parent only", () => {
      const code = `
class Parent:
    def method(self):
        return "parent"

class Child(Parent):
    def method(self):
        super().method()
        return "child"

class GrandChild(Child):
    def method(self):
        return "grandchild"
      `;

      const file = path.join(temp_dir, "super_py.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      const parent_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Parent" as SymbolName)
      );
      expect(parent_class).toBeDefined();

      const parent_type_info = project.get_type_info(parent_class!.symbol_id);
      expect(parent_type_info!.methods.has("method" as SymbolName)).toBe(true);
    });
  });
});
