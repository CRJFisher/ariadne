/**
 * Basic function definitions
 * Tests: function declarations, arrow functions
 */

function greet(name) {
  console.log(`Greeting: ${name}`);
  return `Hello, ${name}!`;
}

function add(a, b) {
  return a + b;
}

const multiply = (a, b) => a * b;

const isEven = (n) => n % 2 === 0;

function callChain() {
  const data = fetchData();
  return transformData(data);
}

function fetchData() {
  return { value: 42 };
}

function transformData(data) {
  return data.value * 2;
}

// Example usage demonstrating function calls
function main() {
  greet("World");
  const sum = add(1, 2);
  const product = multiply(3, 4);
  console.log(`Sum: ${sum}, Product: ${product}`);
}

module.exports = {
  greet,
  add,
  multiply,
  isEven,
  callChain,
  main,
};
