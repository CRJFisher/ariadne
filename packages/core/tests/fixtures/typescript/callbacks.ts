// Callback patterns for testing callback detection

// External callbacks - forEach, map, filter
const callback_numbers = [1, 2, 3, 4, 5];

// Map callback
const doubled = callback_numbers.map((n) => n * 2);

// Filter callback
const evens = callback_numbers.filter((n) => n % 2 === 0);

// ForEach callback
callback_numbers.forEach((n) => console.log(n));

// Internal callbacks - user-defined higher-order function
function run_callback(cb: () => void) {
  cb();
}

run_callback(() => {
  console.log("internal callback");
});

// Nested callbacks
const nested = callback_numbers.map((n) => {
  return [n].filter((x) => x > 2);
});

// Callback with multiple parameters
const pairs = callback_numbers.map((n, i) => ({ value: n, index: i }));

// Non-callback anonymous functions
const standalone_arrow = () => {
  return "not a callback";
};

const standalone_function_expr = function() {
  return "also not a callback";
};
