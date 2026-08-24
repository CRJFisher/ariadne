import { helper } from "./utils";
import { dispatch } from "./registry";
import { run } from "./callback";
import { parse_payload, report } from "./unresolved";

export function main(): number {
  const seeded = helper(1);
  const dispatched = dispatch(0, seeded);
  const applied = run(dispatched);
  parse_payload("{}");
  report("done");
  return applied;
}

const BOOTSTRAP = main();

report(`bootstrapped at ${BOOTSTRAP}`);
