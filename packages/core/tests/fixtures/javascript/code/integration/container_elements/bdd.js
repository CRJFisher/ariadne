import { Suite } from "./suite.js";

/**
 * mocha lib/interfaces/bdd.js: a test is added to the suite read out of the
 * stack, never to the parameter the stack was built from.
 *
 * @param {Suite} suite Root suite.
 */
export function bddInterface(suite) {
  var suites = [suite];

  function it(test) {
    var s = suites[0];
    s.addTest(test);
  }

  return it;
}
