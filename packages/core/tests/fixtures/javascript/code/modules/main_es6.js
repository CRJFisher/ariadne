/**
 * ES6 module imports - main_es6.js
 * Tests: ES6 import statements, cross-module function calls, exports
 */

// Named imports
import { helper, validateEmail } from './utils_es6.js';
// Default import
import formatDate from './utils_es6.js';

// Version constant
const VERSION = "1.0.0";

// Data processor class
class DataProcessor {
  constructor(data) {
    this.data = data;
  }

  process() {
    return this.data.toUpperCase();
  }
}

// Process data function
function processData(input) {
  const processor = new DataProcessor(input);
  return processor.process();
}

// Main entry point
function main() {
  const greeting = helper();
  const processed = processData("hello world");
  const isValid = validateEmail("test@example.com");
  const today = formatDate(new Date());

  console.log(`${greeting} - Version ${VERSION}`);
  console.log(`Processed: ${processed}`);
  console.log(`Valid email: ${isValid}`);
  console.log(`Today: ${today}`);
}

// Exports
export {
  VERSION,
  DataProcessor,
  processData,
  main,
};
