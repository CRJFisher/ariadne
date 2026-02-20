// Generic types and functions

// Generic function
function identity<T>(value: T): T {
  return value;
}

// Generic function with constraint
function get_property<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic class
class Box<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  get_value(): T {
    return this.value;
  }

  set_value(value: T): void {
    this.value = value;
  }
}

// Generic class with multiple type parameters
class Pair<T, U> {
  constructor(public first: T, public second: U) {}

  swap(): Pair<U, T> {
    return new Pair(this.second, this.first);
  }
}

// Generic interface with constraint
interface Lengthwise {
  length: number;
}

function logging_identity<T extends Lengthwise>(arg: T): T {
  console.log(arg.length);
  return arg;
}

// Generic arrow function
const map = <T, U>(items: T[], fn: (item: T) => U): U[] => {
  return items.map(fn);
};

// Usage with type arguments
const result1 = identity<string>("hello");
const result2 = identity<number>(42);
const box = new Box<string>("content");
const pair = new Pair<number, string>(1, "one");