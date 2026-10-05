// The caller: names the environment interface only - environment_caller.ts

import { TcbEnvironment } from "./environment";

export function prelude(env: TcbEnvironment): string {
  return env.getPreludeStatements();
}
