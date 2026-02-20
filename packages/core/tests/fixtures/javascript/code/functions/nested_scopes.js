/**
 * Nested function scopes - nested_scopes.js
 * Tests: enclosing_function_scope_id for calls at different scope levels
 */

// Helper function for calls
function helper() {
  return "helper result";
}

// Top-level function call (module scope)
const topLevel = helper();

function outerFunction() {
  // Call in outer function scope
  const outerCall = helper();

  if (true) {
    // Call in block scope (enclosing function: outerFunction)
    const blockCall = helper();
  }

  function innerFunction() {
    // Call in inner function scope
    const innerCall = helper();

    // Nested function inside inner
    function deeperFunction() {
      const deepCall = helper();
      return deepCall;
    }

    const deepResult = deeperFunction();
    return { innerCall, deepResult };
  }

  const innerResult = innerFunction();
  return { outerCall, innerResult };
}

// Calls from different scopes
const moduleResult = outerFunction();

// Arrow function with nested call
const arrowFunction = () => {
  const arrowCall = helper();
  return arrowCall;
};

const arrowResult = arrowFunction();

export {
  topLevel,
  moduleResult,
  arrowResult,
  helper,
};