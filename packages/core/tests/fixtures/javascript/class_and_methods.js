// Class with methods and constructor
class Dog {
  constructor(name, breed) {
    this.name = name;
    this.breed = breed;
  }

  speak() {
    return "Woof! My name is " + this.name;
  }

  static getSpecies() {
    return "Canis familiaris";
  }
}

const myDog = new Dog("Buddy", "Golden Retriever");
const message = myDog.speak();
const species = Dog.getSpecies();
