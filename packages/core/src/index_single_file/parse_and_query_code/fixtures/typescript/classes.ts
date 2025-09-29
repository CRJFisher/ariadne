// @ts-nocheck
// TypeScript class features

// Class with access modifiers
class Person {
  public name: string;
  private age: number;
  protected address: string;
  readonly id: number;

  constructor(name: string, age: number, address: string) {
    this.name = name;
    this.age = age;
    this.address = address;
    this.id = Date.now();
  }

  public getAge(): number {
    return this.age;
  }

  private incrementAge(): void {
    this.age++;
  }

  protected getAddress(): string {
    return this.address;
  }
}

// Class with parameter properties
class SimpleEmployee {
  constructor(
    public name: string,
    private salary: number,
    protected department: string,
    readonly employeeId: number
  ) {}

  getSalary(): number {
    return this.salary;
  }
}

// Abstract class
abstract class Animal {
  abstract makeSound(): string;

  move(distance: number = 0): void {
    console.log(`Moved ${distance} meters`);
  }
}

class Dog extends Animal {
  makeSound(): string {
    return "Woof!";
  }
}

// Class with static members
class MathUtils {
  static readonly PI: number = 3.14159;
  static circleArea(radius: number): number {
    return this.PI * radius * radius;
  }
}

// Generic class with inheritance
class Collection<T> {
  protected items: T[] = [];

  add(item: T): void {
    this.items.push(item);
  }

  get(index: number): T {
    return this.items[index];
  }
}

class NumberCollection extends Collection<number> {
  sum(): number {
    return this.items.reduce((a, b) => a + b, 0);
  }
}

// Decorators
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

function log(_target: any, _propertyName: string, _descriptor: PropertyDescriptor): void {
  // Simple log decorator for testing
}

@sealed
class SealedClass {
  @log
  method(value: string): void {
    console.log(value);
  }
}