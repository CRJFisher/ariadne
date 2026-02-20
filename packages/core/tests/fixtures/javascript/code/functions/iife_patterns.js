/**
 * IIFE (Immediately Invoked Function Expression) patterns
 * Tests: Self-executing functions, different IIFE styles, scope isolation
 */

// Classic IIFE pattern
const result1 = (function() {
  function helper() {
    return "from classic IIFE";
  }
  return helper();
})();

// Arrow function IIFE
const result2 = (() => {
  const helper = () => "from arrow IIFE";
  return helper();
})();

// IIFE with parameters
const result3 = ((name) => {
  function greet() {
    return `Hello, ${name}!`;
  }
  return greet();
})("World");

// Nested IIFEs
const result4 = (function() {
  const outer = "outer value";

  return (function() {
    function helper() {
      return outer;
    }
    return helper();
  })();
})();

// IIFE creating namespace
const MyNamespace = (function() {
  function privateHelper() {
    return "private function";
  }

  function publicMethod() {
    return privateHelper();
  }

  return {
    publicMethod
  };
})();

const namespaceResult = MyNamespace.publicMethod();

module.exports = {
  result1,
  result2,
  result3,
  result4,
  namespaceResult,
  MyNamespace,
};
