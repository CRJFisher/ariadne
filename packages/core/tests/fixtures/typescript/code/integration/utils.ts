/**
 * Shadowing scenario - utils.ts
 * Tests: exported function that will be shadowed in importing file
 */

export function helper(): string {
  return "from utils";
}

export function otherFunction(): number {
  return 42;
}