// The other three, on the subclass: coverage is only complete through the base - type_check_environment.ts

import { BaseEnvironment } from "./base_environment";

export class Environment extends BaseEnvironment {
  pipeInst(name: string): string {
    return name;
  }

  referenceExternalType(name: string): string {
    return name;
  }

  getPreludeStatements(): string {
    return "";
  }
}
