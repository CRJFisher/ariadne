/**
 * Shadowing scenario - shadowing.js
 * Tests: Local function definition shadows imported function
 */

import { helper } from './utils_es6.js';

// Local function with same name as imported function - shadows the import
function helper() {
  return "local helper";
}

// This call should resolve to LOCAL helper, not imported one
const result = helper();

// Use a different imported function to verify imports still work
import { processData } from './utils_es6.js';
const processed = processData("TEST");

export {
  result,
  processed,
};