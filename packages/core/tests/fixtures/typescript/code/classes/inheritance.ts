/**
 * Class inheritance and abstract classes
 * Tests: abstract class, extends, method overriding
 */

abstract class Animal {
  constructor(public name: string) {}

  abstract makeSound(): string;

  move(distance: number = 0): void {
    console.log(`${this.name} moved ${distance} meters`);
  }
}

class Dog extends Animal {
  constructor(name: string) {
    super(name);
  }

  makeSound(): string {
    return "Woof!";
  }

  fetch(item: string): void {
    console.log(`${this.name} fetched ${item}`);
  }
}

class Cat extends Animal {
  makeSound(): string {
    return "Meow!";
  }
}

export { Animal, Dog, Cat };
