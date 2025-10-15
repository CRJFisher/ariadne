/**
 * Nested function scopes
 * Tests: enclosing_function_scope_id for calls at different scope levels
 */

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
    return innerCall;
  }

  const innerResult = innerFunction();
  return { outerCall, innerResult };
}

function helper(): string {
  return "helper result";
}

// Calls from different scopes
const moduleResult = outerFunction();

export { topLevel, moduleResult, helper };