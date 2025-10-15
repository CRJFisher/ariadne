/**
 * Shadowing scenario - main_shadowing.ts
 * Tests: imports helper but local definition shadows the import
 */

import { helper, otherFunction } from './utils';

// Local function with same name as imported function
function helper(): string {
  return "local helper";
}

// This call should resolve to LOCAL helper, not imported one
const result = helper();

// This call should resolve to imported function (no shadowing)
const other = otherFunction();

export { result, other };