# Ariadne Feature Support Matrix

## Import Resolution

| Feature | JavaScript | TypeScript | Python | Rust |
|---------|------------|------------|---------|------|
| Basic Imports | ✅ full | ✅ full | ✅ full | ✅ full |
| Namespace Imports | ✅ full | ✅ full | ⚠️ partial | ⚠️ partial |
| Dynamic Imports | ⚠️ partial | ⚠️ partial | ❌ none | ❌ none |

## Call Graph

| Feature | JavaScript | TypeScript | Python | Rust |
|---------|------------|------------|---------|------|
| Method Chaining | ✅ full | ✅ full | ✅ full | ✅ full |
| Cross-file Resolution | ✅ full | ✅ full | ✅ full | ✅ full |
| Recursive Call Detection | ✅ full | ✅ full | ✅ full | ✅ full |

## Types

| Feature | JavaScript | TypeScript | Python | Rust |
|---------|------------|------------|---------|------|
| Return Type Inference | ⚠️ partial | ⚠️ partial | ⚠️ partial | ⚠️ partial |
| Variable Type Tracking | ⚠️ partial | ⚠️ partial | ⚠️ partial | ⚠️ partial |

## Exports

| Feature | JavaScript | TypeScript | Python | Rust |
|---------|------------|------------|---------|------|
| CommonJS Exports | ✅ full | ✅ full | ❌ none | ❌ none |
| ES6 Exports | ✅ full | ✅ full | ❌ none | ❌ none |
| Re-exports | ✅ full | ✅ full | ⚠️ partial | ⚠️ partial |

## Scopes

| Feature | JavaScript | TypeScript | Python | Rust |
|---------|------------|------------|---------|------|
| Variable Hoisting | ✅ full | ✅ full | ❌ none | ❌ none |
| Closure Tracking | ⚠️ partial | ⚠️ partial | ⚠️ partial | ⚠️ partial |

