// The angular shape: the receiver's type comes from the accessor's return
// annotation, so the caller names neither the interface nor the
// implementation - accessor_caller.ts

import { getCompilerFacade } from "./accessor";

export function compileThroughAccessor(meta: string): string {
  const facade = getCompilerFacade();
  return facade.compileComponent(meta);
}
