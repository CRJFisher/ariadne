/**
 * ES6 class definitions
 * Tests: class declarations, constructors, methods
 */

class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
    this.active = true;
  }

  greet() {
    return `Hello, ${this.name}!`;
  }

  getInfo() {
    return {
      name: this.name,
      email: this.email,
      active: this.active,
    };
  }

  activate() {
    this.active = true;
  }

  deactivate() {
    this.active = false;
  }
}

class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    throw new Error("Subclass must implement speak()");
  }
}

class Dog extends Animal {
  static getSpecies() {
    return "Canis familiaris";
  }

  speak() {
    return "Woof!";
  }

  fetch(item) {
    return `${this.name} fetched ${item}`;
  }
}

// Example usage demonstrating constructor calls, method calls, and static methods
function main() {
  const myDog = new Dog("Buddy");
  myDog.speak();
  Dog.getSpecies();
  console.log(myDog.fetch("ball"));
}

module.exports = { User, Animal, Dog, main };
