/**
 * Shadowing scenario - main_shadowing.ts
 * Tests: imports helper but local definition shadows the import
 */

import { helper, other_function } from "./utils";

// Local function with same name as imported function
function helper(): string {
  return "local helper";
}

// This call should resolve to LOCAL helper, not imported one
const result = helper();

// This call should resolve to imported function (no shadowing)
const other = other_function();

export { result, other };