import { Suite } from "./suite.js";

/**
 * mocha lib/interfaces/exports.js: the stack starts as a literal holding the
 * root suite parameter.
 *
 * @param {Suite} suite Root suite.
 */
export function exportsInterface(suite) {
  var suites = [suite];

  function visit(fn) {
    suites[0].beforeAll(fn);
  }

  return visit;
}
