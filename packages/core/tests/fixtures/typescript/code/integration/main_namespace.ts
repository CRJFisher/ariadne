/**
 * Namespace import scenario - main_namespace.ts
 * Tests: import * as utils from './utils'
 */

import * as utils from "./utils";

export function test_namespace_import() {
  // Call function via namespace
  const result1 = utils.helper();
  const result2 = utils.other_function();

  return { result1, result2 };
}
