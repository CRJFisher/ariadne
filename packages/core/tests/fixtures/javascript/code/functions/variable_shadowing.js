/**
 * Variable shadowing scenarios
 * Tests: Variable shadowing at different scope levels, resolution priority
 */

// Global variable
const globalVar = "global value";

function outerFunction() {
  // Shadows global variable
  const globalVar = "outer function value";

  function helper() {
    return globalVar; // Should resolve to outer function's globalVar
  }

  const result1 = helper();

  if (true) {
    // Block scope shadows function scope
    const globalVar = "block scope value";

    function blockHelper() {
      return globalVar; // Should resolve to block scope's globalVar
    }

    const result2 = blockHelper();

    // Nested block with further shadowing
    {
      const globalVar = "nested block value";

      const getValue = () => {
        return globalVar; // Should resolve to nested block's globalVar
      };

      const result3 = getValue();
    }

    return { result1, result2 };
  }

  return result1;
}

// Function parameters shadow outer variables
function parameterShadowing(globalVar) {
  function getParam() {
    return globalVar; // Should resolve to parameter, not global
  }

  return getParam();
}

// Multiple levels of variable shadowing
function complexShadowing() {
  const data = "level 1";

  function level2() {
    const data = "level 2";

    function level3() {
      const data = "level 3";

      function getDeepData() {
        return data; // Should resolve to level 3's data
      }

      return getDeepData();
    }

    function getMiddleData() {
      return data; // Should resolve to level 2's data
    }

    return { level3: level3(), middle: getMiddleData() };
  }

  function getTopData() {
    return data; // Should resolve to level 1's data
  }

  return { top: getTopData(), nested: level2() };
}

// Using the shadowing functions
const outerResult = outerFunction();
const paramResult = parameterShadowing("parameter value");
const complexResult = complexShadowing();

export {
  globalVar,
  outerFunction,
  parameterShadowing,
  complexShadowing,
  outerResult,
  paramResult,
  complexResult,
};