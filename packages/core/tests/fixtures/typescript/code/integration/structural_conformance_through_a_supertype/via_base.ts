// A dispatch through the declared parent - via_base.ts
// Tests: `Base` has a declared subtype, so its closure is read at dispatch; the
// closure widens when `Impl` is inferred below `Widget`, whenever that happens.

import { Base } from "./contract";

export function use_base(base: Base): void {
  base.run();
}
