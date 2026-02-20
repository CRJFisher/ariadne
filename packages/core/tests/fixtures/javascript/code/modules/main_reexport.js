/**
 * Main module using re-exported functions
 * Tests: Re-export chain resolution (imports from middle, should resolve to base)
 */

import { coreFunction, anotherFunction, middleFunction } from './middle.js';

// Call the re-exported function (should resolve to base.js)
const result1 = coreFunction();

// Call another re-exported function (should resolve to base.js)
const result2 = anotherFunction();

// Call the middle function (should resolve to middle.js)
const result3 = middleFunction();

export { result1, result2, result3 };
