/**
 * Shadowing scenario - utils.ts
 * Tests: exported function that will be shadowed in importing file
 */

export function helper(): string {
  return "from utils";
}

export function other_function(): number {
  return 42;
}