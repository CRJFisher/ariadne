/**
 * CommonJS module imports - main_commonjs.js
 * Tests: CommonJS require(), cross-module function calls
 */

// CommonJS require
const { helper, processData, calculateTotal } = require('./utils_commonjs');

// Cross-module function calls
const greeting = helper();
const processed = processData("hello world");

// Using imported function with data
const items = [
  { name: "item1", price: 10 },
  { name: "item2", price: 20 }
];
const total = calculateTotal(items);

// Export results for potential further use
module.exports = {
  greeting,
  processed,
  total,
};
