import { Suite } from "./suite.js";

/**
 * mocha lib/interfaces/common.js: the suite stack arrives as a parameter typed
 * only by its JSDoc.
 *
 * @param {Suite[]} suites
 */
export function createCommon(suites) {
  return {
    afterEach(fn) {
      suites[0].afterEach(fn);
    },
    dynamicAfterEach(index, fn) {
      suites[index].afterEach(fn);
    },
  };
}
