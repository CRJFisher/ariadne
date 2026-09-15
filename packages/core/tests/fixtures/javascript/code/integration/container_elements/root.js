import { Suite } from "./suite.js";

export function run() {
  var suites = [new Suite("root")];
  suites[0].beforeAll();
  suites.push(new Suite("child"));
}
