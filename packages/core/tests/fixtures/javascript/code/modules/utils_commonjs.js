/**
 * CommonJS module exports - utils_commonjs.js
 * Tests: CommonJS module.exports, function definitions for cross-module resolution
 */

function helper() {
  return "from utils";
}

function processData(input) {
  return input.toUpperCase();
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// CommonJS exports
module.exports = {
  helper,
  processData,
  calculateTotal,
};
