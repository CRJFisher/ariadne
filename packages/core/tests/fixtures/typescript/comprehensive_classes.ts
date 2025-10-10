// @ts-nocheck
// @ts-nocheck
// Comprehensive class testing

// Basic class with access modifiers
export class Person {
  public name: string;
  private _age: number;
  protected address: string;
  readonly id: string;

  constructor(name: string, age: number, address: string) {
    this.name = name;
    this._age = age;
    this.address = address;
    this.id = Math.random().toString(36);
  }

  public getName(): string {
    return this.name;
  }

  private validateAge(age: number): boolean {
    return age >= 0 && age <= 150;
  }

  protected getAddress(): string {
    return this.address;
  }

  public getAge(): number {
    return this._age;
  }

  public setAge(age: number): void {
    if (this.validateAge(age)) {
      this._age = age;
    }
  }
}

// Class with parameter properties
export class Employee {
  // Parameter properties combine declaration and assignment
  constructor(
    public readonly employeeId: string,
    public name: string,
    private salary: number,
    protected department: string,
  ) {}

  public getSalary(): number {
    return this.salary;
  }

  public setSalary(newSalary: number): void {
    if (newSalary > 0) {
      this.salary = newSalary;
    }
  }

  protected getDepartment(): string {
    return this.department;
  }
}

// Abstract class
export abstract class Animal {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  // Abstract method - must be implemented by subclasses
  abstract makeSound(): string;

  // Concrete method
  public move(distance: number = 0): void {
    console.log(`${this.name} moved ${distance} meters`);
  }

  protected getName(): string {
    return this.name;
  }
}

// Inheritance
export class Dog extends Animal {
  private breed: string;

  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }

  makeSound(): string {
    return "Woof! Woof!";
  }

  public getBreed(): string {
    return this.breed;
  }

  // Override parent method
  public move(distance: number = 5): void {
    console.log(`${this.getName()} runs ${distance} meters`);
  }
}

export class Cat extends Animal {
  constructor(name: string, private indoor: boolean = true) {
    super(name);
  }

  makeSound(): string {
    return "Meow!";
  }

  public isIndoor(): boolean {
    return this.indoor;
  }
}

// Interface implementation
export interface Flyable {
  fly(): void;
  altitude: number;
}

export interface Swimmable {
  swim(): void;
  depth: number;
}

export class Duck extends Animal implements Flyable, Swimmable {
  public altitude: number = 0;
  public depth: number = 0;

  constructor(name: string) {
    super(name);
  }

  makeSound(): string {
    return "Quack!";
  }

  fly(): void {
    this.altitude = 100;
    console.log(`${this.getName()} is flying at ${this.altitude} feet`);
  }

  swim(): void {
    this.depth = 5;
    console.log(`${this.getName()} is swimming at ${this.depth} feet deep`);
  }
}

// Static members
export class MathUtils {
  public static readonly PI: number = 3.14159;
  private static instance: MathUtils;

  // Private constructor for singleton pattern
  private constructor() {}

  public static getInstance(): MathUtils {
    if (!MathUtils.instance) {
      MathUtils.instance = new MathUtils();
    }
    return MathUtils.instance;
  }

  public static circleArea(radius: number): number {
    return MathUtils.PI * radius * radius;
  }

  public static circleCircumference(radius: number): number {
    return 2 * MathUtils.PI * radius;
  }

  public instanceMethod(): string {
    return "Instance method called";
  }
}

// Generic class
export class GenericRepository<T extends { id: string }> {
  private items: Map<string, T> = new Map();

  public add(item: T): void {
    this.items.set(item.id, item);
  }

  public findById(id: string): T | undefined {
    return this.items.get(id);
  }

  public getAll(): T[] {
    return Array.from(this.items.values());
  }

  public remove(id: string): boolean {
    return this.items.delete(id);
  }

  public count(): number {
    return this.items.size;
  }

  public clear(): void {
    this.items.clear();
  }

  // Generic method
  public transform<U>(transformer: (item: T) => U): U[] {
    return this.getAll().map(transformer);
  }
}

// Decorators
export function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

export function logged(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    console.log(`Calling ${propertyName} with args:`, args);
    const result = originalMethod.apply(this, args);
    console.log(`${propertyName} returned:`, result);
    return result;
  };
}

export function validate(target: any, propertyName: string) {
  let value = target[propertyName];

  const getter = () => value;
  const setter = (newValue: any) => {
    if (newValue == null) {
      throw new Error(`${propertyName} cannot be null or undefined`);
    }
    value = newValue;
  };

  Object.defineProperty(target, propertyName, {
    get: getter,
    set: setter,
    enumerable: true,
    configurable: true,
  });
}

// Class with decorators
@sealed
export class DecoratedClass {
  @validate
  public validatedProperty: string;

  constructor(initialValue: string) {
    this.validatedProperty = initialValue;
  }

  @logged
  public decoratedMethod(input: string): string {
    return `Processed: ${input}`;
  }

  @logged
  public async asyncMethod(delay: number): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, delay));
    return `Completed after ${delay}ms`;
  }
}

// Getters and setters
export class Temperature {
  private _celsius: number = 0;

  public get celsius(): number {
    return this._celsius;
  }

  public set celsius(value: number) {
    this._celsius = value;
  }

  public get fahrenheit(): number {
    return (this._celsius * 9/5) + 32;
  }

  public set fahrenheit(value: number) {
    this._celsius = (value - 32) * 5/9;
  }

  public get kelvin(): number {
    return this._celsius + 273.15;
  }

  public set kelvin(value: number) {
    this._celsius = value - 273.15;
  }
}

// Namespace class
export namespace Geometry {
  export class Point {
    constructor(public x: number, public y: number) {}

    public distanceTo(other: Point): number {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  export class Circle {
    constructor(public center: Point, public radius: number) {}

    public area(): number {
      return Math.PI * this.radius * this.radius;
    }

    public circumference(): number {
      return 2 * Math.PI * this.radius;
    }
  }
}

// Mixin pattern
type Constructor<T = {}> = new (...args: any[]) => T;

export function Timestamped<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    public createdAt: Date = new Date();
    public updatedAt: Date = new Date();

    public touch(): void {
      this.updatedAt = new Date();
    }
  };
}

export function Serializable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    public serialize(): string {
      return JSON.stringify(this);
    }

    public static deserialize(json: string): any {
      return JSON.parse(json);
    }
  };
}

// Using mixins
export class BaseUser {
  constructor(public name: string) {}
}

export class TimestampedUser extends Timestamped(BaseUser) {
  constructor(name: string, public email: string) {
    super(name);
  }
}

export class SerializableUser extends Serializable(BaseUser) {
  constructor(name: string, public age: number) {
    super(name);
  }
}

export class FullFeaturedUser extends Serializable(Timestamped(BaseUser)) {
  constructor(name: string, public role: string) {
    super(name);
  }
}