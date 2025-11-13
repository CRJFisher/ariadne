// Callback patterns for testing callback detection

// External callbacks - forEach, map, filter
const numbers = [1, 2, 3, 4, 5];

// Map callback
const doubled = numbers.map((n) => n * 2);

// Filter callback
const evens = numbers.filter((n) => n % 2 === 0);

// ForEach callback
numbers.forEach((n) => console.log(n));

// Internal callbacks - user-defined higher-order function
function runCallback(cb: () => void) {
  cb();
}

runCallback(() => {
  console.log("internal callback");
});

// Nested callbacks
const nested = numbers.map((n) => {
  return [n].filter((x) => x > 2);
});

// Callback with multiple parameters
const pairs = numbers.map((n, i) => ({ value: n, index: i }));

// Non-callback anonymous functions
const standaloneArrow = () => {
  return "not a callback";
};

const standaloneFunctionExpr = function() {
  return "also not a callback";
};
