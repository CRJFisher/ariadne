/**
 * Arrow function expressions
 * Tests: arrow functions, implicit returns, closures
 */

// Simple arrow function
const double = (x: number): number => x * 2;

// Arrow function with block
const isEven = (n: number): boolean => {
  return n % 2 === 0;
};

// Arrow function returning object
const createUser = (name: string, age: number) => ({
  name,
  age,
  createdAt: Date.now(),
});

// Arrow function with multiple parameters
const formatName = (first: string, last: string): string => {
  return `${last}, ${first}`;
};

// Closure with arrow function
const makeCounter = (start: number = 0) => {
  let count = start;
  return () => ++count;
};

// Higher-order function
const map = <T, U>(arr: T[], fn: (item: T) => U): U[] => {
  const result: U[] = [];
  for (const item of arr) {
    result.push(fn(item));
  }
  return result;
};

export { double, isEven, createUser, formatName, makeCounter, map };
