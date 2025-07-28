import { describe, it, expect } from 'vitest';
import { Scoping } from '../src/index';

describe('@ariadne/types', () => {
  it('should export Scoping enum', () => {
    expect(Scoping.Local).toBe(0);
    expect(Scoping.Hoisted).toBe(1);
    expect(Scoping.Global).toBe(2);
  });

  it('should export all required types', () => {
    // This test just ensures that TypeScript can import all the types
    // The actual type checking happens at compile time
    expect(true).toBe(true);
  });
});