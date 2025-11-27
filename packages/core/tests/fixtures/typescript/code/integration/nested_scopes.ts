/**
 * Nested function scopes
 * Tests: enclosing_function_scope_id for calls at different scope levels
 */

// Top-level function call (module scope)
const top_level = helper();

function outer_function() {
  // Call in outer function scope
  const outer_call = helper();

  if (true) {
    // Call in block scope (enclosing function: outerFunction)
    const block_call = helper();
  }

  function inner_function() {
    // Call in inner function scope
    const inner_call = helper();
    return inner_call;
  }

  const inner_result = inner_function();
  return { outer_call, inner_result };
}

function helper(): string {
  return "helper result";
}

// Calls from different scopes
const module_result = outer_function();

export { top_level, module_result, helper };