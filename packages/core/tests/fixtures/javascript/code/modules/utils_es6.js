/**
 * ES6 module exports - utils_es6.js
 * Tests: ES6 export statements, function definitions for cross-module resolution
 */

// Named exports
export function helper() {
  return "from utils es6";
}

export function processData(input) {
  return input.toLowerCase();
}

export function validateEmail(email) {
  return email.includes("@");
}

// Default export
export default function formatDate(date) {
  return date.toISOString().split('T')[0];
}