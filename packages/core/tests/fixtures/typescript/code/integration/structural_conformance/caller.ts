// The caller: names core's replica, imports no implementation - caller.ts

import { CompilerFacade } from "./core_facade";

export function compile(facade: CompilerFacade, meta: string): string {
  return facade.compileNgModule(meta);
}
