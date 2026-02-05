/**
 * Main module using aliased imports
 * Tests: Aliased import resolution (import { foo as bar })
 */

import {
  helper as utilHelper,
  processor as dataProcessor,
  DataManager as Manager
} from './utils_aliased.js';

// Call aliased function (should resolve to helper in utils_aliased.js)
const result1 = utilHelper();

// Call another aliased function (should resolve to processor in utils_aliased.js)
const result2 = dataProcessor();

// Use aliased class (should resolve to DataManager in utils_aliased.js)
const manager = new Manager();
const result3 = manager.process();

export { result1, result2, result3, manager };
