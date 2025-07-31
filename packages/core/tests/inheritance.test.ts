import { Project } from "../src/index";
import { Def } from "../src/graph";

describe("Class Inheritance Analysis", () => {
  describe("TypeScript", () => {
    it("should extract parent class for simple inheritance", () => {
      const project = new Project();
      const code = `
class Animal {
  name: string;
}

class Dog extends Animal {
  breed: string;
}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const animal = defs.find(d => d.name === "Animal" && d.symbol_kind === "class");
      const dog = defs.find(d => d.name === "Dog" && d.symbol_kind === "class");
      
      expect(animal).toBeDefined();
      expect(dog).toBeDefined();
      
      const dogRelationships = project.get_class_relationships(dog!);
      expect(dogRelationships).toBeDefined();
      expect(dogRelationships!.parent_class).toBe("Animal");
      expect(dogRelationships!.parent_class_def?.symbol_id).toBe(animal!.symbol_id);
    });

    it("should extract implemented interfaces", () => {
      const project = new Project();
      const code = `
interface Flyable {
  fly(): void;
}

interface Swimmable {
  swim(): void;
}

class Duck implements Flyable, Swimmable {
  fly() {}
  swim() {}
}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const flyable = defs.find(d => d.name === "Flyable" && d.symbol_kind === "interface");
      const swimmable = defs.find(d => d.name === "Swimmable" && d.symbol_kind === "interface");
      const duck = defs.find(d => d.name === "Duck" && d.symbol_kind === "class");
      
      expect(flyable).toBeDefined();
      expect(swimmable).toBeDefined();
      expect(duck).toBeDefined();
      
      const duckRelationships = project.get_class_relationships(duck!);
      expect(duckRelationships).toBeDefined();
      expect(duckRelationships!.implemented_interfaces).toEqual(["Flyable", "Swimmable"]);
      expect(duckRelationships!.interface_defs).toHaveLength(2);
      expect(duckRelationships!.interface_defs[0].symbol_id).toBe(flyable!.symbol_id);
      expect(duckRelationships!.interface_defs[1].symbol_id).toBe(swimmable!.symbol_id);
    });

    it("should handle both extends and implements", () => {
      const project = new Project();
      const code = `
interface Flyable {
  fly(): void;
}

class Bird {
  wingspan: number;
}

class Eagle extends Bird implements Flyable {
  fly() {}
}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const bird = defs.find(d => d.name === "Bird" && d.symbol_kind === "class");
      const eagle = defs.find(d => d.name === "Eagle" && d.symbol_kind === "class");
      
      const eagleRelationships = project.get_class_relationships(eagle!);
      expect(eagleRelationships).toBeDefined();
      expect(eagleRelationships!.parent_class).toBe("Bird");
      expect(eagleRelationships!.parent_class_def?.symbol_id).toBe(bird!.symbol_id);
      expect(eagleRelationships!.implemented_interfaces).toEqual(["Flyable"]);
    });

    it("should return null for non-class definitions", () => {
      const project = new Project();
      const code = `
function myFunction() {}
const myVariable = 42;`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const func = defs.find(d => d.name === "myFunction");
      const variable = defs.find(d => d.name === "myVariable");
      
      expect(project.get_class_relationships(func!)).toBeNull();
      expect(project.get_class_relationships(variable!)).toBeNull();
    });
  });

  describe("JavaScript", () => {
    it("should extract parent class for ES6 classes", () => {
      const project = new Project();
      const code = `
class Vehicle {
  constructor(speed) {
    this.speed = speed;
  }
}

class Car extends Vehicle {
  constructor(speed, wheels) {
    super(speed);
    this.wheels = wheels;
  }
}`;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      
      const vehicle = defs.find(d => d.name === "Vehicle" && d.symbol_kind === "class");
      const car = defs.find(d => d.name === "Car" && d.symbol_kind === "class");
      
      const carRelationships = project.get_class_relationships(car!);
      expect(carRelationships).toBeDefined();
      expect(carRelationships!.parent_class).toBe("Vehicle");
      expect(carRelationships!.parent_class_def?.symbol_id).toBe(vehicle!.symbol_id);
      expect(carRelationships!.implemented_interfaces).toEqual([]);
    });
  });

  describe("Python", () => {
    it("should extract single inheritance", () => {
      const project = new Project();
      const code = `
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def bark(self):
        print("Woof!")`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      const animal = defs.find(d => d.name === "Animal" && d.symbol_kind === "class");
      const dog = defs.find(d => d.name === "Dog" && d.symbol_kind === "class");
      
      const dogRelationships = project.get_class_relationships(dog!);
      expect(dogRelationships).toBeDefined();
      expect(dogRelationships!.parent_class).toBe("Animal");
      expect(dogRelationships!.parent_class_def?.symbol_id).toBe(animal!.symbol_id);
    });

    it("should handle multiple inheritance", () => {
      const project = new Project();
      const code = `
class Flyable:
    def fly(self):
        pass

class Swimmable:
    def swim(self):
        pass

class Duck(Flyable, Swimmable):
    def quack(self):
        print("Quack!")`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      
      const flyable = defs.find(d => d.name === "Flyable" && d.symbol_kind === "class");
      const swimmable = defs.find(d => d.name === "Swimmable" && d.symbol_kind === "class");
      const duck = defs.find(d => d.name === "Duck" && d.symbol_kind === "class");
      
      const duckRelationships = project.get_class_relationships(duck!);
      expect(duckRelationships).toBeDefined();
      expect(duckRelationships!.parent_class).toBe("Flyable"); // First parent is primary
      expect(duckRelationships!.parent_class_def?.symbol_id).toBe(flyable!.symbol_id);
      expect(duckRelationships!.implemented_interfaces).toEqual(["Swimmable"]); // Additional parents treated as interfaces
      expect(duckRelationships!.interface_defs[0].symbol_id).toBe(swimmable!.symbol_id);
    });
  });

  describe("find_subclasses", () => {
    it("should find all classes extending a parent class", () => {
      const project = new Project();
      const code = `
class Animal {}
class Dog extends Animal {}
class Cat extends Animal {}
class Labrador extends Dog {}
class Vehicle {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const animal = defs.find(d => d.name === "Animal" && d.symbol_kind === "class");
      const dog = defs.find(d => d.name === "Dog" && d.symbol_kind === "class");
      const cat = defs.find(d => d.name === "Cat" && d.symbol_kind === "class");
      const vehicle = defs.find(d => d.name === "Vehicle" && d.symbol_kind === "class");
      
      const animalSubclasses = project.find_subclasses(animal!);
      expect(animalSubclasses).toHaveLength(2);
      expect(animalSubclasses.map(d => d.name).sort()).toEqual(["Cat", "Dog"]);
      
      const dogSubclasses = project.find_subclasses(dog!);
      expect(dogSubclasses).toHaveLength(1);
      expect(dogSubclasses[0].name).toBe("Labrador");
      
      const vehicleSubclasses = project.find_subclasses(vehicle!);
      expect(vehicleSubclasses).toHaveLength(0);
    });

    it("should work across multiple files", () => {
      const project = new Project();
      
      project.add_or_update_file("base.ts", `
export class BaseClass {
  baseMethod() {}
}`);
      
      project.add_or_update_file("derived1.ts", `
import { BaseClass } from './base';
export class DerivedA extends BaseClass {}`);
      
      project.add_or_update_file("derived2.ts", `
import { BaseClass } from './base';
export class DerivedB extends BaseClass {}`);
      
      const baseDefs = project.get_definitions("base.ts");
      const baseClass = baseDefs.find(d => d.name === "BaseClass");
      
      const subclasses = project.find_subclasses(baseClass!);
      expect(subclasses).toHaveLength(2);
      expect(subclasses.map(d => d.name).sort()).toEqual(["DerivedA", "DerivedB"]);
    });
  });

  describe("find_implementations", () => {
    it("should find all classes implementing an interface", () => {
      const project = new Project();
      const code = `
interface Serializable {
  serialize(): string;
}

interface Comparable {
  compareTo(other: any): number;
}

class User implements Serializable {
  serialize() { return ""; }
}

class Product implements Serializable, Comparable {
  serialize() { return ""; }
  compareTo(other: any) { return 0; }
}

class Service {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const serializable = defs.find(d => d.name === "Serializable" && d.symbol_kind === "interface");
      const comparable = defs.find(d => d.name === "Comparable" && d.symbol_kind === "interface");
      
      const serializableImpls = project.find_implementations(serializable!);
      expect(serializableImpls).toHaveLength(2);
      expect(serializableImpls.map(d => d.name).sort()).toEqual(["Product", "User"]);
      
      const comparableImpls = project.find_implementations(comparable!);
      expect(comparableImpls).toHaveLength(1);
      expect(comparableImpls[0].name).toBe("Product");
    });
  });

  describe("get_inheritance_chain", () => {
    it("should return complete inheritance chain", () => {
      const project = new Project();
      const code = `
class Animal {}
class Mammal extends Animal {}
class Dog extends Mammal {}
class Labrador extends Dog {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const animal = defs.find(d => d.name === "Animal");
      const mammal = defs.find(d => d.name === "Mammal");
      const dog = defs.find(d => d.name === "Dog");
      const labrador = defs.find(d => d.name === "Labrador");
      
      const labradorChain = project.get_inheritance_chain(labrador!);
      expect(labradorChain).toHaveLength(3);
      expect(labradorChain[0].name).toBe("Dog");
      expect(labradorChain[1].name).toBe("Mammal");
      expect(labradorChain[2].name).toBe("Animal");
      
      const animalChain = project.get_inheritance_chain(animal!);
      expect(animalChain).toHaveLength(0); // No parents
    });

    it("should handle circular inheritance gracefully", () => {
      const project = new Project();
      // This shouldn't compile in real code, but we test for robustness
      const code = `
class A extends B {}
class B extends A {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const a = defs.find(d => d.name === "A");
      
      // Should not infinite loop
      const chain = project.get_inheritance_chain(a!);
      expect(chain.length).toBeLessThan(10); // Some reasonable limit
    });
  });

  describe("is_subclass_of", () => {
    it("should correctly identify inheritance relationships", () => {
      const project = new Project();
      const code = `
class Animal {}
class Dog extends Animal {}
class Labrador extends Dog {}
class Cat extends Animal {}
class Vehicle {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const animal = defs.find(d => d.name === "Animal");
      const dog = defs.find(d => d.name === "Dog");
      const labrador = defs.find(d => d.name === "Labrador");
      const cat = defs.find(d => d.name === "Cat");
      const vehicle = defs.find(d => d.name === "Vehicle");
      
      // Direct inheritance
      expect(project.is_subclass_of(dog!, animal!)).toBe(true);
      expect(project.is_subclass_of(cat!, animal!)).toBe(true);
      
      // Transitive inheritance
      expect(project.is_subclass_of(labrador!, animal!)).toBe(true);
      expect(project.is_subclass_of(labrador!, dog!)).toBe(true);
      
      // No inheritance
      expect(project.is_subclass_of(dog!, cat!)).toBe(false);
      expect(project.is_subclass_of(animal!, dog!)).toBe(false);
      expect(project.is_subclass_of(vehicle!, animal!)).toBe(false);
    });

    it("should return false for non-class definitions", () => {
      const project = new Project();
      const code = `
class MyClass {}
function myFunction() {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      
      const cls = defs.find(d => d.name === "MyClass");
      const func = defs.find(d => d.name === "myFunction");
      
      expect(project.is_subclass_of(func!, cls!)).toBe(false);
      expect(project.is_subclass_of(cls!, func!)).toBe(false);
    });
  });

  describe("caching", () => {
    it("should cache inheritance relationships", () => {
      const project = new Project();
      const code = `
class Parent {}
class Child extends Parent {}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      const child = defs.find(d => d.name === "Child");
      
      // First call
      const result1 = project.get_class_relationships(child!);
      
      // Second call should return same object (cached)
      const result2 = project.get_class_relationships(child!);
      
      expect(result1).toBe(result2); // Same reference
    });
  });
});

describe("Rust trait implementation", () => {
  test("should extract trait implementations", () => {
    const code = `
trait Animal {
    fn speak(&self);
}

trait Mammal {
    fn fur_color(&self) -> &str;
}

struct Dog {
    name: String,
}

impl Animal for Dog {
    fn speak(&self) {
        println!("Woof!");
    }
}

impl Mammal for Dog {
    fn fur_color(&self) -> &str {
        "brown"
    }
}
`;
    
    const project = new Project();
    project.add_or_update_file("test.rs", code);
    
    const defs = project.get_definitions("test.rs");
    const dog = defs.find(d => d.name === "Dog" && d.symbol_kind === "struct");
    
    expect(dog).toBeDefined();
    
    const relationships = project.get_class_relationships(dog!);
    expect(relationships).not.toBeNull();
    expect(relationships!.implemented_interfaces).toContain("Animal");
    expect(relationships!.implemented_interfaces).toContain("Mammal");
    expect(relationships!.implemented_interfaces.length).toBe(2);
  });

  test("should find structs implementing a trait", () => {
    const code = `
trait Display {
    fn fmt(&self) -> String;
}

struct Point {
    x: i32,
    y: i32,
}

struct Circle {
    radius: f64,
}

impl Display for Point {
    fn fmt(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}

impl Display for Circle {
    fn fmt(&self) -> String {
        format!("Circle({})", self.radius)
    }
}
`;
    
    const project = new Project();
    project.add_or_update_file("test.rs", code);
    
    const defs = project.get_definitions("test.rs");
    const display = defs.find(d => d.name === "Display");
    
    expect(display).toBeDefined();
    
    const implementers = project.find_implementations(display!);
    expect(implementers.length).toBe(2);
    expect(implementers.map(d => d.name).sort()).toEqual(["Circle", "Point"]);
  });
});