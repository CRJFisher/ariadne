/**
 * Middle module - re-exports from base
 * Tests: Re-export chain resolution (middle of chain)
 */

// Re-export from base.js
export { coreFunction, anotherFunction } from './base.js';

// Also define a local function
export function middleFunction() {
  return "from middle module";
}
