/**
 * Basic function declarations
 * Tests: function declarations, parameters, return types
 */

function greet(name: string): string {
  return `Hello, ${name}!`;
}

function add(a: number, b: number): number {
  return a + b;
}

function process_user(name: string, age: number, active: boolean = true): object {
  return {
    name,
    age,
    active,
    createdAt: new Date(),
  };
}

function multiple_returns(value: number): string {
  if (value > 0) {
    return "positive";
  } else if (value < 0) {
    return "negative";
  } else {
    return "zero";
  }
}

export { greet, add, process_user, multiple_returns };
