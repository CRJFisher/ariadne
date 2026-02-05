/**
 * Factory pattern functions
 * Tests: Factory functions that return objects with methods, method resolution
 */

// Simple factory function
function createUser(name, email) {
  return {
    name: name,
    email: email,
    getName() {
      return this.name;
    },
    getEmail() {
      return this.email;
    },
    updateProfile(newName, newEmail) {
      this.name = newName;
      this.email = newEmail;
      return this;
    }
  };
}

// Factory with closure
function createCounter(initialValue = 0) {
  let count = initialValue;

  return {
    increment() {
      count++;
      return count;
    },
    decrement() {
      count--;
      return count;
    },
    getValue() {
      return count;
    },
    reset() {
      count = initialValue;
      return this;
    }
  };
}

// Factory with helper functions
function createCalculator() {
  function add(a, b) {
    return a + b;
  }

  function multiply(a, b) {
    return a * b;
  }

  return {
    add: add,
    multiply: multiply,
    compute(operation, a, b) {
      if (operation === 'add') {
        return add(a, b);
      } else if (operation === 'multiply') {
        return multiply(a, b);
      }
      return 0;
    }
  };
}

// Using the factories
const user1 = createUser("Alice", "alice@example.com");
const userName = user1.getName();
const userEmail = user1.getEmail();

const counter = createCounter(10);
const count1 = counter.increment();
const count2 = counter.getValue();

const calc = createCalculator();
const sum = calc.add(5, 3);
const product = calc.multiply(4, 7);
const computed = calc.compute('add', 10, 20);

export {
  createUser,
  createCounter,
  createCalculator,
  user1,
  userName,
  userEmail,
  counter,
  count1,
  count2,
  calc,
  sum,
  product,
  computed,
};